import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processTicks } from "@/lib/signalTracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// EA envia info da conta + ticks (bid/ask por símbolo).
// Body:
// {
//   account: { number, name, server, company, currency, leverage, balance, equity, margin, freeMargin, marginLevel },
//   ticks: [{ symbol, bid, ask }],
//   pingMs?: number
// }
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token obrigatório" }, { status: 401 });

  const account = await prisma.mT5Account.findUnique({ where: { apiToken: token } });
  if (!account) return NextResponse.json({ error: "token inválido" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body inválido" }, { status: 400 });

  const acc = body.account ?? {};
  const ticks = Array.isArray(body.ticks) ? body.ticks : [];
  const pingMs = typeof body.pingMs === "number" ? Math.round(body.pingMs) : null;

  // Atualiza dados da conta
  await prisma.mT5Account.update({
    where: { id: account.id },
    data: {
      accountNumber: acc.number ? BigInt(acc.number) : undefined,
      accountName: acc.name ?? undefined,
      accountServer: acc.server ?? undefined,
      accountCompany: acc.company ?? undefined,
      accountCurrency: acc.currency ?? undefined,
      leverage: typeof acc.leverage === "number" ? acc.leverage : undefined,
      balance: typeof acc.balance === "number" ? acc.balance : undefined,
      equity: typeof acc.equity === "number" ? acc.equity : undefined,
      margin: typeof acc.margin === "number" ? acc.margin : undefined,
      freeMargin: typeof acc.freeMargin === "number" ? acc.freeMargin : undefined,
      marginLevel: typeof acc.marginLevel === "number" ? acc.marginLevel : undefined,
      pingMs: pingMs ?? undefined,
      lastSeenAt: new Date(),
      connectedAt: account.connectedAt ?? new Date(),
    },
  });

  // Atualiza ticks (upsert por símbolo)
  for (const t of ticks) {
    if (!t.symbol || typeof t.bid !== "number" || typeof t.ask !== "number") continue;
    const symbol = String(t.symbol).toUpperCase();
    const spread = t.ask - t.bid;
    await prisma.marketTick.upsert({
      where: { accountId_symbol: { accountId: account.id, symbol } },
      create: { accountId: account.id, symbol, bid: t.bid, ask: t.ask, spread, updatedAt: new Date() },
      update: { bid: t.bid, ask: t.ask, spread, updatedAt: new Date() },
    });
  }

  // Processa sinais abertos
  const tracked = await processTicks(
    account.id,
    ticks.map((t: { symbol: string; bid: number; ask: number }) => ({
      symbol: t.symbol,
      bid: t.bid,
      ask: t.ask,
    })),
  );

  return NextResponse.json({ ok: true, tracked });
}
