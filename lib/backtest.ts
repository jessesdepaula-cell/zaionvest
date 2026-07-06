import { prisma } from "@/lib/prisma";

export type BacktestMode = "SMC" | "CLASSICO" | "ALL";

export type BacktestPeriod = "7d" | "30d" | "90d" | "all";

export type BacktestStats = {
  totalScans: number;
  detectedSetups: number;
  setupRate: number;
  closed: number;
  wins: number;
  losses: number;
  open: number;
  winRate: number;
  rTotal: number;
  rAvg: number;
  expectancy: number;
  bestTrade: number | null;
  worstTrade: number | null;
};

export type BacktestSignal = {
  id: string;
  scannedAt: Date;
  closedAt: Date | null;
  symbol: string;
  timeframe: string;
  mode: string;
  hasSetup: boolean;
  direction: string | null;
  probability: number | null;
  confidence: string | null;
  status: string;
  rMultiple: number | null;
  entryPrice: number | null;
  stopPrice: number | null;
  exitPrice: number | null;
};

export type EquityPoint = { date: string; cum: number; r: number };

function periodStart(p: BacktestPeriod): Date | null {
  const now = Date.now();
  switch (p) {
    case "7d":
      return new Date(now - 7 * 86400_000);
    case "30d":
      return new Date(now - 30 * 86400_000);
    case "90d":
      return new Date(now - 90 * 86400_000);
    case "all":
      return null;
  }
}

export async function runBacktest(input: {
  userId: string;
  symbol?: string;
  mode: BacktestMode;
  period: BacktestPeriod;
}): Promise<{
  stats: BacktestStats;
  equityCurve: EquityPoint[];
  signals: BacktestSignal[];
  availableSymbols: string[];
}> {
  const since = periodStart(input.period);
  const where: {
    userId: string;
    scannedAt?: { gte: Date };
    mode?: string;
    symbol?: string;
  } = { userId: input.userId };
  if (since) where.scannedAt = { gte: since };
  if (input.mode === "SMC") where.mode = "SMC";
  if (input.mode === "CLASSICO") where.mode = "CLASSICO";
  if (input.symbol) where.symbol = input.symbol;

  const [rawSignals, symbolGroups] = await Promise.all([
    // omit candleData: 2000 linhas com ~500 candles cada estouravam o payload
    prisma.signal.findMany({
      where,
      orderBy: { scannedAt: "desc" },
      take: 2000,
      omit: { candleData: true },
    }),
    prisma.signal.groupBy({
      by: ["symbol"],
      where: { userId: input.userId },
      _count: { _all: true },
      orderBy: { _count: { symbol: "desc" } },
    }),
  ]);

  const availableSymbols = symbolGroups.map((g) => g.symbol);

  const totalScans = rawSignals.length;
  const setupSignals = rawSignals.filter((s) => s.hasSetup);
  const detectedSetups = setupSignals.length;
  const closed = setupSignals.filter(
    (s) => s.status === "WIN" || s.status === "LOSS",
  );
  const wins = closed.filter((s) => s.status === "WIN").length;
  const losses = closed.filter((s) => s.status === "LOSS").length;
  const open = setupSignals.filter(
    (s) => s.status === "PENDING" || s.status === "FILLED",
  ).length;
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

  const rValues = closed
    .map((s) => s.rMultiple ?? 0)
    .filter((r) => isFinite(r));
  const rTotal = rValues.reduce((s, v) => s + v, 0);
  const rAvg = rValues.length > 0 ? rTotal / rValues.length : 0;

  const winsR = closed
    .filter((s) => s.status === "WIN")
    .reduce((acc, s) => acc + (s.rMultiple ?? 0), 0);
  const lossR = closed
    .filter((s) => s.status === "LOSS")
    .reduce((acc, s) => acc + (s.rMultiple ?? 0), 0);
  const avgWin = wins > 0 ? winsR / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(lossR / losses) : 0;
  const winP = wins + losses > 0 ? wins / (wins + losses) : 0;
  const lossP = wins + losses > 0 ? losses / (wins + losses) : 0;
  const expectancy = winP * avgWin - lossP * avgLoss;

  const bestTrade = rValues.length > 0 ? Math.max(...rValues) : null;
  const worstTrade = rValues.length > 0 ? Math.min(...rValues) : null;

  const closedOrdered = closed
    .filter((s) => s.closedAt && s.rMultiple !== null)
    .sort(
      (a, b) =>
        (a.closedAt as Date).getTime() - (b.closedAt as Date).getTime(),
    );
  let cum = 0;
  const equityCurve: EquityPoint[] = closedOrdered.map((s) => {
    const r = s.rMultiple as number;
    cum += r;
    return {
      date: (s.closedAt as Date).toISOString(),
      cum: Number(cum.toFixed(2)),
      r,
    };
  });

  const stats: BacktestStats = {
    totalScans,
    detectedSetups,
    setupRate: totalScans > 0 ? (detectedSetups / totalScans) * 100 : 0,
    closed: closed.length,
    wins,
    losses,
    open,
    winRate,
    rTotal: Number(rTotal.toFixed(2)),
    rAvg: Number(rAvg.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    bestTrade: bestTrade !== null ? Number(bestTrade.toFixed(2)) : null,
    worstTrade: worstTrade !== null ? Number(worstTrade.toFixed(2)) : null,
  };

  const signals: BacktestSignal[] = rawSignals.slice(0, 200).map((s) => ({
    id: s.id,
    scannedAt: s.scannedAt,
    closedAt: s.closedAt,
    symbol: s.symbol,
    timeframe: s.timeframe,
    mode: s.mode,
    hasSetup: s.hasSetup,
    direction: s.direction,
    probability: s.probability,
    confidence: s.confidence,
    status: s.status,
    rMultiple: s.rMultiple,
    entryPrice: s.entryPrice,
    stopPrice: s.stopPrice,
    exitPrice: s.exitPrice,
  }));

  return { stats, equityCurve, signals, availableSymbols };
}
