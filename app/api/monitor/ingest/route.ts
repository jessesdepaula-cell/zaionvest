import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { broadcast, EVENTS } from "@/lib/pusher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const positionSchema = z.object({
  ticket: z.union([z.string(), z.number()]),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  volume: z.number(),
  openPrice: z.number(),
  currentPrice: z.number(),
  sl: z.number().nullable().optional(),
  tp: z.number().nullable().optional(),
  openTime: z.string(),
  profit: z.number(),
  swap: z.number().optional().default(0),
  magic: z.union([z.string(), z.number()]).optional().default(0),
  comment: z.string().nullable().optional(),
});

const tradeSchema = z.object({
  ticket: z.union([z.string(), z.number()]),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  volume: z.number(),
  openPrice: z.number(),
  closePrice: z.number(),
  openTime: z.string(),
  closeTime: z.string(),
  profit: z.number(),
  commission: z.number().optional().default(0),
  swap: z.number().optional().default(0),
  magic: z.union([z.string(), z.number()]).optional().default(0),
  comment: z.string().nullable().optional(),
});

const payloadSchema = z.object({
  account: z.object({
    login: z.union([z.string(), z.number()]),
    broker: z.string().nullable().optional(),
    server: z.string().nullable().optional(),
    currency: z.string().optional().default("USD"),
    leverage: z.number().int().optional(),
    balance: z.number(),
    equity: z.number(),
    margin: z.number(),
    freeMargin: z.number(),
    marginLevel: z.number().nullable().optional(),
    floatingPnL: z.number(),
  }),
  positions: z.array(positionSchema).default([]),
  closedTrades: z.array(tradeSchema).default([]),
});

function toBig(v: string | number): bigint {
  return typeof v === "bigint" ? v : BigInt(v as never);
}

export async function POST(req: NextRequest) {
  const got =
    req.headers.get("x-api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!got) {
    return NextResponse.json({ ok: false, error: "missing x-api-key" }, { status: 401 });
  }

  // Valida se a chave de monitoramento (x-api-key) corresponde a um User cadastrado na ZaionVest
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: got },
        { clerkId: got }
      ]
    }
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "invalid api key" }, { status: 401 });
  }

  let json: unknown;
  const rawBody = await req.text();
  try {
    json = JSON.parse(rawBody);
  } catch (err: any) {
    console.error("[Ingest] Invalid JSON payload received:", rawBody, "Error:", err);
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { account, positions, closedTrades } = parsed.data;
  const login = String(account.login);
  const now = new Date();

  // Upsert account; associa ao userId da ZaionVest e captura o initialBalance
  const existing = await prisma.account.findUnique({ where: { login } });
  const acc = existing
    ? await prisma.account.update({
        where: { login },
        data: {
          userId: user.id, // garante a associação correta
          broker: account.broker ?? existing.broker,
          server: account.server ?? existing.server,
          currency: account.currency ?? existing.currency,
          leverage: account.leverage ?? existing.leverage,
        },
      })
    : await prisma.account.create({
        data: {
          userId: user.id,
          login,
          broker: account.broker ?? null,
          server: account.server ?? null,
          currency: account.currency ?? "USD",
          leverage: account.leverage ?? null,
          initialBalance: account.balance,
          initialCapturedAt: now,
        },
      });

  // Snapshot row (granularidade de 1 minuto para otimizar banco de dados)
  const lastSnap = await prisma.snapshot.findFirst({
    where: { accountId: acc.id },
    orderBy: { ts: "desc" },
    select: { ts: true, peakEquity: true },
  });
  const peak = Math.max(lastSnap?.peakEquity ?? 0, account.equity);

  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  if (!lastSnap || lastSnap.ts < oneMinuteAgo) {
    await prisma.snapshot.create({
      data: {
        accountId: acc.id,
        ts: now,
        balance: account.balance,
        equity: account.equity,
        margin: account.margin,
        freeMargin: account.freeMargin,
        marginLevel: account.marginLevel ?? null,
        floatingPnL: account.floatingPnL,
        openPositions: positions.length,
        peakEquity: peak,
      },
    });
  }

  // Limpa as posições antigas e insere as atuais
  await prisma.openPosition.deleteMany({ where: { accountId: acc.id } });
  if (positions.length) {
    await prisma.openPosition.createMany({
      data: positions.map((p) => ({
        accountId: acc.id,
        ticket: toBig(p.ticket),
        symbol: p.symbol,
        side: p.side,
        volume: p.volume,
        openPrice: p.openPrice,
        currentPrice: p.currentPrice,
        sl: p.sl ?? null,
        tp: p.tp ?? null,
        openTime: new Date(p.openTime),
        profit: p.profit,
        swap: p.swap ?? 0,
        magic: toBig(p.magic ?? 0),
        comment: p.comment ?? null,
      })),
      skipDuplicates: true,
    });
  }

  // Insere os trades fechados históricos
  let inserted = 0;
  if (closedTrades.length) {
    const existingTickets = await prisma.monitorTrade.findMany({
      where: { ticket: { in: closedTrades.map((t) => toBig(t.ticket)) } },
      select: { ticket: true },
    });
    const seen = new Set(existingTickets.map((r) => r.ticket.toString()));
    
    for (const t of closedTrades) {
      const ticket = toBig(t.ticket);
      const netProfit = t.profit + (t.commission ?? 0) + (t.swap ?? 0);
      
      await prisma.monitorTrade.upsert({
        where: { ticket },
        update: {},
        create: {
          accountId: acc.id,
          ticket,
          symbol: t.symbol,
          side: t.side,
          volume: t.volume,
          openPrice: t.openPrice,
          closePrice: t.closePrice,
          openTime: new Date(t.openTime),
          closeTime: new Date(t.closeTime),
          profit: t.profit,
          commission: t.commission ?? 0,
          swap: t.swap ?? 0,
          netProfit,
          magic: toBig(t.magic ?? 0),
          comment: t.comment ?? null,
        },
      });
      if (!seen.has(ticket.toString())) inserted++;
    }

    // Atualiza estatísticas agregadas por robô (magic number)
    const grouped = await prisma.monitorTrade.groupBy({
      by: ["magic"],
      where: { accountId: acc.id },
      _count: { _all: true },
      _sum: { netProfit: true },
      _max: { closeTime: true },
    });

    for (const g of grouped) {
      const winLossAgg = await prisma.monitorTrade.aggregate({
        where: { accountId: acc.id, magic: g.magic, netProfit: { gte: 0 } },
        _count: { _all: true },
        _sum: { netProfit: true },
      });
      const lossAgg = await prisma.monitorTrade.aggregate({
        where: { accountId: acc.id, magic: g.magic, netProfit: { lt: 0 } },
        _count: { _all: true },
        _sum: { netProfit: true },
      });

      await prisma.robotMetric.upsert({
        where: { accountId_magic: { accountId: acc.id, magic: g.magic } },
        update: {
          trades: g._count._all,
          wins: winLossAgg._count._all,
          losses: lossAgg._count._all,
          netProfit: g._sum.netProfit ?? 0,
          grossProfit: winLossAgg._sum.netProfit ?? 0,
          grossLoss: lossAgg._sum.netProfit ?? 0,
          lastTradeAt: g._max.closeTime,
        },
        create: {
          accountId: acc.id,
          magic: g.magic,
          trades: g._count._all,
          wins: winLossAgg._count._all,
          losses: lossAgg._count._all,
          netProfit: g._sum.netProfit ?? 0,
          grossProfit: winLossAgg._sum.netProfit ?? 0,
          grossLoss: lossAgg._sum.netProfit ?? 0,
          lastTradeAt: g._max.closeTime,
        },
      });
    }
  }

  void broadcast(EVENTS.snapshot, {
    accountId: acc.id,
    ts: now.toISOString(),
    balance: account.balance,
    equity: account.equity,
    floatingPnL: account.floatingPnL,
    margin: account.margin,
    openPositions: positions.length,
  });

  return NextResponse.json({
    ok: true,
    accountId: acc.id,
    snapshotAt: now.toISOString(),
    insertedTrades: inserted,
    openPositions: positions.length,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST account snapshots here" });
}
