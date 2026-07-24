import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/apiAuth";

/**
 * O worker (PC/VPS Windows + MT5) chama aqui para reclamar o próximo job.
 * Claim atômico: marca PENDING → RUNNING garantindo que dois workers não
 * peguem o mesmo job. Protegido por Bearer CRON_SECRET (fail-closed).
 */
export async function POST(req: NextRequest) {
  const unauthorized = checkCronSecret(req);
  if (unauthorized) return unauthorized;

  const { workerId } = (await req.json().catch(() => ({}))) as {
    workerId?: string;
  };

  // Tenta reclamar até 5 candidatos (protege contra corrida entre workers).
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await prisma.job.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!candidate) {
      return NextResponse.json({ job: null }); // fila vazia
    }

    // Claim atômico: só vence quem mudar a linha enquanto ainda estava PENDING.
    const claimed = await prisma.job.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: {
        status: "RUNNING",
        lockedBy: workerId ?? "worker",
        lockedAt: new Date(),
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    if (claimed.count === 1) {
      const job = await prisma.job.findUnique({
        where: { id: candidate.id },
        include: {
          // Def. interna da estratégia pro worker re-rodar a revalidação.
          ea: {
            select: {
              id: true,
              name: true,
              symbol: true,
              timeframe: true,
              style: true,
              exitMode: true,
              strategyDef: true,
            },
          },
        },
      });
      return NextResponse.json({ job });
    }
    // Outro worker pegou primeiro — tenta o próximo.
  }

  return NextResponse.json({ job: null, note: "contention, retry" });
}
