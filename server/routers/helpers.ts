// server/routers/helpers.ts
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { caixinhaMetadata, participants } from "../../drizzle/schema";

export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Formato inválido. Use "YYYY-MM"');
export const participantIdSchema = z.number().int().positive();

export async function getCaixinhaOrThrow(db: Awaited<ReturnType<typeof getDb>>, userId: number) {
  const [caixinha] = await db
    .select()
    .from(caixinhaMetadata)
    .where(eq(caixinhaMetadata.ownerId, userId))
    .limit(1);

  if (!caixinha) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Caixinha não encontrada para este usuário." });
  }
  return caixinha;
}

export async function getParticipantOrThrow(
  db: Awaited<ReturnType<typeof getDb>>,
  participantId: number,
  caixinhaId: number
) {
  const [p] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.id, participantId), eq(participants.caixinhaId, caixinhaId)))
    .limit(1);

  if (!p) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Participante não encontrado." });
  }
  return p;
}