import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { enqueueRevalidation } from "@/lib/queue";
import { checkCronSecret } from "@/lib/apiAuth";

/**
 * Cron de revalidação. Enfileira (não executa) a revalidação dos EAs APPROVED
 * cuja cadência venceu. O worker Windows/MT5 consome a fila depois.
 * Protegido por Bearer CRON_SECRET (fail-closed).
 */
export async function GET(req: NextRequest) {
  const unauthorized = checkCronSecret(req);
  if (unauthorized) return unauthorized;

  // Cadência de revalidação (dias). Default: 30.
  const revalidationDays = Number(process.env.REVALIDATION_DAYS ?? "30");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - revalidationDays);

  // EAs aprovados nunca validados, ou cuja última validação passou da cadência.
  const dueEAs = await prisma.eA.findMany({
    where: {
      status: "APPROVED",
      OR: [{ lastValidatedAt: null }, { lastValidatedAt: { lte: cutoff } }],
    },
    select: { id: true, name: true },
  });

  let enqueued = 0;
  let skipped = 0;
  for (const ea of dueEAs) {
    const { created } = await enqueueRevalidation(ea.id);
    if (created) enqueued++;
    else skipped++; // já havia job pendente/rodando
  }

  return NextResponse.json({
    ok: true,
    due: dueEAs.length,
    enqueued,
    skipped,
    cadenceDays: revalidationDays,
    timestamp: new Date().toISOString(),
  });
}
