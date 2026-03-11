// server/routers/dashboard.ts
import { protectedProcedure } from "../_core/trpc";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import Decimal from "decimal.js";
import { transactions, participants, monthlyPayments, caixinhaMetadata } from "../../drizzle/schema";
import { calcNextMonthEstimate } from "../businessLogic";
import { getCaixinhaOrThrow } from "./helpers";
import { z } from "zod";

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
      .select({ tx: transactions })
      .from(transactions)
      .innerJoin(participants, eq(participants.id, transactions.participantId))
      .where(eq(participants.caixinhaId, caixinha.id));

    let caixaLivre = new Decimal(0);
    let totalRendimentos = new Decimal(0);

    for (const row of allTx) {
      const tx = row.tx;
      const amount = new Decimal(tx.amount).abs(); 
      if (tx.type === 'payment' || tx.type === 'amortization') caixaLivre = caixaLivre.add(amount);
      else if (tx.type === 'loan' || tx.type === 'reversal') caixaLivre = caixaLivre.sub(amount);

      if (tx.type === 'payment') totalRendimentos = totalRendimentos.add(amount.sub(200));
      else if (tx.type === 'reversal') totalRendimentos = totalRendimentos.sub(amount.sub(200));
    }

    const allParticipants = await db.select().from(participants).where(eq(participants.caixinhaId, caixinha.id));
    let contasAReceber = new Decimal(0);
    for (const p of allParticipants) contasAReceber = contasAReceber.add(new Decimal(p.currentDebt));
    
    const now = new Date();
    const currentMonthFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentYear = now.getFullYear();

    const [{ pagosNesteMes }] = await db
      .select({ pagosNesteMes: sql<number>`COUNT(*)` })
      .from(monthlyPayments)
      .innerJoin(participants, eq(participants.id, monthlyPayments.participantId))
      .where(and(eq(participants.caixinhaId, caixinha.id), eq(monthlyPayments.month, currentMonthFormatted), eq(monthlyPayments.year, currentYear), eq(monthlyPayments.paid, true)));

    return {
      caixaLivre: caixaLivre.toFixed(2),
      contasAReceber: contasAReceber.toFixed(2),
      patrimonioTotal: caixaLivre.add(contasAReceber).toFixed(2),
      totalRendimentos: totalRendimentos.toFixed(2),
      inadimplencia: Math.max(0, allParticipants.length - Number(pagosNesteMes)),
      mesAtual: currentMonthFormatted,
    };
  }),

  getNextMonthEstimate: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
    const activeParticipants = await db.select({ id: participants.id, name: participants.name, currentDebt: participants.currentDebt }).from(participants).where(eq(participants.caixinhaId, caixinha.id));

    const estimate = calcNextMonthEstimate(activeParticipants);
    const now = new Date();
    const nextMonth = now.getMonth() === 11 ? `${now.getFullYear() + 1}-01` : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}`;
    const dueDay = caixinha.paymentDueDay ?? 5;
    const [y, m] = nextMonth.split("-").map(Number);
    const dueDate = new Date(y, m - 1, dueDay);

    return { ...estimate, nextMonth, dueDate: dueDate.toISOString().split("T")[0], dueDay, startDate: caixinha.startDate ?? null, caixinhaName: caixinha.name };
  }),

  updateCaixinhaSettings: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255).optional(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), paymentDueDay: z.number().int().min(1).max(28).optional() }))
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
};