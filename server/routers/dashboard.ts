// server/routers/dashboard.ts
import { protectedProcedure } from "../_core/trpc";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { getDb } from "../db";
import Decimal from "decimal.js";
import { transactions, participants, monthlyPayments, caixinhaMetadata, monthlySummary } from "../../drizzle/schema";
import { calcNextMonthEstimate, calculateCollectionsFromTransactions } from "../businessLogic";
import { getCaixinhaOrThrow } from "./helpers";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const dashboardProcedures = {
  getOrCreateCaixinha: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    const [existing] = await db.select().from(caixinhaMetadata).where(eq(caixinhaMetadata.ownerId, ctx.user.id)).limit(1);
    if (existing) return existing;

    try {
      await db.insert(caixinhaMetadata).values({ ownerId: ctx.user.id, name: "Minha Caixinha" });
    } catch (e: any) {
      if (e?.errno !== 1062) throw e;
    }
    const [created] = await db.select().from(caixinhaMetadata).where(eq(caixinhaMetadata.ownerId, ctx.user.id)).limit(1);
    return created;
  }),

  getBalancete: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

    const allTx = await db
      .select({ tx: transactions, participantRole: participants.role })
      .from(transactions)
      .innerJoin(participants, eq(participants.id, transactions.participantId))
      .where(eq(participants.caixinhaId, caixinha.id));

    let caixaLivre = new Decimal(0);

    for (const row of allTx) {
      const tx = row.tx;
      const amount = new Decimal(tx.amount).abs();
      if (tx.type === 'payment' || tx.type === 'amortization') caixaLivre = caixaLivre.add(amount);
      else if (tx.type === 'loan' || tx.type === 'reversal') caixaLivre = caixaLivre.sub(amount);
    }

    const participantRoles = Object.fromEntries(
      allTx.map((row) => [row.tx.participantId, row.participantRole ?? 'member'])
    ) as Record<number, 'member' | 'external'>;

    const totals = calculateCollectionsFromTransactions(
      allTx.map((row) => ({ participantId: row.tx.participantId, type: row.tx.type, amount: row.tx.amount })),
      participantRoles,
    );

    const totalRendimentos = new Decimal(totals.totalInterest);

    const allParticipants = await db.select().from(participants).where(eq(participants.caixinhaId, caixinha.id));
    let contasAReceber = new Decimal(0);
    for (const p of allParticipants) contasAReceber = contasAReceber.add(new Decimal(p.currentDebt));

    const now = new Date();
    const currentMonthFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentYear = now.getFullYear();

    const paidRows = await db
      .select({ participantId: monthlyPayments.participantId })
      .from(monthlyPayments)
      .innerJoin(participants, eq(participants.id, monthlyPayments.participantId))
      .where(and(
        eq(participants.caixinhaId, caixinha.id),
        eq(monthlyPayments.month, currentMonthFormatted),
        eq(monthlyPayments.year, currentYear),
        eq(monthlyPayments.paid, true)
      ));

    const paidIds = new Set(paidRows.map((row) => row.participantId));
    const activeParticipants = allParticipants.filter((p) => (p.isActive as any) === true || (p.isActive as any) === 1);
    const activeMembers = activeParticipants.filter((p) => p.role !== 'external');
    const activeExternalWithDebt = activeParticipants.filter((p) => p.role === 'external' && new Decimal(p.currentDebt).gt(0));

    const unpaidMembers = activeMembers.filter((p) => !paidIds.has(p.id)).length;
    const unpaidExternalWithDebt = activeExternalWithDebt.filter((p) => !paidIds.has(p.id)).length;

    return {
      caixaLivre: caixaLivre.toFixed(2),
      contasAReceber: contasAReceber.toFixed(2),
      patrimonioTotal: caixaLivre.add(contasAReceber).toFixed(2),
      totalRendimentos: totalRendimentos.toFixed(2),
      inadimplencia: Math.max(0, activeParticipants.length - paidIds.size),
      inadimplenciaSegmentada: {
        membros: unpaidMembers,
        externosComDivida: unpaidExternalWithDebt,
        total: unpaidMembers + unpaidExternalWithDebt,
      },
      mesAtual: currentMonthFormatted,
    };
  }),

  getNextMonthEstimate: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    const activeParticipants = await db
      .select({
        id: participants.id,
        name: participants.name,
        currentDebt: participants.currentDebt,
        role: participants.role,
      })
      .from(participants)
      .where(eq(participants.caixinhaId, caixinha.id));

    const estimate = calcNextMonthEstimate(activeParticipants);
    const now = new Date();
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}`;
    const dueDay = caixinha.paymentDueDay ?? 5;
    const [y, m] = nextMonth.split("-").map(Number);
    const dueDate = new Date(y, m - 1, dueDay);

    return {
      ...estimate,
      nextMonth,
      dueDate: dueDate.toISOString().split("T")[0],
      dueDay,
      startDate: caixinha.startDate ?? null,
      caixinhaName: caixinha.name,
    };
  }),

  updateCaixinhaSettings: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      paymentDueDay: z.number().int().min(1).max(28).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
      const updateValues: Record<string, any> = {};
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.startDate !== undefined) updateValues.startDate = new Date(input.startDate);
      if (input.paymentDueDay !== undefined) updateValues.paymentDueDay = input.paymentDueDay;

      await db.update(caixinhaMetadata).set(updateValues).where(eq(caixinhaMetadata.id, caixinha.id));
      return { success: true };
    }),

  closeCycleSnapshot: protectedProcedure
    .input(z.object({ month: z.string().max(7).regex(/^\d{4}-\d{2}$/), year: z.number().int().min(2020).max(2100) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

      const [existing] = await db
        .select()
        .from(monthlySummary)
        .where(and(
          eq(monthlySummary.caixinhaId, caixinha.id),
          eq(monthlySummary.month, input.month),
          eq(monthlySummary.year, input.year),
        ))
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Ciclo já fechado para este período. Snapshot é imutável.' });
      }

      const participantRows = await db
        .select({ id: participants.id, role: participants.role })
        .from(participants)
        .where(eq(participants.caixinhaId, caixinha.id));

      const participantIds = participantRows.map((p) => p.id);
      const paymentRows = participantIds.length === 0
        ? []
        : await db
            .select({ participantId: transactions.participantId, type: transactions.type, amount: transactions.amount })
            .from(transactions)
            .where(and(
              eq(transactions.month, input.month),
              eq(transactions.year, input.year),
              inArray(transactions.participantId, participantIds),
            ));

      const participantRoles = Object.fromEntries(
        participantRows.map((p) => [p.id, (p.role ?? 'member') as 'member' | 'external'])
      ) as Record<number, 'member' | 'external'>;

      const totals = calculateCollectionsFromTransactions(paymentRows, participantRoles);

      await db.insert(monthlySummary).values({
        caixinhaId: caixinha.id,
        month: input.month,
        year: input.year,
        totalFeesCollected: new Decimal(totals.totalFees).toFixed(2),
        totalInterestCollected: new Decimal(totals.totalInterest).toFixed(2),
      });

      return {
        success: true,
        month: input.month,
        year: input.year,
        totalFeesCollected: new Decimal(totals.totalFees).toFixed(2),
        totalInterestCollected: new Decimal(totals.totalInterest).toFixed(2),
      };
    }),

  getMonthlySummaryHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(36).default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
      const limit = input?.limit ?? 12;

      return db
        .select()
        .from(monthlySummary)
        .where(eq(monthlySummary.caixinhaId, caixinha.id))
        .orderBy(desc(monthlySummary.year), desc(monthlySummary.month))
        .limit(limit);
    }),

  getParticipantStatement: protectedProcedure
    .input(z.object({ participantId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

      const [participant] = await db
        .select()
        .from(participants)
        .where(and(eq(participants.id, input.participantId), eq(participants.caixinhaId, caixinha.id)))
        .limit(1);

      if (!participant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Participante não encontrado' });

      const rows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.participantId, input.participantId))
        .orderBy(desc(transactions.createdAt));

      return {
        participant: {
          id: participant.id,
          name: participant.name,
          role: participant.role,
          totalLoan: participant.totalLoan,
          currentDebt: participant.currentDebt,
        },
        transactions: rows,
      };
    }),

  getDueAlerts: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

      const today = new Date();
      const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const year = today.getFullYear();
      const dueDay = caixinha.paymentDueDay ?? 5;
      const day = today.getDate();

      const activeParticipants = await db
        .select({ id: participants.id, name: participants.name, role: participants.role, currentDebt: participants.currentDebt })
        .from(participants)
        .where(and(eq(participants.caixinhaId, caixinha.id), eq(participants.isActive as any, true)));

      const payments = await db
        .select({ participantId: monthlyPayments.participantId })
        .from(monthlyPayments)
        .innerJoin(participants, eq(participants.id, monthlyPayments.participantId))
        .where(and(
          eq(participants.caixinhaId, caixinha.id),
          eq(monthlyPayments.month, month),
          eq(monthlyPayments.year, year),
          eq(monthlyPayments.paid, true),
        ));

      const paidIds = new Set(payments.map((p) => p.participantId));
      const alerts = activeParticipants
        .filter((p) => !paidIds.has(p.id))
        .filter((p) => p.role !== 'external' || new Decimal(p.currentDebt).gt(0))
        .map((p) => ({
          participantId: p.id,
          name: p.name,
          level: day > dueDay ? 'overdue' : day >= Math.max(1, dueDay - 3) ? 'due_soon' : 'upcoming',
          message: day > dueDay
            ? `Pagamento em atraso desde dia ${dueDay}`
            : `Vencimento previsto para dia ${dueDay}`,
        }));

      return { month, dueDay, alerts };
    }),

  simulateScenario: protectedProcedure
    .input(z.object({ interestRate: z.number().min(0).max(1).default(0.10), expectedAdherence: z.number().min(0).max(1).default(1) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
      const interestRate = input?.interestRate ?? 0.10;
      const expectedAdherence = input?.expectedAdherence ?? 1;

      const rows = await db
        .select({ id: participants.id, role: participants.role, currentDebt: participants.currentDebt })
        .from(participants)
        .where(and(eq(participants.caixinhaId, caixinha.id), eq(participants.isActive as any, true)));

      let quotas = 0;
      let interests = 0;

      for (const row of rows) {
        const debt = new Decimal(row.currentDebt);
        const baseQuota = row.role === 'external' ? 0 : 200;
        const interest = debt.mul(interestRate).toNumber();
        quotas += baseQuota * expectedAdherence;
        interests += interest * expectedAdherence;
      }

      return {
        expectedAdherence,
        interestRate,
        estimatedQuotas: new Decimal(quotas).toFixed(2),
        estimatedInterest: new Decimal(interests).toFixed(2),
        estimatedTotal: new Decimal(quotas + interests).toFixed(2),
      };
    }),

  // ── Snapshot Histórico de Mês ────────────────────────────────
  getMonthSnapshot: protectedProcedure
    .input(z.object({ month: z.string().max(7).regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

      const year = parseInt(input.month.split('-')[0]);

      const allParticipants = await db
        .select()
        .from(participants)
        .where(and(
          eq(participants.caixinhaId, caixinha.id),
          eq(participants.isActive as any, true)
        ));

      if (allParticipants.length === 0) {
        return {
          month: input.month,
          totalParticipants: 0,
          paidCount: 0,
          unpaidCount: 0,
          lateCount: 0,
          totalCollected: 0,
          paidParticipants: [],
          unpaidParticipants: [],
        };
      }

      const participantIds = allParticipants.map(p => p.id);

      const payments = await db
        .select()
        .from(monthlyPayments)
        .where(and(
          eq(monthlyPayments.month, input.month),
          eq(monthlyPayments.year, year),
          inArray(monthlyPayments.participantId, participantIds)
        ));

      const monthTransactions = await db
        .select()
        .from(transactions)
        .where(and(
          eq(transactions.month, input.month),
          inArray(transactions.participantId, participantIds)
        ));

      const paidParticipants = allParticipants.filter(p =>
        payments.some(pay => pay.participantId === p.id && (pay.paid === true || (pay.paid as any) === 1))
      );

      const unpaidParticipants = allParticipants.filter(p =>
        !payments.some(pay => pay.participantId === p.id && (pay.paid === true || (pay.paid as any) === 1))
      );

      const totalCollected = monthTransactions
        .filter((t) => t.type === 'payment' || t.type === 'reversal')
        .reduce((acc, t) => {
          const signal = t.type === 'reversal' ? -1 : 1;
          return new Decimal(acc).add(new Decimal(t.amount).mul(signal)).toNumber();
        }, 0);

      const latePayments = payments.filter(p =>
        p.paidLate === true || (p.paidLate as any) === 1
      ).length;

      return {
        month: input.month,
        totalParticipants: allParticipants.length,
        paidCount: paidParticipants.length,
        unpaidCount: unpaidParticipants.length,
        lateCount: latePayments,
        totalCollected,
        paidParticipants: paidParticipants.map(p => ({
          id: p.id,
          name: p.name,
          paidLate: payments.find(pay => pay.participantId === p.id)?.paidLate ?? false,
          paidAt: payments.find(pay => pay.participantId === p.id)?.paidAt ?? null,
        })),
        unpaidParticipants: unpaidParticipants.map(p => ({
          id: p.id,
          name: p.name,
          currentDebt: p.currentDebt,
        })),
      };
    }),
};
