// server/routers/transactions.ts
import { protectedProcedure } from "../_core/trpc";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { transactions, participants, monthlyPayments, auditLog } from "../../drizzle/schema";
import { calcMonthlyPayment, calcLateMonthlyPayment, isLatePayment } from "../businessLogic";
import { getCaixinhaOrThrow, getParticipantOrThrow, monthSchema, participantIdSchema } from "./helpers";
import { z } from "zod";
import Decimal from "decimal.js";
import { TRPCError } from "@trpc/server";

export const transactionsProcedures = {
  getMonthlyPayments: protectedProcedure.input(z.object({ participantId: participantIdSchema })).query(async ({ input, ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    await getParticipantOrThrow(db, input.participantId, caixinha.id);
    return db.select().from(monthlyPayments).where(eq(monthlyPayments.participantId, input.participantId));
  }),

  getTransactions: protectedProcedure.input(z.object({ participantId: participantIdSchema })).query(async ({ input, ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    await getParticipantOrThrow(db, input.participantId, caixinha.id);
    return db.select().from(transactions).where(eq(transactions.participantId, input.participantId));
  }),

  getAllTransactions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    return db.select({
      id: transactions.id,
      participantId: transactions.participantId,
      type: transactions.type,
      amount: transactions.amount,
      balanceBefore: transactions.balanceBefore,
      balanceAfter: transactions.balanceAfter,
      month: transactions.month,
      year: transactions.year,
      description: transactions.description,
      createdAt: transactions.createdAt,
    })
      .from(transactions)
      .innerJoin(participants, eq(participants.id, transactions.participantId))
      .where(eq(participants.caixinhaId, caixinha.id));
  }),

  getAuditLog: protectedProcedure.input(z.object({ participantId: participantIdSchema.optional(), limit: z.number().int().min(1).max(200).default(50) })).query(async ({ input, ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    if (input.participantId) {
      await getParticipantOrThrow(db, input.participantId, caixinha.id);
      return db.select().from(auditLog).where(eq(auditLog.participantId, input.participantId)).limit(input.limit);
    }
    return db.select({
      id: auditLog.id,
      participantId: auditLog.participantId,
      participantName: auditLog.participantName,
      action: auditLog.action,
      month: auditLog.month,
      year: auditLog.year,
      amount: auditLog.amount,
      description: auditLog.description,
      createdAt: auditLog.createdAt,
    })
      .from(auditLog)
      .innerJoin(participants, eq(participants.id, auditLog.participantId))
      .where(eq(participants.caixinhaId, caixinha.id))
      .limit(input.limit);
  }),

  addLoan: protectedProcedure.input(z.object({ participantId: participantIdSchema, amount: z.coerce.number().positive().max(999999.99) })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    return db.transaction(async (tx) => {
      const [p] = await tx.select().from(participants).where(and(eq(participants.id, input.participantId), eq(participants.caixinhaId, caixinha.id))).for("update").limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      const balanceBefore = new Decimal(p.currentDebt);
      const loanAmount = new Decimal(input.amount);
      const newTotalLoan = new Decimal(p.totalLoan).add(loanAmount);
      const balanceAfter = balanceBefore.add(loanAmount);
      await tx.update(participants).set({ totalLoan: newTotalLoan.toFixed(2), currentDebt: balanceAfter.toFixed(2) }).where(eq(participants.id, input.participantId));
      await tx.insert(transactions).values({ participantId: input.participantId, type: "loan", amount: loanAmount.toFixed(2), balanceBefore: balanceBefore.toFixed(2), balanceAfter: balanceAfter.toFixed(2), description: `Empréstimo adicional de R$ ${loanAmount.toFixed(2)}` });
      await tx.insert(auditLog).values({ participantId: input.participantId, participantName: p.name, action: "loan_added", amount: loanAmount.toFixed(2), description: `Empréstimo adicional de R$ ${loanAmount.toFixed(2)}` });
      return { success: true };
    });
  }),

  registerPayment: protectedProcedure
    .input(z.object({
      participantId: participantIdSchema,
      month: monthSchema,
      year: z.number().int().min(2020).max(2100),
      idempotencyKey: z.string().uuid().optional(),
      paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

      if (input.idempotencyKey) {
        const [existing] = await db.select().from(transactions)
          .innerJoin(participants, eq(participants.id, transactions.participantId))
          .where(and(eq(transactions.idempotencyKey, input.idempotencyKey), eq(participants.caixinhaId, caixinha.id)))
          .limit(1);
        if (existing) return { success: true, isLate: false };
      }

      return db.transaction(async (tx) => {
        const [p] = await tx.select().from(participants)
          .where(and(eq(participants.id, input.participantId), eq(participants.isActive, true)))
          .for("update").limit(1);
        if (!p) throw new TRPCError({ code: "NOT_FOUND" });

        const existingPayment = await tx.select().from(monthlyPayments)
          .where(and(
            eq(monthlyPayments.participantId, input.participantId),
            eq(monthlyPayments.month, input.month),
            eq(monthlyPayments.year, input.year),
          )).limit(1);
        if (existingPayment.length > 0 && existingPayment[0].paid === true)
          throw new TRPCError({ code: "CONFLICT", message: "Mês já pago." });

        const paymentDate = input.paymentDate
          ? new Date(input.paymentDate + 'T12:00:00')
          : new Date();

        const late = isLatePayment(input.month, paymentDate, caixinha.paymentDueDay ?? 5);
        const currentDebt = new Decimal(p.currentDebt);
        
        // 🟢 LÊ A ETIQUETA DO BANCO DE DADOS
        const role = (p.role || 'member') as 'member' | 'external';
        
        // 🟢 INJETA A ETIQUETA NA MATEMÁTICA
        const calc = late
          ? calcLateMonthlyPayment(currentDebt, role)
          : { ...calcMonthlyPayment(currentDebt, role), isLate: false, lateFee: new Decimal(0), lateInterest: new Decimal(0), totalLateCharge: new Decimal(0) };

        const paidAt = paymentDate;

        if (existingPayment.length > 0) {
          await tx.update(monthlyPayments)
            .set({ paid: true, paidLate: late, paidAt })
            .where(eq(monthlyPayments.id, existingPayment[0].id));
        } else {
          await tx.insert(monthlyPayments).values({
            participantId: input.participantId,
            month: input.month,
            year: input.year,
            paid: true,
            paidLate: late,
            paidAt,
          });
        }

        // Descrição adaptada caso seja externo (isenta a palavra "Cota")
        const descBase = role === 'external' ? `Juros R$ ${calc.interest.toFixed(2)}` : `Cota R$ 200,00 + Juros R$ ${calc.interest.toFixed(2)}`;
        const description = late
          ? `${descBase} + Multa R$ ${calc.lateFee?.toFixed(2)} + Mora R$ ${calc.lateInterest?.toFixed(2)} (ATRASO)`
          : descBase;

        try {
          await tx.insert(transactions).values({
            participantId: input.participantId,
            type: "payment",
            amount: calc.total.toFixed(2),
            balanceBefore: currentDebt.toFixed(2),
            balanceAfter: currentDebt.toFixed(2), // Amortização muda a dívida, pagamento normal não
            month: input.month,
            year: input.year,
            description,
            idempotencyKey: input.idempotencyKey,
          });
        } catch (e: any) {
          if (e?.errno === 1062) return { success: true, isLate: late };
          throw e;
        }

        await tx.insert(auditLog).values({
          participantId: input.participantId,
          participantName: p.name,
          action: "payment_marked",
          month: input.month,
          year: input.year,
          amount: calc.total.toFixed(2),
          description,
        });

        return { success: true, isLate: late, total: calc.total.toFixed(2) };
      });
    }),

  registerAmortization: protectedProcedure.input(z.object({ participantId: participantIdSchema, amount: z.coerce.number().positive().max(999999.99) })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    return db.transaction(async (tx) => {
      const [p] = await tx.select().from(participants).where(and(eq(participants.id, input.participantId), eq(participants.caixinhaId, caixinha.id))).for("update").limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      const currentDebt = new Decimal(p.currentDebt);
      if (new Decimal(input.amount).gt(currentDebt)) throw new TRPCError({ code: "BAD_REQUEST", message: `Amortização de R$ ${input.amount.toFixed(2)} excede a dívida.` });
      const amountDecimal = new Decimal(input.amount);
      const balanceAfter = currentDebt.sub(amountDecimal);
      await tx.update(participants).set({ currentDebt: balanceAfter.toFixed(2) }).where(eq(participants.id, input.participantId));
      await tx.insert(transactions).values({ participantId: input.participantId, type: "amortization", amount: amountDecimal.toFixed(2), balanceBefore: currentDebt.toFixed(2), balanceAfter: balanceAfter.toFixed(2), description: `Amortização de R$ ${amountDecimal.toFixed(2)}` });
      await tx.insert(auditLog).values({ participantId: input.participantId, participantName: p.name, action: "amortization_added", amount: amountDecimal.toFixed(2), description: `Dívida reduzida de R$ ${currentDebt.toFixed(2)} para R$ ${balanceAfter.toFixed(2)}` });
      return { success: true };
    });
  }),

  unmarkPayment: protectedProcedure.input(z.object({ paymentId: z.number().int().positive(), participantId: participantIdSchema })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    return db.transaction(async (tx) => {
      const [p] = await tx.select().from(participants).where(and(eq(participants.id, input.participantId), eq(participants.caixinhaId, caixinha.id))).for("update").limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Participante não encontrado." });
      const [payment] = await tx.select().from(monthlyPayments).where(eq(monthlyPayments.id, input.paymentId)).limit(1);
      if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado." });

      if (payment.paid !== true && (payment.paid as any) !== 1) {
        throw new TRPCError({ code: "CONFLICT", message: "Pagamento já está desmarcado." });
      }

      await tx.update(monthlyPayments).set({ paid: false }).where(eq(monthlyPayments.id, input.paymentId));
      const [originalTx] = await tx.select().from(transactions).where(and(
        eq(transactions.participantId, input.participantId),
        eq(transactions.type, "payment"),
        eq(transactions.month, payment.month),
        eq(transactions.year, payment.year),
      )).limit(1);

      const currentDebt = new Decimal(p.currentDebt);
      const role = (p.role || 'member') as 'member' | 'external'; // 🟢 ETIQUETA INJETADA AQUI
      
      const reversalAmountStr = originalTx
        ? new Decimal(originalTx.amount).abs().toFixed(2)
        : calcMonthlyPayment(currentDebt, role).total.toFixed(2);

      await tx.insert(transactions).values({
        participantId: input.participantId,
        type: "reversal",
        amount: reversalAmountStr,
        balanceBefore: currentDebt.toFixed(2),
        balanceAfter: currentDebt.toFixed(2),
        month: payment.month,
        year: payment.year,
        description: `Estorno manual de pagamento: ${payment.month}/${payment.year}`,
      });

      await tx.insert(auditLog).values({
        participantId: input.participantId,
        participantName: p.name,
        action: "payment_unmarked",
        month: payment.month,
        year: payment.year,
        amount: reversalAmountStr,
        description: `Pagamento de ${payment.month}/${payment.year} desmarcado (estorno gerado)`,
      });
      return { success: true };
    });
  }),

  resetMonth: protectedProcedure.input(z.object({ month: monthSchema, year: z.number().int().min(2020).max(2100) }).optional()).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    const now = new Date();
    const month = input?.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const year = input?.year ?? now.getFullYear();

    return db.transaction(async (tx) => {
      const payments = await tx.select({ mp: monthlyPayments, participant: participants })
        .from(monthlyPayments)
        .innerJoin(participants, eq(participants.id, monthlyPayments.participantId))
        .where(and(eq(participants.caixinhaId, caixinha.id), eq(monthlyPayments.month, month), eq(monthlyPayments.year, year), eq(monthlyPayments.paid, true)));
      if (payments.length === 0) return { success: true, reset: 0 };

      for (const { mp, participant } of payments) {
        await tx.update(monthlyPayments).set({ paid: false }).where(eq(monthlyPayments.id, mp.id));
        const [originalTx] = await tx.select().from(transactions).where(and(
          eq(transactions.participantId, mp.participantId),
          eq(transactions.type, "payment"),
          eq(transactions.month, month),
          eq(transactions.year, year),
        )).limit(1);
        
        const currentDebt = new Decimal(participant.currentDebt);
        const role = (participant.role || 'member') as 'member' | 'external'; // 🟢 ETIQUETA INJETADA AQUI
        
        const reversalAmountStr = originalTx
          ? new Decimal(originalTx.amount).abs().toFixed(2)
          : calcMonthlyPayment(currentDebt, role).total.toFixed(2);
          
        await tx.insert(transactions).values({ participantId: mp.participantId, type: "reversal", amount: reversalAmountStr, balanceBefore: currentDebt.toFixed(2), balanceAfter: currentDebt.toFixed(2), month, year, description: `Estorno de pagamento: ${month}/${year}` });
        await tx.insert(auditLog).values({ participantId: mp.participantId, participantName: participant.name, action: "payment_unmarked", month, year, description: `Pagamento de ${month}/${year} desmarcado (reset)` });
      }
      return { success: true, reset: payments.length };
    });
  }),
};