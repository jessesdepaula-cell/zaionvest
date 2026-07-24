import { NextResponse } from "next/server";
import { getCandles } from "@/lib/market/router";
import type { Timeframe } from "@/lib/market/types";
import { getOrCreateUser } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TFS: Timeframe[] = ["M5", "M15", "M30", "H1", "H4", "D1"];

export async function GET(req: Request) {
  // Não é proxy público: exige login (alimenta os gráficos do dashboard).
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol");
  const tfParam = url.searchParams.get("tf") ?? "M15";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 500) || 500, 1000);
  if (!symbol) {
    return NextResponse.json({ error: "symbol obrigatório" }, { status: 400 });
  }
  if (!VALID_TFS.includes(tfParam as Timeframe)) {
    return NextResponse.json({ error: "tf inválido" }, { status: 400 });
  }
  try {
    const candles = await getCandles(symbol, tfParam as Timeframe, limit);
    return NextResponse.json({ symbol, tf: tfParam, candles });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro" },
      { status: 502 },
    );
  }
}
