// server/routers/participants.ts
import { protectedProcedure } from "../_core/trpc";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { participants, monthlyPayments, auditLog, transactions } from "../../drizzle/schema";
import { getCaixinhaOrThrow, getParticipantOrThrow, participantIdSchema } from "./helpers";
import { z } from "zod";
import Decimal from "decimal.js";
import { TRPCError } from "@trpc/server";

export const participantsProcedures = {
  listParticipants: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    const rows = await db.select()
      .from(participants)
      .leftJoin(monthlyPayments, eq(monthlyPayments.participantId, participants.id))
      .where(eq(participants.caixinhaId, caixinha.id));
    
    const grouped = rows.reduce((acc: Record<number, any>, row) => {
      const id = row.participants.id;
      if (!acc[id]) acc[id] = { ...row.participants, monthlyPayments: [] };
      if (row.monthlyPayments) acc[id].monthlyPayments.push(row.monthlyPayments);
      return acc;
    }, {});
    return Object.values(grouped);
  }),

  addParticipant: protectedProcedure
    .input(z.object({ 
      name: z.string().min(1).max(255), 
      email: z.string().email().max(320).optional(), 
      totalLoan: z.coerce.number().nonnegative().max(999999.99).default(0),
      role: z.enum(["member", "external"]).default("member")
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

      return db.transaction(async (tx) => {
        const [result] = await tx.insert(participants).values({ 
          caixinhaId: caixinha.id, name: input.name, email: input.email ?? null, 
          totalLoan: input.totalLoan.toFixed(2), currentDebt: input.totalLoan.toFixed(2), role: input.role 
        });

        const newId = result.insertId;

        if (input.totalLoan > 0) {
          await tx.insert(auditLog).values({ participantId: newId, participantName: input.name, action: "loan_added", amount: input.totalLoan.toFixed(2), description: `Empréstimo inicial de R$ ${input.totalLoan.toFixed(2)}` });
          await tx.insert(transactions).values({ participantId: newId, type: "loan", amount: input.totalLoan.toFixed(2), balanceBefore: "0.00", balanceAfter: input.totalLoan.toFixed(2), description: "Empréstimo Inicial" });
        }

        await tx.insert(auditLog).values({ participantId: newId, participantName: input.name, action: "participant_created", description: `Participante adicionado como ${input.role === 'external' ? 'Tomador Externo' : 'Membro'}` });
        return { success: true, participantId: newId };
      });
    }),

  updateParticipantName: protectedProcedure.input(z.object({ participantId: participantIdSchema, newName: z.string().min(1).max(255) })).mutation(async ({ input, ctx }) => {
      const db = await getDb(); const caixinha = await getCaixinhaOrThrow(db, ctx.user.id); await getParticipantOrThrow(db, input.participantId, caixinha.id);
      await db.update(participants).set({ name: input.newName }).where(eq(participants.id, input.participantId)); return { success: true };
    }),

  updateParticipantEmail: protectedProcedure.input(z.object({ participantId: participantIdSchema, email: z.string().email().max(320).optional() })).mutation(async ({ input, ctx }) => {
      const db = await getDb(); const caixinha = await getCaixinhaOrThrow(db, ctx.user.id); await getParticipantOrThrow(db, input.participantId, caixinha.id);
      await db.update(participants).set({ email: input.email ?? null }).where(eq(participants.id, input.participantId)); return { success: true };
    }),

  updateParticipantLoan: protectedProcedure.input(z.object({ participantId: participantIdSchema, newTotalLoan: z.coerce.number().nonnegative().max(999999.99) })).mutation(async ({ input, ctx }) => {
      const db = await getDb(); const caixinha = await getCaixinhaOrThrow(db, ctx.user.id); await getParticipantOrThrow(db, input.participantId, caixinha.id);
      await db.update(participants).set({ totalLoan: new Decimal(input.newTotalLoan).toFixed(2) }).where(eq(participants.id, input.participantId)); return { success: true };
    }),

  updateParticipantDebt: protectedProcedure.input(z.object({ participantId: participantIdSchema, newCurrentDebt: z.coerce.number().nonnegative().max(999999.99) })).mutation(async ({ input, ctx }) => {
      const db = await getDb(); const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
      return db.transaction(async (tx) => {
        const [p] = await tx.select().from(participants).where(and(eq(participants.id, input.participantId), eq(participants.caixinhaId, caixinha.id))).for("update").limit(1);
        if (!p) throw new TRPCError({ code: "NOT_FOUND" });
        const balanceBefore = new Decimal(p.currentDebt); const balanceAfter = new Decimal(input.newCurrentDebt);
        await tx.update(participants).set({ currentDebt: balanceAfter.toFixed(2) }).where(eq(participants.id, input.participantId));
        await tx.insert(auditLog).values({ participantId: input.participantId, participantName: p.name, action: "amortization_added", amount: balanceBefore.sub(balanceAfter).abs().toFixed(2), description: `Saldo ajustado: R$ ${balanceBefore.toFixed(2)} → R$ ${balanceAfter.toFixed(2)}` });
        return { success: true };
      });
    }),

  deleteParticipant: protectedProcedure.input(z.object({ participantId: participantIdSchema })).mutation(async ({ input, ctx }) => {
      const db = await getDb(); const caixinha = await getCaixinhaOrThrow(db, ctx.user.id); await getParticipantOrThrow(db, input.participantId, caixinha.id);
      return db.transaction(async (tx) => {
        await tx.delete(auditLog).where(eq(auditLog.participantId, input.participantId));
        await tx.delete(monthlyPayments).where(eq(monthlyPayments.participantId, input.participantId));
        await tx.delete(transactions).where(eq(transactions.participantId, input.participantId));
        await tx.delete(participants).where(eq(participants.id, input.participantId));
        return { success: true };
      });
    }),

  // 🟢 NOVA ROTA: Apagar Múltiplos Participantes de uma vez
  deleteMultipleParticipants: protectedProcedure
    .input(z.object({ participantIds: z.array(z.number().int().positive()) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
      
      return db.transaction(async (tx) => {
        for (const id of input.participantIds) {
          const [p] = await tx.select().from(participants).where(and(eq(participants.id, id), eq(participants.caixinhaId, caixinha.id))).limit(1);
          if (p) {
            await tx.delete(auditLog).where(eq(auditLog.participantId, id));
            await tx.delete(monthlyPayments).where(eq(monthlyPayments.participantId, id));
            await tx.delete(transactions).where(eq(transactions.participantId, id));
            await tx.delete(participants).where(eq(participants.id, id));
          }
        }
        return { success: true };
      });
    }),
};