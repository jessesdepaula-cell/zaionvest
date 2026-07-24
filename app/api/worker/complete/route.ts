import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { sendEARejectedEmail } from "@/lib/email";
import { checkCronSecret } from "@/lib/apiAuth";

/**
 * O worker devolve o resultado de um job aqui. Toda a mutação de estado do EA
 * e as notificações acontecem nesta camada (Vercel/Postgres), não no worker.
 * Protegido por Bearer CRON_SECRET.
 *
 * Body:
 *   { jobId, error }                      → marca job ERROR
 *   { jobId, result: {...} }  (REVALIDATE)→ aplica status + cria EAValidation + notifica
 *   { jobId, result: {...} }  (MINE)      → persiste resultado (criação de EA vem depois)
 *
 * result (REVALIDATE) = { wfe, oosWins, oosTotalWin, approved, reportMd, windowsJson }
 */
type RevalidationResult = {
  wfe: number;
  oosWins: number;
  oosTotalWin: number;
  approved: boolean;
  reportMd?: string;
  windowsJson?: unknown;
};

export async function POST(req: NextRequest) {
  const unauthorized = checkCronSecret(req);
  if (unauthorized) return unauthorized;

  const body = (await req.json().catch(() => null)) as {
    jobId?: string;
    error?: string;
    result?: RevalidationResult;
  } | null;

  if (!body?.jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: body.jobId } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Caso de erro: worker falhou ao processar.
  if (body.error) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "ERROR", error: body.error, finishedAt: new Date() },
    });
    return NextResponse.json({ ok: true, status: "ERROR" });
  }

  const result = body.result;
  if (!result) {
    return NextResponse.json(
      { error: "result or error required" },
      { status: 400 }
    );
  }

  // ── REVALIDATE: aplica o resultado ao EA ──────────────────────────────────
  if (job.type === "REVALIDATE" && job.eaId) {
    const ea = await prisma.eA.findUnique({ where: { id: job.eaId } });
    if (!ea) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "ERROR", error: "EA sumiu", finishedAt: new Date() },
      });
      return NextResponse.json({ error: "EA not found" }, { status: 404 });
    }

    const newStatus = result.approved ? "APPROVED" : "REJECTED";
    const wasApproved = ea.status === "APPROVED";
    const nowRejected = !result.approved;

    await prisma.$transaction([
      prisma.eA.update({
        where: { id: ea.id },
        data: {
          status: newStatus,
          wfe: result.wfe,
          oosWins: result.oosWins,
          oosTotalWindows: result.oosTotalWin,
          lastValidatedAt: new Date(),
        },
      }),
      prisma.eAValidation.create({
        data: {
          eaId: ea.id,
          wfe: result.wfe,
          oosWins: result.oosWins,
          oosTotalWin: result.oosTotalWin,
          approved: result.approved,
          reportMd: result.reportMd,
          windowsJson: result.windowsJson as never,
        },
      }),
      prisma.job.update({
        where: { id: job.id },
        data: {
          status: "DONE",
          resultJson: result as never,
          finishedAt: new Date(),
        },
      }),
    ]);

    // Reprovou agora estando aprovado antes → notifica quem baixou.
    if (wasApproved && nowRejected) {
      const downloads = await prisma.eADownload.findMany({
        where: { eaId: ea.id },
        include: { user: { select: { email: true, name: true } } },
      });
      await Promise.all(
        downloads.map((dl) =>
          sendEARejectedEmail({
            to: dl.user.email,
            userName: dl.user.name ?? "Trader",
            eaName: ea.name,
            eaSymbol: ea.symbol,
            eaTimeframe: ea.timeframe,
          }).catch(() => {})
        )
      );
    }

    return NextResponse.json({
      ok: true,
      status: newStatus,
      notified: wasApproved && nowRejected,
    });
  }

  // ── MINE: persiste o resultado (criação/publicação do EA vem no passo do motor) ──
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: "DONE",
      resultJson: result as never,
      finishedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, status: "DONE", type: job.type });
}
