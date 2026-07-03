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
  return { mode, closed: 0, wins: 0, losses: 0, winRate: 0, rTotal: 0, avgR: 0 };
}

export async function getGlobalTrackRecord(): Promise<GlobalTrackRecord> {
  const [closedSignals, totalSignals, recentRows] = await Promise.all([
    prisma.signal.findMany({
      where: { hasSetup: true, status: { in: ["WIN", "LOSS"] } },
      select: { mode: true, status: true, rMultiple: true },
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
    return {
      mode,
      closed,
      wins,
      losses,
      winRate: closed > 0 ? Math.round((wins / closed) * 1000) / 10 : 0,
      rTotal: Math.round(rTotal * 100) / 100,
      avgR: closed > 0 ? Math.round((rTotal / closed) * 100) / 100 : 0,
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
