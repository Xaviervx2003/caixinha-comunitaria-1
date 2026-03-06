// server/routers.ts
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import { calcMonthlyPayment } from "./businessLogic";
import Decimal from "decimal.js";
import {
  participants,
  transactions,
  monthlyPayments,
  auditLog,
  caixinhaMetadata,
} from "../drizzle/schema";

async function getCaixinhaOrThrow(db: Awaited<ReturnType<typeof getDb>>, userId: number) {
  const [caixinha] = await db
    .select()
    .from(caixinhaMetadata)
    .where(eq(caixinhaMetadata.ownerId, userId))
    .limit(1);

  if (!caixinha) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Caixinha não encontrada para este usuário.",
    });
  }
  return caixinha;
}

async function getParticipantOrThrow(
  db: Awaited<ReturnType<typeof getDb>>,
  participantId: number,
  caixinhaId: number
) {
  const [p] = await db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.caixinhaId, caixinhaId)
      )
    )
    .limit(1);

  if (!p) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Participante não encontrado.",
    });
  }
  return p;
}

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Formato inválido. Use "YYYY-MM"');

const participantIdSchema = z.number().int().positive();

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  caixinha: router({

    getOrCreateCaixinha: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();

      const [existing] = await db
        .select()
        .from(caixinhaMetadata)
        .where(eq(caixinhaMetadata.ownerId, ctx.user.id))
        .limit(1);

      if (existing) return existing;

      try {
        await db.insert(caixinhaMetadata).values({
          ownerId: ctx.user.id,
          name: "Minha Caixinha",
        });
      } catch (e: any) {
        if (e?.errno !== 1062) throw e;
      }

      const [created] = await db
        .select()
        .from(caixinhaMetadata)
        .where(eq(caixinhaMetadata.ownerId, ctx.user.id))
        .limit(1);

      return created;
    }),

    getBalancete: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

      const [saldo] = await db
        .select({
          caixaLivre: sql<number>`
            COALESCE(SUM(
              CASE
                WHEN ${transactions.type} IN ('payment', 'amortization') THEN ${transactions.amount}
                WHEN ${transactions.type} = 'loan' THEN -${transactions.amount}
                WHEN ${transactions.type} = 'reversal' THEN ${transactions.amount}
                ELSE 0
              END
            ), 0)`,
          totalRendimentos: sql<number>`
            COALESCE(SUM(
              CASE
                WHEN ${transactions.type} = 'payment' THEN ${transactions.amount} - 200
                WHEN ${transactions.type} = 'reversal' THEN ${transactions.amount} + 200
                ELSE 0
              END
            ), 0)`,
        })
        .from(transactions)
        .innerJoin(participants, eq(participants.id, transactions.participantId))
        .where(eq(participants.caixinhaId, caixinha.id));

      const [{ contasAReceber }] = await db
        .select({
          contasAReceber: sql<number>`COALESCE(SUM(${participants.currentDebt}), 0)`,
        })
        .from(participants)
        .where(eq(participants.caixinhaId, caixinha.id));

      const now = new Date();
      const currentMonthFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const currentYear = now.getFullYear();

      const [{ totalParticipants }] = await db
        .select({ totalParticipants: sql<number>`COUNT(*)` })
        .from(participants)
        .where(eq(participants.caixinhaId, caixinha.id));

      const [{ pagosNesteMes }] = await db
        .select({ pagosNesteMes: sql<number>`COUNT(*)` })
        .from(monthlyPayments)
        .innerJoin(participants, eq(participants.id, monthlyPayments.participantId))
        .where(
          and(
            eq(participants.caixinhaId, caixinha.id),
            eq(monthlyPayments.month, currentMonthFormatted),
            eq(monthlyPayments.year, currentYear),
            eq(monthlyPayments.paid, true)
          )
        );

      const patrimonioTotal = new Decimal(saldo.caixaLivre).add(new Decimal(contasAReceber));

      return {
        caixaLivre: new Decimal(saldo.caixaLivre).toFixed(2),
        contasAReceber: new Decimal(contasAReceber).toFixed(2),
        patrimonioTotal: patrimonioTotal.toFixed(2),
        totalRendimentos: new Decimal(saldo.totalRendimentos).toFixed(2),
        inadimplencia: Math.max(0, Number(totalParticipants) - Number(pagosNesteMes)),
        mesAtual: currentMonthFormatted,
      };
    }),

    listParticipants: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

      const rows = await db
        .select()
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

    getMonthlyPayments: protectedProcedure
      .input(z.object({ participantId: participantIdSchema }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
        await getParticipantOrThrow(db, input.participantId, caixinha.id);

        return db
          .select()
          .from(monthlyPayments)
          .where(eq(monthlyPayments.participantId, input.participantId));
      }),

    getTransactions: protectedProcedure
      .input(z.object({ participantId: participantIdSchema }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
        await getParticipantOrThrow(db, input.participantId, caixinha.id);

        return db
          .select()
          .from(transactions)
          .where(eq(transactions.participantId, input.participantId));
      }),

    // ✅ CORRIGIDO: era "etAllTransactions" (faltava o g)
    getAllTransactions: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

      return db
        .select({
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

    // ✅ CORRIGIDO: return estava cortado sem .from().where().limit()
    getAuditLog: protectedProcedure
      .input(
        z.object({
          participantId: participantIdSchema.optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
      )
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

        if (input.participantId) {
          await getParticipantOrThrow(db, input.participantId, caixinha.id);
          return db
            .select()
            .from(auditLog)
            .where(eq(auditLog.participantId, input.participantId))
            .limit(input.limit);
        }

        return db
          .select({
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

    addParticipant: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1, "Nome obrigatório").max(255),
          email: z.string().email("Email inválido").max(320).optional(),
          totalLoan: z.coerce.number().nonnegative().max(999999.99).default(0),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

        return db.transaction(async (tx) => {
          const result = await tx.insert(participants).values({
            caixinhaId: caixinha.id,
            name: input.name,
            email: input.email ?? null,
            totalLoan: input.totalLoan.toString(),
            currentDebt: input.totalLoan.toString(),
          });

          await tx.insert(auditLog).values({
            participantId: Number(result[0].insertId),
            participantName: input.name,
            action: "participant_created",
            description: `Participante criado com empréstimo inicial de R$ ${input.totalLoan.toFixed(2)}`,
          });

          return { success: true };
        });
      }),

    addLoan: protectedProcedure
      .input(
        z.object({
          participantId: participantIdSchema,
          amount: z.coerce.number().positive("Valor deve ser positivo").max(999999.99),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

        return db.transaction(async (tx) => {
          const [p] = await tx
            .select()
            .from(participants)
            .where(
              and(
                eq(participants.id, input.participantId),
                eq(participants.caixinhaId, caixinha.id)
              )
            )
            .for("update")
            .limit(1);

          if (!p) throw new TRPCError({ code: "NOT_FOUND" });

          const balanceBefore = new Decimal(p.currentDebt);
          const loanAmount = new Decimal(input.amount);
          const newTotalLoan = new Decimal(p.totalLoan).add(loanAmount);
          const balanceAfter = balanceBefore.add(loanAmount);

          await tx
            .update(participants)
            .set({
              totalLoan: newTotalLoan.toFixed(2),
              currentDebt: balanceAfter.toFixed(2),
            })
            .where(eq(participants.id, input.participantId));

          await tx.insert(transactions).values({
            participantId: input.participantId,
            type: "loan",
            amount: loanAmount.toFixed(2),
            balanceBefore: balanceBefore.toFixed(2),
            balanceAfter: balanceAfter.toFixed(2),
            description: `Empréstimo adicional de R$ ${loanAmount.toFixed(2)}`,
          });

          await tx.insert(auditLog).values({
            participantId: input.participantId,
            participantName: p.name,
            action: "loan_added",
            amount: loanAmount.toFixed(2),
            description: `Empréstimo adicional de R$ ${loanAmount.toFixed(2)}`,
          });

          return { success: true };
        });
      }),

    registerPayment: protectedProcedure
      .input(
        z.object({
          participantId: participantIdSchema,
          month: monthSchema,
          year: z.number().int().min(2020).max(2100),
          idempotencyKey: z.string().uuid().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

        if (input.idempotencyKey) {
          const [existing] = await db
            .select()
            .from(transactions)
            .innerJoin(participants, eq(participants.id, transactions.participantId))
            .where(
              and(
                eq(transactions.idempotencyKey, input.idempotencyKey),
                eq(participants.caixinhaId, caixinha.id)
              )
            )
            .limit(1);

          if (existing) {
            return { success: true };
          }
        }

        return db.transaction(async (tx) => {
          const [p] = await tx
            .select()
            .from(participants)
            .where(
              and(
                eq(participants.id, input.participantId),
                eq(participants.caixinhaId, caixinha.id)
              )
            )
            .for("update")
            .limit(1);

          if (!p) throw new TRPCError({ code: "NOT_FOUND" });

          if (input.idempotencyKey) {
            const [existing] = await tx
              .select()
              .from(transactions)
              .where(eq(transactions.idempotencyKey, input.idempotencyKey))
              .limit(1);

            if (existing) {
              return { success: true };
            }
          }

          const currentDebt = new Decimal(p.currentDebt);
          const { interest, total } = calcMonthlyPayment(currentDebt);

          const existingPayment = await tx
            .select()
            .from(monthlyPayments)
            .where(
              and(
                eq(monthlyPayments.participantId, input.participantId),
                eq(monthlyPayments.month, input.month),
                eq(monthlyPayments.year, input.year)
              )
            )
            .limit(1);

          if (existingPayment.length > 0 && existingPayment[0].paid === true) {
            throw new TRPCError({ code: "CONFLICT", message: "Mês já pago." });
          }

          if (existingPayment.length > 0) {
            await tx
              .update(monthlyPayments)
              .set({ paid: true })
              .where(eq(monthlyPayments.id, existingPayment[0].id));
          } else {
            await tx.insert(monthlyPayments).values({
              participantId: input.participantId,
              month: input.month,
              year: input.year,
              paid: true,
            });
          }

          try {
            await tx.insert(transactions).values({
              participantId: input.participantId,
              type: "payment",
              amount: total.toFixed(2),
              balanceBefore: currentDebt.toFixed(2),
              balanceAfter: currentDebt.toFixed(2),
              month: input.month,
              year: input.year,
              description: `Cota R$ 200,00 + Juros R$ ${interest.toFixed(2)}`,
              idempotencyKey: input.idempotencyKey,
            });
          } catch (e: any) {
            if (e?.errno === 1062) {
              return { success: true };
            }
            throw e;
          }

          await tx.insert(auditLog).values({
            participantId: input.participantId,
            participantName: p.name,
            action: "payment_marked",
            month: input.month,
            year: input.year,
            amount: total.toFixed(2),
            description: `Pagamento registrado: R$ ${total.toFixed(2)}`,
          });

          return { success: true };
        });
      }),

    registerAmortization: protectedProcedure
      .input(
        z.object({
          participantId: participantIdSchema,
          amount: z.coerce.number().positive("Valor deve ser positivo").max(999999.99),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

        return db.transaction(async (tx) => {
          const [p] = await tx
            .select()
            .from(participants)
            .where(
              and(
                eq(participants.id, input.participantId),
                eq(participants.caixinhaId, caixinha.id)
              )
            )
            .for("update")
            .limit(1);

          if (!p) throw new TRPCError({ code: "NOT_FOUND" });

          const currentDebt = new Decimal(p.currentDebt);

          if (new Decimal(input.amount).gt(currentDebt)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Amortização de R$ ${input.amount.toFixed(2)} excede a dívida atual de R$ ${currentDebt.toFixed(2)}.`,
            });
          }

          const amountDecimal = new Decimal(input.amount);
          const balanceAfter = currentDebt.sub(amountDecimal);

          await tx
            .update(participants)
            .set({ currentDebt: balanceAfter.toFixed(2) })
            .where(eq(participants.id, input.participantId));

          await tx.insert(transactions).values({
            participantId: input.participantId,
            type: "amortization",
            amount: amountDecimal.toFixed(2),
            balanceBefore: currentDebt.toFixed(2),
            balanceAfter: balanceAfter.toFixed(2),
            description: `Amortização de R$ ${amountDecimal.toFixed(2)}`,
          });

          await tx.insert(auditLog).values({
            participantId: input.participantId,
            participantName: p.name,
            action: "amortization_added",
            amount: amountDecimal.toFixed(2),
            description: `Dívida reduzida de R$ ${currentDebt.toFixed(2)} para R$ ${balanceAfter.toFixed(2)}`,
          });

          return { success: true };
        });
      }),

    unmarkPayment: protectedProcedure
      .input(
        z.object({
          paymentId: z.number().int().positive(),
          participantId: participantIdSchema,
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

        return db.transaction(async (tx) => {
          const [p] = await tx
            .select()
            .from(participants)
            .where(
              and(
                eq(participants.id, input.participantId),
                eq(participants.caixinhaId, caixinha.id)
              )
            )
            .for("update")
            .limit(1);

          if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Participante não encontrado." });

          const [payment] = await tx
            .select()
            .from(monthlyPayments)
            .where(eq(monthlyPayments.id, input.paymentId))
            .limit(1);

          if (!payment) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado." });
          }

          if (payment.participantId !== input.participantId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Pagamento não pertence ao participante." });
          }

          await tx
            .update(monthlyPayments)
            .set({ paid: false })
            .where(eq(monthlyPayments.id, input.paymentId));

          const [originalTx] = await tx
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.participantId, input.participantId),
                eq(transactions.type, "payment"),
                eq(transactions.month, payment.month),
                eq(transactions.year, payment.year)
              )
            )
            .limit(1);

          if (originalTx) {
            const currentDebt = new Decimal(p.currentDebt);
            const reversalAmount = new Decimal(originalTx.amount).negated();
            await tx.insert(transactions).values({
              participantId: input.participantId,
              type: "reversal",
              amount: reversalAmount.toFixed(2),
              balanceBefore: currentDebt.toFixed(2),
              balanceAfter: currentDebt.toFixed(2),
              month: payment.month,
              year: payment.year,
              description: `Estorno de pagamento: ${payment.month}/${payment.year}`,
            });
          }

          await tx.insert(auditLog).values({
            participantId: input.participantId,
            participantName: p.name,
            action: "payment_unmarked",
            month: payment.month,
            year: payment.year,
            description: `Pagamento de ${payment.month}/${payment.year} desmarcado (estorno gerado)`,
          });

          return { success: true };
        });
      }),

    updateParticipantName: protectedProcedure
      .input(
        z.object({
          participantId: participantIdSchema,
          newName: z.string().min(1).max(255),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
        await getParticipantOrThrow(db, input.participantId, caixinha.id);

        await db
          .update(participants)
          .set({ name: input.newName })
          .where(eq(participants.id, input.participantId));

        return { success: true };
      }),

    deleteParticipant: protectedProcedure
      .input(z.object({ participantId: participantIdSchema }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
        await getParticipantOrThrow(db, input.participantId, caixinha.id);

        return db.transaction(async (tx) => {
          await tx.delete(auditLog).where(eq(auditLog.participantId, input.participantId));
          await tx.delete(monthlyPayments).where(eq(monthlyPayments.participantId, input.participantId));
          await tx.delete(transactions).where(eq(transactions.participantId, input.participantId));
          await tx.delete(participants).where(eq(participants.id, input.participantId));

          return { success: true };
        });
      }),

    resetMonth: protectedProcedure
      .input(
        z.object({
          month: monthSchema,
          year: z.number().int().min(2020).max(2100),
        }).optional()
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

        const now = new Date();
        const month = input?.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const year = input?.year ?? now.getFullYear();

        return db.transaction(async (tx) => {
          const payments = await tx
            .select({ mp: monthlyPayments, participant: participants })
            .from(monthlyPayments)
            .innerJoin(participants, eq(participants.id, monthlyPayments.participantId))
            .where(
              and(
                eq(participants.caixinhaId, caixinha.id),
                eq(monthlyPayments.month, month),
                eq(monthlyPayments.year, year),
                eq(monthlyPayments.paid, true)
              )
            );

          if (payments.length === 0) return { success: true, reset: 0 };

          for (const { mp, participant } of payments) {
            await tx
              .update(monthlyPayments)
              .set({ paid: false })
              .where(eq(monthlyPayments.id, mp.id));

            const [originalTx] = await tx
              .select()
              .from(transactions)
              .where(
                and(
                  eq(transactions.participantId, mp.participantId),
                  eq(transactions.type, "payment"),
                  eq(transactions.month, month),
                  eq(transactions.year, year)
                )
              )
              .limit(1);

            if (originalTx) {
              const currentDebt = new Decimal(participant.currentDebt);
              const reversalAmount = new Decimal(originalTx.amount).negated();
              await tx.insert(transactions).values({
                participantId: mp.participantId,
                type: "reversal",
                amount: reversalAmount.toFixed(2),
                balanceBefore: currentDebt.toFixed(2),
                balanceAfter: currentDebt.toFixed(2),
                month,
                year,
                description: `Estorno de pagamento (reset mês): ${month}/${year}`,
              });
            }

            await tx.insert(auditLog).values({
              participantId: mp.participantId,
              participantName: participant.name,
              action: "payment_unmarked",
              month,
              year,
              description: `Pagamento de ${month}/${year} desmarcado (reset do mês)`,
            });
          }

          return { success: true, reset: payments.length };
        });
      }),

    updateParticipantLoan: protectedProcedure
      .input(
        z.object({
          participantId: participantIdSchema,
          newTotalLoan: z.coerce.number().nonnegative().max(999999.99),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
        await getParticipantOrThrow(db, input.participantId, caixinha.id);

        await db
          .update(participants)
          .set({ totalLoan: new Decimal(input.newTotalLoan).toFixed(2) })
          .where(eq(participants.id, input.participantId));

        return { success: true };
      }),

    updateParticipantDebt: protectedProcedure
      .input(
        z.object({
          participantId: participantIdSchema,
          newCurrentDebt: z.coerce.number().nonnegative().max(999999.99),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);

        return db.transaction(async (tx) => {
          const [p] = await tx
            .select()
            .from(participants)
            .where(
              and(
                eq(participants.id, input.participantId),
                eq(participants.caixinhaId, caixinha.id)
              )
            )
            .for("update")
            .limit(1);

          if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Participante não encontrado." });

          const balanceBefore = new Decimal(p.currentDebt);
          const balanceAfter = new Decimal(input.newCurrentDebt);

          await tx
            .update(participants)
            .set({ currentDebt: balanceAfter.toFixed(2) })
            .where(eq(participants.id, input.participantId));

          await tx.insert(auditLog).values({
            participantId: input.participantId,
            participantName: p.name,
            action: "amortization_added",
            amount: balanceBefore.sub(balanceAfter).abs().toFixed(2),
            description: `Saldo ajustado manualmente: R$ ${balanceBefore.toFixed(2)} → R$ ${balanceAfter.toFixed(2)}`,
          });

          return { success: true };
        });
      }),

    updateParticipantEmail: protectedProcedure
      .input(
        z.object({
          participantId: participantIdSchema,
          email: z.string().email("Email inválido").max(320).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const caixinha = await getCaixinhaOrThrow(db, ctx.user.id);
        await getParticipantOrThrow(db, input.participantId, caixinha.id);

        await db
          .update(participants)
          .set({ email: input.email ?? null })
          .where(eq(participants.id, input.participantId));

        return { success: true };
      }),

  }), // fim caixinha router
}); // fim appRouter

export type AppRouter = typeof appRouter;