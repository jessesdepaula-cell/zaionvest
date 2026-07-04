import { prisma } from "@/lib/prisma";

/**
 * Track record GLOBAL do sistema (todos os usuários), para exibição pública
 * na landing page. Conta apenas sinais reais gerados pelo scanner que foram
 * FECHADOS (WIN/LOSS) — nada de números inventados: é o histórico auditável
 * que gera confiança em novos assinantes.
 */
export type ModeTrackRecord = {
  mode: "SMC" | "CLASSICO";
  closed: number;
  wins: number;
  losses: number;
  winRate: number; // 0-100
  rTotal: number;
  avgR: number;
  tp1: number;
  tp2: number;
  tp3: number;
  bestWin: number; // maior R já conquistado
  lastWinAt: string | null;
};

export type RecentSignal = {
  symbol: string;
  timeframe: string;
  mode: string;
  direction: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  rMultiple: number | null;
  status: string; // WIN | LOSS
  closedAt: string | null;
};

export type GlobalTrackRecord = {
  smc: ModeTrackRecord;
  classico: ModeTrackRecord;
  totalSignals: number; // todos os sinais com setup já emitidos
  recent: RecentSignal[];
  generatedAt: string;
};

function emptyMode(mode: "SMC" | "CLASSICO"): ModeTrackRecord {
  return {
    mode, closed: 0, wins: 0, losses: 0, winRate: 0, rTotal: 0, avgR: 0,
    tp1: 0, tp2: 0, tp3: 0, bestWin: 0, lastWinAt: null,
  };
}

/** Deriva o nível de alvo atingido para sinais legados sem maxTargetHit. */
function tpLevelOf(s: {
  status: string; direction: string | null; exitPrice: number | null;
  target1: number | null; target2: number | null; target3: number | null;
  maxTargetHit: number | null;
}): number {
  if (s.maxTargetHit && s.maxTargetHit > 0) return Math.min(3, s.maxTargetHit);
  if (s.status !== "WIN") return 0;
  const isBuy = s.direction?.startsWith("COMPRA") ?? true;
  const targets = [s.target1, s.target2, s.target3];
  let lvl = 0;
  if (s.exitPrice !== null) {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t === null) continue;
      const eps = Math.abs(t) * 1e-4;
      if (isBuy ? s.exitPrice >= t - eps : s.exitPrice <= t + eps) lvl = i + 1;
    }
  }
  return lvl > 0 ? lvl : 1;
}

export async function getGlobalTrackRecord(): Promise<GlobalTrackRecord> {
  const [closedSignals, totalSignals, recentRows] = await Promise.all([
    prisma.signal.findMany({
      where: { hasSetup: true, status: { in: ["WIN", "LOSS"] } },
      select: {
        mode: true, status: true, rMultiple: true, maxTargetHit: true,
        direction: true, exitPrice: true, target1: true, target2: true, target3: true,
        closedAt: true,
      },
    }),
    prisma.signal.count({ where: { hasSetup: true } }),
    prisma.signal.findMany({
      where: { hasSetup: true, status: { in: ["WIN", "LOSS"] } },
      orderBy: { closedAt: "desc" },
      take: 10,
      select: {
        symbol: true,
        timeframe: true,
        mode: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        rMultiple: true,
        status: true,
        closedAt: true,
      },
    }),
  ]);

  function calc(mode: "SMC" | "CLASSICO"): ModeTrackRecord {
    const subset = closedSignals.filter((s) => s.mode === mode);
    const wins = subset.filter((s) => s.status === "WIN").length;
    const losses = subset.filter((s) => s.status === "LOSS").length;
    const closed = wins + losses;
    const rTotal = subset.reduce((acc, s) => acc + (s.rMultiple ?? 0), 0);
    const decidedWithTpLvl = subset.map((s) => ({ ...s, lvl: tpLevelOf(s) }));
    const tp1 = decidedWithTpLvl.filter((s) => s.lvl >= 1).length;
    const tp2 = decidedWithTpLvl.filter((s) => s.lvl >= 2).length;
    const tp3 = decidedWithTpLvl.filter((s) => s.lvl >= 3).length;
    const winsSubset = subset.filter((s) => s.status === "WIN");
    const bestWin = winsSubset.reduce((m, s) => Math.max(m, s.rMultiple ?? 0), 0);
    const lastWin = winsSubset
      .filter((s) => s.closedAt)
      .sort((a, b) => (b.closedAt!.getTime() - a.closedAt!.getTime()))[0];
    return {
      mode, closed, wins, losses,
      winRate: closed > 0 ? Math.round((wins / closed) * 1000) / 10 : 0,
      rTotal: Math.round(rTotal * 100) / 100,
      avgR: closed > 0 ? Math.round((rTotal / closed) * 100) / 100 : 0,
      tp1, tp2, tp3,
      bestWin: Math.round(bestWin * 100) / 100,
      lastWinAt: lastWin?.closedAt?.toISOString() ?? null,
    };
  }

  return {
    smc: closedSignals.some((s) => s.mode === "SMC") ? calc("SMC") : emptyMode("SMC"),
    classico: closedSignals.some((s) => s.mode === "CLASSICO") ? calc("CLASSICO") : emptyMode("CLASSICO"),
    totalSignals,
    recent: recentRows.map((r) => ({
      ...r,
      closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    })),
    generatedAt: new Date().toISOString(),
  };
}
