import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Fila de jobs sobre o Postgres. A Vercel só enfileira; o worker Windows/MT5
 * consome via /api/worker/next e devolve o resultado via /api/worker/complete.
 */

export type JobType = "REVALIDATE" | "MINE";

/**
 * Enfileira uma revalidação para um EA. Idempotente: se já existe um job
 * PENDING ou RUNNING de revalidação para o mesmo EA, não cria outro
 * (evita duplicação por retry do cron / duplo clique do admin).
 *
 * @returns o job existente ou o recém-criado, e se foi criado agora.
 */
export async function enqueueRevalidation(eaId: string) {
  const existing = await prisma.job.findFirst({
    where: { eaId, type: "REVALIDATE", status: { in: ["PENDING", "RUNNING"] } },
  });
  if (existing) return { job: existing, created: false };

  const job = await prisma.job.create({
    data: { type: "REVALIDATE", eaId, status: "PENDING" },
  });
  return { job, created: true };
}

/**
 * Enfileira um job de mineração de novas estratégias.
 * payload descreve o escopo (símbolo, timeframe, família base, etc.).
 */
export async function enqueueMining(payload: Prisma.InputJsonValue) {
  const job = await prisma.job.create({
    data: { type: "MINE", status: "PENDING", payloadJson: payload },
  });
  return { job, created: true };
}
