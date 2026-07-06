import { NextResponse } from "next/server";
import { scanAllActiveForUser } from "@/lib/scan/orchestrator";
import { getSignalSourceUserId } from "@/lib/subscription";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel Cron / pg_cron: roda a cada 10-15 min.
// Usa header `Authorization: Bearer ${CRON_SECRET}`.
//
// SINAIS GLOBAIS: o scan roda UMA vez, na conta mestra (dono). Todos os
// assinantes leem esses mesmos sinais — sem varredura duplicada por usuário.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourceId = await getSignalSourceUserId();
  if (!sourceId) {
    return NextResponse.json(
      { ok: false, error: "Conta mestra (dono) não encontrada — nenhum sinal gerado." },
      { status: 200 },
    );
  }

  try {
    const results = await scanAllActiveForUser(sourceId);
    return NextResponse.json({
      ok: true,
      source: sourceId,
      scanned: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      details: results,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
