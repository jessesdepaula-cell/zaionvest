import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanWithAI, type Candle } from "@/lib/aiScan";
import { evaluateOpenSignalsAgainstCandles } from "@/lib/signalTracker";

export const runtime = "nodejs";
export const maxDuration = 60;

// EA chama: POST /api/mt5/scan?token=...
// Body: { watchlistId, symbol, timeframe, mode, candles: [{t,o,h,l,c}] }
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token obrigatório" }, { status: 401 });
  const account = await prisma.mT5Account.findUnique({ where: { apiToken: token } });
  if (!account) return NextResponse.json({ error: "token inválido" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body inválido" }, { status: 400 });

  const symbol = String(body.symbol ?? "").toUpperCase();
  const timeframe = String(body.timeframe ?? "M15");
  const mode = String(body.mode ?? "SMC") as "SMC" | "CLASSICO";
  const watchlistId = body.watchlistId ? String(body.watchlistId) : null;
  const candles = Array.isArray(body.candles) ? (body.candles as Candle[]) : [];
  const htfCandles = Array.isArray(body.htfCandles)
    ? (body.htfCandles as Candle[])
    : [];

  if (!symbol || candles.length < 20) {
    return NextResponse.json({ error: "dados insuficientes" }, { status: 400 });
  }

  // Antes da IA: avalia sinais já abertos do mesmo símbolo contra as novas velas
  // (garante que stops/alvos atingidos entre scans sejam fechados mesmo se o
  // heartbeat não estiver entregando ticks em tempo real).
  let tracked = { filled: 0, won: 0, lost: 0 };
  try {
    tracked = await evaluateOpenSignalsAgainstCandles(account.id, symbol, candles);
  } catch {
    // não interrompe o scan se o tracker falhar
  }

  // chama IA com contexto HTF
  let result;
  let aiError: string | null = null;
  try {
    result = await scanWithAI({ symbol, timeframe, mode, candles, htfCandles });
  } catch (e) {
    aiError = e instanceof Error ? e.message : "erro IA";
    result = {
      hasSetup: false,
      justification: `⚠️ Gráfico atualizado do MT5, mas a análise da IA falhou: ${aiError}. Verifique seus créditos na OpenAI.`
    };
  }

  // sanitize numbers
  const num = (v: unknown): number | null =>
    typeof v === "number" && isFinite(v) ? v : null;

  const signal = await prisma.signal.create({
    data: {
      accountId: account.id,
      symbol,
      timeframe,
      mode,
      hasSetup: !!result.hasSetup,
      direction: result.direction ?? null,
      probability:
        typeof result.probability === "number"
          ? Math.max(0, Math.min(100, Math.round(result.probability)))
          : null,
      confidence: result.confidence ?? null,
      entryPrice: num(result.entryPrice),
      entryZoneLow: num(result.entryZoneLow),
      entryZoneHigh: num(result.entryZoneHigh),
      stopPrice: num(result.stopPrice),
      target1: num(result.target1),
      target2: num(result.target2),
      target3: num(result.target3),
      recommendedTarget:
        result.recommendedTarget && [1, 2, 3].includes(result.recommendedTarget)
          ? result.recommendedTarget
          : null,
      riskReward: result.riskReward ?? null,
      structure: result.structure ?? null,
      justification: result.justification ?? null,
      tipoSetup: result.tipo_setup ?? null,
      checklistSmc:
        mode === "SMC" && result.checklist_smc
          ? (result.checklist_smc as object)
          : undefined,
      checklistClassico:
        mode === "CLASSICO" && result.checklist_classico
          ? (result.checklist_classico as object)
          : undefined,
      status: result.hasSetup ? "PENDING" : "NO_SETUP",
      // Armazena janela maior para permitir pan/zoom no gráfico do dashboard.
      candleData: candles.slice(-3000) as object,
    },
  });

  // update last scan
  if (watchlistId) {
    await prisma.watchlist
      .updateMany({
        where: { id: watchlistId, accountId: account.id },
        data: { lastScanAt: new Date() },
      })
      .catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    signalId: signal.id,
    hasSetup: signal.hasSetup,
    direction: signal.direction,
    entry: signal.entryPrice,
    stop: signal.stopPrice,
    target: signal.target1,
    tracked,
  });
}
