import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// EA chama: GET /api/mt5/watchlist?token=...
// Retorna lista de símbolos para escanear
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token obrigatório" }, { status: 401 });
  const account = await prisma.mT5Account.findUnique({ where: { apiToken: token } });
  if (!account) return NextResponse.json({ error: "token inválido" }, { status: 401 });

  const items = await prisma.watchlist.findMany({
    where: { accountId: account.id, active: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    items: items.map((w) => ({
      id: w.id,
      symbol: w.symbol,
      timeframe: w.timeframe,
      mode: w.mode,
      lastScanAt: w.lastScanAt?.toISOString() ?? null,
    })),
  });
}
