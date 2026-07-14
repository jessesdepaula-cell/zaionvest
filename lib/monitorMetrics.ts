export type PeriodKey = "today" | "week" | "month" | "total" | "custom";

export interface TradeLike {
  closeTime: Date;
  netProfit: number;
  profit: number;
  magic: bigint | number;
}

export interface DetailedTradeLike extends TradeLike {
  openTime: Date;
  symbol: string;
  side: string; // BUY | SELL
  volume: number;
  openPrice: number;
  closePrice: number;
  commission: number;
  swap: number;
}

export interface SnapshotLike {
  ts: Date;
  balance: number;
  equity: number;
}

// Helpers de data puros (sem dependência de date-fns)
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajusta para segunda-feira
  return new Date(date.setDate(diff));
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 3600 * 1000 + 59 * 60000 + 59999);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function subDays(d: Date, n: number): Date {
  return new Date(d.getTime() - n * 24 * 60 * 60 * 1000);
}

function subWeeks(d: Date, n: number): Date {
  return new Date(d.getTime() - n * 7 * 24 * 60 * 60 * 1000);
}

function subMonths(d: Date, n: number): Date {
  const res = new Date(d);
  res.setMonth(res.getMonth() - n);
  return res;
}

function subYears(d: Date, n: number): Date {
  const res = new Date(d);
  res.setFullYear(res.getFullYear() - n);
  return res;
}

function differenceInCalendarDays(d1: Date, d2: Date): number {
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));
}

export function periodStart(period: PeriodKey, custom?: Date): Date | null {
  const now = new Date();
  switch (period) {
    case "today":
      return startOfDay(now);
    case "week":
      return startOfWeek(now);
    case "month":
      return startOfMonth(now);
    case "custom":
      return custom ?? null;
    case "total":
    default:
      return null;
  }
}

export function filterByPeriod<T extends { closeTime: Date } | { ts: Date }>(
  rows: T[],
  start: Date | null,
  end: Date | null = null,
): T[] {
  return rows.filter((r) => {
    const t = (r as { closeTime?: Date }).closeTime ?? (r as { ts?: Date }).ts!;
    if (start && t < start) return false;
    if (end && t > end) return false;
    return true;
  });
}

export function calculateTradePips(t: {
  symbol: string;
  openPrice: number;
  closePrice: number;
  side: string;
}): number {
  const diff =
    t.side.toUpperCase() === "BUY"
      ? t.closePrice - t.openPrice
      : t.openPrice - t.closePrice;
  const symbol = t.symbol.toUpperCase();
  let pipSize = 0.0001;
  if (symbol.includes("JPY")) {
    pipSize = 0.01;
  } else if (symbol.includes("XAU") || symbol.includes("GOLD")) {
    pipSize = 0.1;
  } else if (
    symbol.includes("BRENT") ||
    symbol.includes("WTI") ||
    symbol.includes("OIL")
  ) {
    pipSize = 0.01;
  } else if (
    symbol.includes("BTC") ||
    symbol.includes("ETH") ||
    symbol.includes("XRP")
  ) {
    pipSize = 1.0;
  } else if (
    symbol.includes("US30") ||
    symbol.includes("DE30") ||
    symbol.includes("GER30") ||
    symbol.includes("NAS100") ||
    symbol.includes("SPX500")
  ) {
    pipSize = 1.0;
  }
  return Number((diff / pipSize).toFixed(1));
}

function stdNormalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export interface AdvancedStats {
  trades: number;
  winRate: number;
  lossRate: number;
  pips: number;
  avgWinPips: number;
  avgWinMoney: number;
  avgLossPips: number;
  avgLossMoney: number;
  lots: number;
  commissions: number;
  longsWonCount: number;
  longsTotalCount: number;
  longsWinRate: number;
  shortsWonCount: number;
  shortsTotalCount: number;
  shortsWinRate: number;
  bestTradeMoney: { val: number; date: string } | null;
  worstTradeMoney: { val: number; date: string } | null;
  bestTradePips: { val: number; date: string } | null;
  worstTradePips: { val: number; date: string } | null;
  avgTradeLengthSec: number;
  profitFactor: number;
  stdDev: number;
  sharpeRatio: number;
  zScore: number;
  zProbability: number;
  expectancyMoney: number;
  expectancyPips: number;
  ahpr: number;
  ghpr: number;
}

export function calculateAdvancedStats(
  trades: DetailedTradeLike[],
  initialBalance: number,
): AdvancedStats {
  const total = trades.length;
  if (total === 0) {
    return {
      trades: 0,
      winRate: 0,
      lossRate: 0,
      pips: 0,
      avgWinPips: 0,
      avgWinMoney: 0,
      avgLossPips: 0,
      avgLossMoney: 0,
      lots: 0,
      commissions: 0,
      longsWonCount: 0,
      longsTotalCount: 0,
      longsWinRate: 0,
      shortsWonCount: 0,
      shortsTotalCount: 0,
      shortsWinRate: 0,
      bestTradeMoney: null,
      worstTradeMoney: null,
      bestTradePips: null,
      worstTradePips: null,
      avgTradeLengthSec: 0,
      profitFactor: 0,
      stdDev: 0,
      sharpeRatio: 0,
      zScore: 0,
      zProbability: 0,
      expectancyMoney: 0,
      expectancyPips: 0,
      ahpr: 0,
      ghpr: 0,
    };
  }

  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalPips = 0;
  let winPipsSum = 0;
  let lossPipsSum = 0;
  let totalLots = 0;
  let totalCommissions = 0;

  let longsCount = 0;
  let longsWon = 0;
  let shortsCount = 0;
  let shortsWon = 0;

  let bestMoney = -Infinity;
  let bestMoneyDate = "";
  let worstMoney = Infinity;
  let worstMoneyDate = "";
  let bestPips = -Infinity;
  let bestPipsDate = "";
  let worstPips = Infinity;
  let worstPipsDate = "";

  let totalDurationMs = 0;
  const profits: number[] = [];
  const sequence: boolean[] = [];

  for (const t of trades) {
    const pips = calculateTradePips(t);
    totalPips += pips;
    totalLots += t.volume;
    totalCommissions += t.commission;
    profits.push(t.netProfit);
    sequence.push(t.netProfit >= 0);

    const isLong = t.side.toUpperCase() === "BUY";
    if (isLong) {
      longsCount++;
      if (t.netProfit >= 0) longsWon++;
    } else {
      shortsCount++;
      if (t.netProfit >= 0) shortsWon++;
    }

    if (t.netProfit >= 0) {
      wins++;
      grossProfit += t.netProfit;
      winPipsSum += pips;
    } else {
      losses++;
      grossLoss += t.netProfit; // negative
      lossPipsSum += pips;
    }

    if (t.netProfit > bestMoney) {
      bestMoney = t.netProfit;
      bestMoneyDate = t.closeTime.toISOString();
    }
    if (t.netProfit < worstMoney) {
      worstMoney = t.netProfit;
      worstMoneyDate = t.closeTime.toISOString();
    }
    if (pips > bestPips) {
      bestPips = pips;
      bestPipsDate = t.closeTime.toISOString();
    }
    if (pips < worstPips) {
      worstPips = pips;
      worstPipsDate = t.closeTime.toISOString();
    }

    const duration = t.closeTime.getTime() - t.openTime.getTime();
    totalDurationMs += Math.max(0, duration);
  }

  const winRate = (wins / total) * 100;
  const lossRate = (losses / total) * 100;

  const avgWinPips = wins > 0 ? winPipsSum / wins : 0;
  const avgWinMoney = wins > 0 ? grossProfit / wins : 0;
  const avgLossPips = losses > 0 ? lossPipsSum / losses : 0;
  const avgLossMoney = losses > 0 ? grossLoss / losses : 0;

  const avgTradeLengthSec = totalDurationMs / total / 1000;
  const profitFactor =
    grossLoss !== 0
      ? grossProfit / Math.abs(grossLoss)
      : grossProfit > 0
      ? Infinity
      : 0;

  const meanProfit = profits.reduce((a, b) => a + b, 0) / total;
  const variance =
    total > 1
      ? profits.reduce((a, b) => a + Math.pow(b - meanProfit, 2), 0) /
        (total - 1)
      : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? meanProfit / stdDev : 0;

  let runs = 1;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] !== sequence[i - 1]) runs++;
  }
  const P = 2 * wins * losses;
  let zScore = 0;
  let zProbability = 0;
  if (total > 1 && P > 0) {
    zScore =
      (total * (runs - 0.5) - P) /
      Math.sqrt((P * (P - total)) / (total - 1));
    zProbability = (2 * stdNormalCDF(Math.abs(zScore)) - 1) * 100;
  }

  const expectancyMoney = (winRate / 100) * avgWinMoney + (lossRate / 100) * avgLossMoney;
  const expectancyPips = (winRate / 100) * avgWinPips + (lossRate / 100) * avgLossPips;

  let runningBalance = initialBalance;
  const hprs: number[] = [];
  const sortedTrades = [...trades].sort(
    (a, b) => a.closeTime.getTime() - b.closeTime.getTime(),
  );
  for (const t of sortedTrades) {
    const before = runningBalance;
    runningBalance += t.netProfit;
    if (before > 0) {
      hprs.push(1 + t.netProfit / before);
    } else {
      hprs.push(1);
    }
  }
  const ahpr =
    hprs.length > 0
      ? (hprs.reduce((a, b) => a + b, 0) / hprs.length - 1) * 100
      : 0;
  const ghpr =
    hprs.length > 0
      ? (Math.exp(
          hprs.reduce((sum, h) => sum + Math.log(h > 0 ? h : 1e-8), 0) /
            hprs.length,
        ) -
          1) *
        100
      : 0;

  return {
    trades: total,
    winRate,
    lossRate,
    pips: Number(totalPips.toFixed(1)),
    avgWinPips: Number(avgWinPips.toFixed(1)),
    avgWinMoney: Number(avgWinMoney.toFixed(2)),
    avgLossPips: Number(avgLossPips.toFixed(1)),
    avgLossMoney: Number(avgLossMoney.toFixed(2)),
    lots: Number(totalLots.toFixed(2)),
    commissions: Number(totalCommissions.toFixed(2)),
    longsWonCount: longsWon,
    longsTotalCount: longsCount,
    longsWinRate: longsCount > 0 ? (longsWon / longsCount) * 100 : 0,
    shortsWonCount: shortsWon,
    shortsTotalCount: shortsCount,
    shortsWinRate: shortsCount > 0 ? (shortsWon / shortsCount) * 100 : 0,
    bestTradeMoney: bestMoney !== -Infinity ? { val: bestMoney, date: bestMoneyDate } : null,
    worstTradeMoney: worstMoney !== Infinity ? { val: worstMoney, date: worstMoneyDate } : null,
    bestTradePips: bestPips !== -Infinity ? { val: bestPips, date: bestPipsDate } : null,
    worstTradePips: worstPips !== Infinity ? { val: worstPips, date: worstPipsDate } : null,
    avgTradeLengthSec,
    profitFactor,
    stdDev,
    sharpeRatio,
    zScore: Number(zScore.toFixed(2)),
    zProbability: Number(zProbability.toFixed(2)),
    expectancyMoney: Number(expectancyMoney.toFixed(2)),
    expectancyPips: Number(expectancyPips.toFixed(1)),
    ahpr: Number(ahpr.toFixed(4)),
    ghpr: Number(ghpr.toFixed(4)),
  };
}

export interface PeriodStats {
  gain: number;
  diffGain: number;
  profit: number;
  diffProfit: number;
  pips: number;
  diffPips: number;
  winRate: number;
  diffWinRate: number;
  trades: number;
  diffTrades: number;
  lots: number;
  diffLots: number;
}

export function calculatePeriodsTable(
  trades: DetailedTradeLike[],
  initialBalance: number,
): {
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  year: PeriodStats;
} {
  const now = new Date();

  // Períodos Atuais
  const startToday = startOfDay(now);
  const startWeek = startOfWeek(now);
  const startMonth = startOfMonth(now);
  const startYear = startOfYear(now);

  // Períodos Anteriores
  const startPrevToday = startOfDay(subDays(now, 1));
  const endPrevToday = endOfDay(subDays(now, 1));

  const startPrevWeek = startOfWeek(subWeeks(now, 1));
  const endPrevWeek = endOfWeek(subWeeks(now, 1));

  const startPrevMonth = startOfMonth(subMonths(now, 1));
  const endPrevMonth = endOfMonth(subMonths(now, 1));

  const startPrevYear = startOfYear(subYears(now, 1));
  const endPrevYear = endOfYear(subYears(now, 1));

  const totalProfit = trades.reduce((sum, t) => sum + t.netProfit, 0);
  const currentBalance = initialBalance + totalProfit;

  function getBalanceAtDate(d: Date): number {
    const profitAfter = trades
      .filter((t) => t.closeTime > d)
      .reduce((sum, t) => sum + t.netProfit, 0);
    return currentBalance - profitAfter;
  }

  function getStatsForRange(start: Date, end: Date | null): {
    profit: number;
    pips: number;
    wins: number;
    total: number;
    lots: number;
  } {
    const filtered = trades.filter((t) => {
      if (t.closeTime < start) return false;
      if (end && t.closeTime > end) return false;
      return true;
    });
    let profit = 0;
    let pips = 0;
    let wins = 0;
    let lots = 0;
    for (const t of filtered) {
      profit += t.netProfit;
      pips += calculateTradePips(t);
      lots += t.volume;
      if (t.netProfit >= 0) wins++;
    }
    return {
      profit,
      pips,
      wins,
      total: filtered.length,
      lots,
    };
  }

  function computePeriodStats(
    start: Date,
    end: Date | null,
    startPrev: Date,
    endPrev: Date,
  ): PeriodStats {
    const curr = getStatsForRange(start, end);
    const prev = getStatsForRange(startPrev, endPrev);

    const balanceCurr = getBalanceAtDate(start);
    const balancePrev = getBalanceAtDate(startPrev);

    const gain = balanceCurr > 0 ? (curr.profit / balanceCurr) * 100 : 0;
    const gainPrev = balancePrev > 0 ? (prev.profit / balancePrev) * 100 : 0;

    const winRate = curr.total > 0 ? (curr.wins / curr.total) * 100 : 0;
    const winRatePrev = prev.total > 0 ? (prev.wins / prev.total) * 100 : 0;

    return {
      gain: Number(gain.toFixed(2)),
      diffGain: Number((gain - gainPrev).toFixed(2)),
      profit: Number(curr.profit.toFixed(2)),
      diffProfit: Number((curr.profit - prev.profit).toFixed(2)),
      pips: Number(curr.pips.toFixed(1)),
      diffPips: Number((curr.pips - prev.pips).toFixed(1)),
      winRate: Number(winRate.toFixed(0)),
      diffWinRate: Number((winRate - winRatePrev).toFixed(0)),
      trades: curr.total,
      diffTrades: curr.total - prev.total,
      lots: Number(curr.lots.toFixed(2)),
      diffLots: Number((curr.lots - prev.lots).toFixed(2)),
    };
  }

  return {
    today: computePeriodStats(startToday, null, startPrevToday, endPrevToday),
    week: computePeriodStats(startWeek, null, startPrevWeek, endPrevWeek),
    month: computePeriodStats(startMonth, null, startPrevMonth, endPrevMonth),
    year: computePeriodStats(startYear, null, startPrevYear, endPrevYear),
  };
}

export interface AggregatedMetrics {
  trades: number;
  wins: number;
  losses: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  winRate: number;
  profitFactor: number;
  payoff: number;
  avgWin: number;
  avgLoss: number;
}

export function aggregate(trades: TradeLike[]): AggregatedMetrics {
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netProfit = 0;
  for (const t of trades) {
    netProfit += t.netProfit;
    if (t.netProfit >= 0) {
      wins += 1;
      grossProfit += t.netProfit;
    } else {
      losses += 1;
      grossLoss += t.netProfit; // negative
    }
  }
  const total = trades.length;
  const winRate = total ? (wins / total) * 100 : 0;
  const avgWin = wins ? grossProfit / wins : 0;
  const avgLoss = losses ? Math.abs(grossLoss / losses) : 0;
  const profitFactor =
    grossLoss !== 0
      ? grossProfit / Math.abs(grossLoss)
      : grossProfit > 0
      ? Infinity
      : 0;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  return {
    trades: total,
    wins,
    losses,
    netProfit,
    grossProfit,
    grossLoss,
    winRate,
    profitFactor,
    payoff,
    avgWin,
    avgLoss,
  };
}

export interface DrawdownPoint {
  ts: Date;
  equity: number;
  peak: number;
  ddAbs: number;
  ddPct: number;
}

export function computeDrawdown(snapshots: SnapshotLike[]): {
  series: DrawdownPoint[];
  maxAbs: number;
  maxPct: number;
  currentAbs: number;
  currentPct: number;
} {
  const series: DrawdownPoint[] = [];
  let peak = -Infinity;
  let maxAbs = 0;
  let maxPct = 0;
  for (const s of snapshots) {
    if (s.equity > peak) peak = s.equity;
    const ddAbs = peak - s.equity;
    const ddPct = peak > 0 ? (ddAbs / peak) * 100 : 0;
    if (ddAbs > maxAbs) maxAbs = ddAbs;
    if (ddPct > maxPct) maxPct = ddPct;
    series.push({ ts: s.ts, equity: s.equity, peak, ddAbs, ddPct });
  }
  const last = series[series.length - 1];
  return {
    series,
    maxAbs,
    maxPct,
    currentAbs: last?.ddAbs ?? 0,
    currentPct: last?.ddPct ?? 0,
  };
}

export function returnPct(current: number, initial: number): number {
  if (!initial) return 0;
  return ((current - initial) / initial) * 100;
}

export function daysOperating(firstSnapshotAt: Date | null | undefined): number {
  if (!firstSnapshotAt) return 0;
  return Math.max(1, differenceInCalendarDays(new Date(), firstSnapshotAt) + 1);
}

export function bucketByDay(
  trades: TradeLike[],
): { date: string; profit: number; trades: number }[] {
  const map = new Map<string, { date: string; profit: number; trades: number }>();
  for (const t of trades) {
    const key = t.closeTime.toISOString().slice(0, 10);
    const cur = map.get(key) ?? { date: key, profit: 0, trades: 0 };
    cur.profit += t.netProfit;
    cur.trades += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function bucketByMonth(
  trades: TradeLike[],
): { date: string; profit: number; trades: number }[] {
  const map = new Map<string, { date: string; profit: number; trades: number }>();
  for (const t of trades) {
    const key = t.closeTime.toISOString().slice(0, 7);
    const cur = map.get(key) ?? { date: key, profit: 0, trades: 0 };
    cur.profit += t.netProfit;
    cur.trades += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function bucketByWeek(
  trades: TradeLike[],
): { date: string; profit: number; trades: number }[] {
  const map = new Map<string, { date: string; profit: number; trades: number }>();
  for (const t of trades) {
    const d = startOfWeek(t.closeTime);
    const key = d.toISOString().slice(0, 10);
    const cur = map.get(key) ?? { date: key, profit: 0, trades: 0 };
    cur.profit += t.netProfit;
    cur.trades += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
