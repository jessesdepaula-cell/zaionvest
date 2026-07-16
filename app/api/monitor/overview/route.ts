import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  aggregate,
  bucketByDay,
  bucketByMonth,
  bucketByWeek,
  computeDrawdown,
  daysOperating,
  filterByPeriod,
  periodStart,
  calculateAdvancedStats,
  calculatePeriodsTable,
  type DetailedTradeLike,
  type PeriodKey,
} from "@/lib/monitorMetrics";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const period = (url.searchParams.get("period") ?? "total") as PeriodKey;
  const customParam = url.searchParams.get("from");
  const custom = customParam ? new Date(customParam) : undefined;
  
  const publicAccountId = url.searchParams.get("publicAccountId");

  let accounts: any[] = [];
  let userDb: any = null;

  if (publicAccountId) {
    // Requisição pública sem login para uma conta específica
    const targetAcc = await prisma.account.findUnique({
      where: { id: publicAccountId }
    });
    if (!targetAcc) {
      return NextResponse.json({ ok: false, error: "Conta não encontrada" }, { status: 404 });
    }
    accounts = [targetAcc];
  } else {
    // Requisição autenticada do Clerk
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    userDb = await prisma.user.findUnique({
      where: { clerkId }
    });

    if (!userDb) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    accounts = await prisma.account.findMany({
      where: { userId: userDb.id },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (accounts.length === 0) {
    return NextResponse.json({
      ok: true,
      empty: true,
      userMonitorKey: userDb?.id ?? null,
      message: "Sem dados ainda — instale o EA e insira a sua chave de monitoramento.",
    });
  }

  const accountIdParam = url.searchParams.get("accountId");
  const isConsolidated = !publicAccountId && (accountIdParam === "all" || accountIdParam === "consolidated") && accounts.length > 1;

  let targetAccount = accounts.find((a) => a.id === accountIdParam);
  if (!isConsolidated && !targetAccount) {
    targetAccount = accounts[0];
  }

  let snapshots: any[] = [];
  let trades: any[] = [];
  let positions: any[] = [];
  let robots: any[] = [];
  let firstSnap: { ts: Date } | null = null;
  let latestSnap: any = null;

  if (isConsolidated) {
    const accountIds = accounts.map((a) => a.id);
    const [rawSnapshots, rawTrades, rawPositions, rawRobots, rawFirstSnap] =
      await Promise.all([
        prisma.snapshot.findMany({
          where: { accountId: { in: accountIds } },
          orderBy: { ts: "asc" },
          select: { accountId: true, ts: true, balance: true, equity: true, floatingPnL: true, margin: true, openPositions: true },
        }),
        prisma.monitorTrade.findMany({
          where: { accountId: { in: accountIds } },
          orderBy: { closeTime: "asc" },
        }),
        prisma.openPosition.findMany({
          where: { accountId: { in: accountIds } },
          orderBy: { openTime: "asc" },
        }),
        prisma.robotMetric.findMany({
          where: { accountId: { in: accountIds } },
          orderBy: { netProfit: "desc" },
        }),
        prisma.snapshot.findFirst({
          where: { accountId: { in: accountIds } },
          orderBy: { ts: "asc" },
          select: { ts: true },
        }),
      ]);

    trades = rawTrades;
    positions = rawPositions;
    firstSnap = rawFirstSnap;

    robots = rawRobots.map((r) => {
      const acc = accounts.find((a) => a.id === r.accountId);
      return {
        ...r,
        label: r.label
          ? `${r.label} (${acc?.login ?? "Desconhecido"})`
          : `Magic ${r.magic} (${acc?.login ?? "Desconhecido"})`,
      };
    });

    const accountStates: Record<string, { balance: number; equity: number; floatingPnL: number; margin: number; openPositions: number }> = {};
    const consolidatedSnaps: any[] = [];

    for (const snap of rawSnapshots) {
      accountStates[snap.accountId] = {
        balance: snap.balance,
        equity: snap.equity,
        floatingPnL: snap.floatingPnL,
        margin: snap.margin,
        openPositions: snap.openPositions,
      };

      const totalBalance = Object.values(accountStates).reduce((sum, s) => sum + s.balance, 0);
      const totalEquity = Object.values(accountStates).reduce((sum, s) => sum + s.equity, 0);
      const totalFloating = Object.values(accountStates).reduce((sum, s) => sum + s.floatingPnL, 0);
      const totalMargin = Object.values(accountStates).reduce((sum, s) => sum + s.margin, 0);
      const totalOpenPositions = Object.values(accountStates).reduce((sum, s) => sum + s.openPositions, 0);

      consolidatedSnaps.push({
        ts: snap.ts,
        balance: totalBalance,
        equity: totalEquity,
        floatingPnL: totalFloating,
        margin: totalMargin,
        openPositions: totalOpenPositions,
      });
    }

    snapshots = consolidatedSnaps;

    let currentBalance = 0;
    let currentEquity = 0;
    let floating = 0;
    let margin = 0;
    let latestTs: Date | null = null;

    const latestSnapsMap = new Map<string, typeof rawSnapshots[0]>();
    for (const snap of rawSnapshots) {
      const existing = latestSnapsMap.get(snap.accountId);
      if (!existing || snap.ts > existing.ts) {
        latestSnapsMap.set(snap.accountId, snap);
      }
    }

    for (const snap of latestSnapsMap.values()) {
      currentBalance += snap.balance;
      currentEquity += snap.equity;
      floating += snap.floatingPnL;
      margin += snap.margin;
      if (!latestTs || snap.ts > latestTs) {
        latestTs = snap.ts;
      }
    }

    for (const acc of accounts) {
      if (!latestSnapsMap.has(acc.id)) {
        const bal = acc.initialBalance ?? 0;
        currentBalance += bal;
        currentEquity += bal;
      }
    }

    latestSnap = {
      ts: latestTs ?? new Date(),
      balance: currentBalance,
      equity: currentEquity,
      floatingPnL: floating,
      margin,
      openPositions: positions.length,
    };
  } else {
    const acc = targetAccount!;
    const [rawSnapshots, rawTrades, rawPositions, rawRobots, rawFirstSnap, rawLatestSnap] =
      await Promise.all([
        prisma.snapshot.findMany({
          where: { accountId: acc.id },
          orderBy: { ts: "asc" },
          select: { ts: true, balance: true, equity: true, floatingPnL: true, margin: true, openPositions: true },
        }),
        prisma.monitorTrade.findMany({
          where: { accountId: acc.id },
          orderBy: { closeTime: "asc" },
        }),
        prisma.openPosition.findMany({ where: { accountId: acc.id }, orderBy: { openTime: "asc" } }),
        prisma.robotMetric.findMany({ where: { accountId: acc.id }, orderBy: { netProfit: "desc" } }),
        prisma.snapshot.findFirst({ where: { accountId: acc.id }, orderBy: { ts: "asc" }, select: { ts: true } }),
        prisma.snapshot.findFirst({ where: { accountId: acc.id }, orderBy: { ts: "desc" } }),
      ]);

    snapshots = rawSnapshots;
    trades = rawTrades;
    positions = rawPositions;
    robots = rawRobots;
    firstSnap = rawFirstSnap;
    latestSnap = rawLatestSnap;
  }

  const account = isConsolidated
    ? {
        id: "all",
        login: "Consolidado",
        broker: "Todas as Contas",
        server: `${accounts.length} contas`,
        currency: accounts[0]?.currency ?? "USD",
        leverage: null,
        initialBalance: accounts.reduce((sum, a) => sum + (a.initialBalance ?? 0), 0),
        initialCapturedAt: firstSnap?.ts ?? null,
      }
    : targetAccount!;

  const start = periodStart(period, custom);
  const tradesInPeriod = filterByPeriod(trades, start);

  const currentBalance = latestSnap?.balance ?? (account.initialBalance ?? snapshots[0]?.balance ?? 0);
  const totalTradesProfit = trades.reduce((sum, t) => sum + (t.netProfit ?? 0), 0);
  const initial = currentBalance - totalTradesProfit;

  const currentEquity = latestSnap?.equity ?? currentBalance;
  const floating = latestSnap?.floatingPnL ?? 0;
  const margin = latestSnap?.margin ?? 0;

  const detailedTrades = trades as unknown as DetailedTradeLike[];
  const advancedStats = calculateAdvancedStats(detailedTrades, initial);
  const periodsTable = calculatePeriodsTable(detailedTrades, initial);

  const aggTotal = aggregate(trades);
  const aggPeriod = aggregate(tradesInPeriod);

  const aggToday = aggregate(filterByPeriod(trades, periodStart("today")));
  const aggWeek = aggregate(filterByPeriod(trades, periodStart("week")));
  const aggMonth = aggregate(filterByPeriod(trades, periodStart("month")));

  const dd = computeDrawdown(snapshots);

  let highestEquity = initial;
  let highestEquityDate = firstSnap?.ts ?? new Date();
  for (const s of snapshots) {
    if (s.equity > highestEquity) {
      highestEquity = s.equity;
      highestEquityDate = s.ts;
    }
  }
  const totalSwap = trades.reduce((sum, t) => sum + (t.swap ?? 0), 0);

  function downsample<T>(items: T[], maxPoints: number = 300): T[] {
    if (items.length <= maxPoints) return items;
    const step = Math.ceil(items.length / maxPoints);
    const res: T[] = [];
    for (let i = 0; i < items.length; i += step) {
      res.push(items[i]);
    }
    if (res[res.length - 1] !== items[items.length - 1]) {
      res.push(items[items.length - 1]);
    }
    return res;
  }

  const chartStartBalance = initial;
  let runningBalance = chartStartBalance;
  const rawCapital = [
    {
      ts: account.initialCapturedAt ? account.initialCapturedAt.toISOString() : firstSnap?.ts.toISOString() ?? new Date().toISOString(),
      balance: chartStartBalance,
      equity: chartStartBalance,
    },
    ...trades.map((t) => {
      runningBalance += t.netProfit ?? 0;
      return {
        ts: t.closeTime.toISOString(),
        balance: runningBalance,
        equity: runningBalance,
      };
    })
  ];

  if (latestSnap) {
    rawCapital.push({
      ts: latestSnap.ts.toISOString(),
      balance: currentBalance,
      equity: currentEquity,
    });
  }

  const capitalSeries = downsample(rawCapital, 500);
  
  const drawdownSeries = downsample(dd.series, 300).map((p) => ({
    ts: p.ts.toISOString(),
    ddPct: -p.ddPct,
    ddAbs: -p.ddAbs,
  }));

  const dailySeries = bucketByDay(trades);
  const weeklySeries = bucketByWeek(trades);
  const monthlySeries = bucketByMonth(trades);

  const returnSeries = capitalSeries.map((c) => ({
    ts: c.ts,
    returnPct: initial > 0 ? ((c.balance - initial) / initial) * 100 : 0,
  }));

  const totalProfit = aggTotal.netProfit;
  const startBalance = currentBalance - totalProfit;
  const totalReturnPct = startBalance > 0 ? (totalProfit / startBalance) * 100 : 0;

  const startDates = [
    account.initialCapturedAt,
    firstSnap?.ts,
    trades[0]?.openTime,
    trades[0]?.closeTime
  ].filter(Boolean) as Date[];
  const firstDate = startDates.length > 0 ? new Date(Math.min(...startDates.map(d => d.getTime()))) : new Date();
  const days = daysOperating(firstDate);

  const compoundedDailyReturnPct = days > 0 ? (Math.pow(Math.max(0.0001, 1 + totalReturnPct / 100), 1 / days) - 1) * 100 : 0;

  let averageMonthlyReturnPct = 0;
  if (trades.length > 0) {
    const monthsMap = new Map<string, typeof trades>();
    for (const t of trades) {
      const key = t.closeTime.toISOString().slice(0, 7);
      const list = monthsMap.get(key) ?? [];
      list.push(t);
      monthsMap.set(key, list);
    }
    
    const returns: number[] = [];
    for (const [monthKey, monthTrades] of monthsMap.entries()) {
      const startOfMonth = new Date(monthKey + "-01T00:00:00.000Z");
      const profitsAfterStart = trades
        .filter((t) => t.closeTime >= startOfMonth)
        .reduce((sum, t) => sum + (t.netProfit ?? 0), 0);
      
      const balanceAtStart = currentBalance - profitsAfterStart;
      const monthProfit = monthTrades.reduce((sum, t) => sum + (t.netProfit ?? 0), 0);
      
      const monthReturn = balanceAtStart > 0 ? (monthProfit / balanceAtStart) * 100 : 0;
      returns.push(monthReturn);
    }
    averageMonthlyReturnPct = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  } else {
    averageMonthlyReturnPct = totalReturnPct;
  }

  const todayProfit = aggToday.netProfit;
  const weekProfit = aggWeek.netProfit;
  const monthProfit = aggMonth.netProfit;

  const todayStartBalance = currentBalance - todayProfit;
  const weekStartBalance = currentBalance - weekProfit;
  const monthStartBalance = currentBalance - monthProfit;

  const todayReturnPct = todayStartBalance > 0 ? (todayProfit / todayStartBalance) * 100 : 0;
  const weekReturnPct = weekStartBalance > 0 ? (weekProfit / weekStartBalance) * 100 : 0;
  const monthReturnPct = monthStartBalance > 0 ? (monthProfit / monthStartBalance) * 100 : 0;

  return NextResponse.json(
    serialize({
      ok: true,
      userMonitorKey: userDb?.id ?? null,
      accounts: accounts.map((a) => ({
        id: a.id,
        login: a.login,
        broker: a.broker,
        server: a.server,
      })),
      account: {
        id: account.id,
        login: account.login,
        broker: account.broker,
        server: account.server,
        currency: account.currency,
        leverage: account.leverage,
        initialBalance: initial,
        initialCapturedAt: account.initialCapturedAt,
      },
      live: {
        balance: currentBalance,
        equity: currentEquity,
        floatingPnL: floating,
        margin,
        openPositions: positions.length,
        ts: latestSnap?.ts ?? null,
      },
      kpis: {
        initialBalance: initial,
        currentCapital: currentEquity,
        balance: currentBalance,
        equity: currentEquity,
        totalProfit,
        totalReturnPct,
        todayProfit,
        todayReturnPct,
        weekProfit,
        weekReturnPct,
        monthProfit,
        monthReturnPct,
        openValue: positions.reduce((s, p) => s + p.openPrice * p.volume, 0),
        floatingPnL: floating,
        openPositions: positions.length,
        closedPositions: aggTotal.trades,
        totalOperations: aggTotal.trades + positions.length,
        wins: aggTotal.wins,
        losses: aggTotal.losses,
        winRate: aggTotal.winRate,
        profitFactor: aggTotal.profitFactor,
        payoff: aggTotal.payoff,
        currentDrawdownAbs: dd.currentAbs,
        currentDrawdownPct: dd.currentPct,
        maxDrawdownAbs: dd.maxAbs,
        maxDrawdownPct: dd.maxPct,
        daysOperating: days,
        activeRobots: robots.filter((r) => r.trades > 0).length,
        marginUsed: margin,
        exposure: positions.reduce((s, p) => s + p.openPrice * p.volume, 0),
        highestEquity: {
          val: highestEquity,
          date: highestEquityDate.toISOString(),
        },
        interest: totalSwap,
        compoundedDailyReturnPct,
        averageMonthlyReturnPct,
      },
      period: {
        key: period,
        from: start,
        ...aggPeriod,
      },
      series: {
        capital: capitalSeries,
        drawdown: drawdownSeries,
        daily: dailySeries,
        weekly: weeklySeries,
        monthly: monthlySeries,
        returnPct: returnSeries,
      },
      robots,
      positions,
      trades: trades.slice(-100).reverse(),
      advancedStats,
      periodsTable,
    }),
  );
}
