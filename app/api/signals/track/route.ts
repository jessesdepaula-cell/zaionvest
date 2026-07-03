import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { evaluateOpenSignalsAgainstCandles } from "@/lib/signalTracker";
import { getCandles } from "@/lib/market/router";
import type { Timeframe } from "@/lib/market/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_TFS = ["M5", "M15", "M30", "H1", "H4", "D1"];

/**
 * POST /api/signals/track
 * Avalia os sinais ABERTOS (PENDING/FILLED) do usuário contra as velas mais
 * recentes, SEM rodar IA nem criar sinais novos. Barato (usa o cache de candles
 * do router) — chamado pelo AutoRefresh a cada 30s para que o status
 * (Aguardando → Em execução → Ganho/Perda) acompanhe o mercado em quase
 * tempo real, em vez de esperar o próximo scan de 15 minutos.
 */
export async function POST() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Pares distintos (símbolo, timeframe) com sinais abertos
  const open = await prisma.signal.findMany({
    where: { userId: user.id, status: { in: ["PENDING", "FILLED"] }, hasSetup: true },
    select: { symbol: true, timeframe: true },
    distinct: ["symbol", "timeframe"],
  });

  if (open.length === 0) {
    return NextResponse.json({ ok: true, tracked: 0, filled: 0, won: 0, lost: 0 });
  }

  let filled = 0;
  let won = 0;
  let lost = 0;

  for (const { symbol, timeframe } of open) {
    const tf = (VALID_TFS.includes(timeframe) ? timeframe : "M15") as Timeframe;
    try {
      const candles = await getCandles(symbol, tf, 300);
      const r = await evaluateOpenSignalsAgainstCandles(
        user.id,
        symbol,
        candles as { t: number; o: number; h: number; l: number; c: number }[],
      );
      filled += r.filled;
      won += r.won;
      lost += r.lost;
    } catch (e) {
      console.warn(
        `[track] falha ao avaliar ${symbol}/${tf}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  return NextResponse.json({ ok: true, tracked: open.length, filled, won, lost });
}
