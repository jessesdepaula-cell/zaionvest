import { NextResponse } from "next/server";
import { requireActiveSubscription } from "@/lib/subscription";
import { scanAllActiveForUser, scanWatchlistItem } from "@/lib/scan/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/scan/run
// Body opcional: { watchlistId } → scan apenas desse item
// Sem body → scan de toda a watchlist ativa do usuário
export async function POST(req: Request) {
  // Scan roda o motor de IA (custa OpenAI/Gemini) — exige assinatura ativa, não
  // só login. Um usuário inativo não pode disparar scans pagos.
  const sub = await requireActiveSubscription();
  if (!sub.ok) {
    return NextResponse.json(
      { error: sub.reason === "unauthenticated" ? "Não autenticado" : "Assinatura inativa" },
      { status: sub.reason === "unauthenticated" ? 401 : 402 },
    );
  }
  const user = sub.user;

  const body = (await req.json().catch(() => null)) as
    | { watchlistId?: string; listOnly?: boolean }
    | null;

  if (body?.listOnly) {
    const { prisma } = await import("@/lib/prisma");
    const list = await prisma.watchlist.findMany({
      where: { userId: user.id, active: true },
      select: { id: true, symbol: true, timeframe: true, mode: true },
    });
    return NextResponse.json({ ok: true, items: list });
  }

  if (body?.watchlistId) {
    const { prisma } = await import("@/lib/prisma");
    const w = await prisma.watchlist.findFirst({
      where: { id: body.watchlistId, userId: user.id },
    });
    if (!w) {
      return NextResponse.json({ error: "Watchlist não encontrada" }, { status: 404 });
    }
    const r = await scanWatchlistItem({
      userId: user.id,
      watchlistId: w.id,
      symbol: w.symbol,
      timeframe: w.timeframe,
      mode: w.mode as "SMC" | "CLASSICO",
    });
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }

  const results = await scanAllActiveForUser(user.id);
  return NextResponse.json({ ok: true, results });
}
