import { Activity, Crosshair, TrendingDown, TrendingUp } from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { EquityCurve, type EquityPoint } from "@/components/dashboard/EquityCurve";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { PerformanceHeatmap, type TradePoint } from "@/components/dashboard/PerformanceHeatmap";
import { ModeAccuracyMeter } from "@/components/dashboard/ModeAccuracyMeter";
import { getModeStats } from "@/lib/modeStats";
import { SignalHistoryTable, type SignalHistoryItem } from "@/components/dashboard/SignalHistoryTable";

export const dynamic = "force-dynamic";

type Mode = "CLASSICO" | "SMC";

type Stats = {
  total: number;
  wins: number;
  losses: number;
  breakeven: number;
  open: number;
  winRate: number;
  totalR: number;
  avgR: number;
  pnlSum: number;
};

function calcStats(trades: { outcome: string; rMultiple: number | null; pnlAmount: number | null }[]): Stats {
  const closed = trades.filter((t) => t.outcome !== "OPEN");
  const wins = closed.filter((t) => t.outcome === "WIN").length;
  const losses = closed.filter((t) => t.outcome === "LOSS").length;
  const breakeven = closed.filter((t) => t.outcome === "BREAKEVEN").length;
  const open = trades.filter((t) => t.outcome === "OPEN").length;
  const total = closed.length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const totalR = closed.reduce((s, t) => s + (t.rMultiple ?? 0), 0);
  const avgR = total > 0 ? totalR / total : 0;
  const pnlSum = closed.reduce((s, t) => s + (t.pnlAmount ?? 0), 0);
  return { total, wins, losses, breakeven, open, winRate, totalR, avgR, pnlSum };
}

function buildSeries(
  trades: { rMultiple: number | null; closedAt: Date | null }[],
): EquityPoint[] {
  let cum = 0;
  return trades
    .filter((t) => t.closedAt && t.rMultiple !== null)
    .sort(
      (a, b) =>
        (a.closedAt as Date).getTime() - (b.closedAt as Date).getTime(),
    )
    .map((t) => {
      cum += t.rMultiple as number;
      return {
        date: (t.closedAt as Date).toISOString(),
        cum: Number(cum.toFixed(2)),
        r: t.rMultiple as number,
      };
    });
}

function periodToDate(p?: string | null): Date | null {
  if (!p || p === "all") return null;
  const now = new Date();
  if (p === "7d") return new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  if (p === "30d") return new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  if (p === "ytd") return new Date(now.getFullYear(), 0, 1);
  return null;
}

export default async function EstatisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const user = await getOrCreateUser();
  if (!user) return null;

  const params = await searchParams;
  const periodo = params?.periodo ?? "all";
  const since = periodToDate(periodo);

  const where = {
    userId: user.id,
    ...(since ? { OR: [{ closedAt: { gte: since } }, { openedAt: { gte: since } }] } : {}),
  };

  const all = await prisma.trade.findMany({
    where,
    select: {
      mode: true,
      outcome: true,
      rMultiple: true,
      pnlAmount: true,
      closedAt: true,
    },
  });

  // Histórico de sinais da IA (apenas com setup detectado)
  const signalWhere = {
    userId: user.id,
    hasSetup: true,
    ...(since ? { scannedAt: { gte: since } } : {}),
  };
  const signalHistory = await prisma.signal.findMany({
    where: signalWhere,
    orderBy: { scannedAt: "desc" },
    take: 300,
    select: {
      id: true,
      symbol: true,
      timeframe: true,
      mode: true,
      direction: true,
      entryPrice: true,
      stopPrice: true,
      target1: true,
      riskReward: true,
      rMultiple: true,
      status: true,
      tipoSetup: true,
      scannedAt: true,
    },
  });

  const signalHistoryItems: SignalHistoryItem[] = signalHistory.map((s) => ({
    id: s.id,
    symbol: s.symbol,
    timeframe: s.timeframe,
    mode: s.mode,
    direction: s.direction,
    entryPrice: s.entryPrice,
    stopPrice: s.stopPrice,
    target1: s.target1,
    riskReward: s.riskReward,
    rMultiple: s.rMultiple,
    status: s.status,
    tipoSetup: s.tipoSetup,
    scannedAt: s.scannedAt.toISOString(),
  }));

  const overall = calcStats(all);
  const smc = calcStats(all.filter((t) => t.mode === "SMC"));
  const classico = calcStats(all.filter((t) => t.mode === "CLASSICO"));

  const seriesAll = buildSeries(all);
  const seriesSmc = buildSeries(all.filter((t) => t.mode === "SMC"));
  const seriesClassico = buildSeries(all.filter((t) => t.mode === "CLASSICO"));

  const modeStats = await getModeStats(user.id);

  const heatmapTrades: TradePoint[] = all
    .filter((t) => t.closedAt && t.rMultiple !== null && t.outcome !== "OPEN")
    .map((t) => ({
      closedAt: (t.closedAt as Date).toISOString(),
      rMultiple: t.rMultiple as number,
      outcome: t.outcome as "WIN" | "LOSS" | "BREAKEVEN",
    }));

  const winner =
    smc.totalR > classico.totalR
      ? "SMC"
      : classico.totalR > smc.totalR
        ? "Clássico"
        : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estatísticas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Performance consolidada e comparativo entre os modos de análise.
          </p>
        </div>
        <PeriodFilter />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500">Assertividade por modo</h2>
        <ModeAccuracyMeter smc={modeStats.smc} classico={modeStats.classico} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500">Visão geral</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard label="Trades fechados" value={overall.total.toString()} icon={<Activity className="h-3.5 w-3.5" />} />
          <KpiCard label="R acumulado" value={`${overall.totalR >= 0 ? "+" : ""}${overall.totalR.toFixed(2)}R`} tone={overall.totalR >= 0 ? "emerald" : "rose"} />
          <KpiCard label="P&L total" value={formatPnl(overall.pnlSum)} tone={overall.pnlSum >= 0 ? "emerald" : "rose"} />
        </div>
      </section>

      <section className="mb-8">
        <EquityCurve
          series={[
            { name: "Total", color: "#F5F5F7", points: seriesAll },
            { name: "SMC", color: "#10B981", points: seriesSmc },
            { name: "Clássico", color: "#F59E0B", points: seriesClassico },
          ]}
        />
      </section>

      <section className="mb-8">
        <PerformanceHeatmap trades={heatmapTrades} />
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Comparativo por modo</h2>
          {winner && overall.total >= 5 && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-1 text-[10px] uppercase tracking-widest text-emerald-300">
              <Crosshair className="h-3 w-3" />
              {winner} é mais lucrativo
            </span>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ModeCard mode="SMC" stats={smc} />
          <ModeCard mode="CLASSICO" stats={classico} />
        </div>
      </section>

      {overall.total === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-zinc-400">
          Sem trades fechados no período selecionado. Catalogue suas operações no{" "}
          <a href="/dashboard/diario" className="text-emerald-400 underline-offset-2 hover:underline">
            Diário
          </a>{" "}
          para começar a medir.
        </div>
      )}

      {/* ─── HISTÓRICO DE SINAIS DA IA ─── */}
      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Histórico de sinais com setup</h2>
            <p className="mt-0.5 text-[11px] text-zinc-600">Sinais gerados pela IA com plano de trade (Entrada / Stop / Alvo)</p>
          </div>
        </div>
        {signalHistoryItems.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-sm text-zinc-500">
            Nenhum sinal com setup detectado no período selecionado.
            <p className="mt-1 text-xs text-zinc-600">Os sinais aparecem aqui após a IA identificar uma confluência válida na sua watchlist.</p>
          </div>
        ) : (
          <SignalHistoryTable signals={signalHistoryItems} />
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "rose";
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "num mt-2 text-2xl font-medium tabular-nums",
          tone === "emerald" && "text-emerald-400",
          tone === "rose" && "text-rose-400",
          tone === "default" && "text-offwhite",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ModeCard({ mode, stats }: { mode: Mode; stats: Stats }) {
  const label = mode === "SMC" ? "SMC" : "Clássico";
  const positive = stats.totalR >= 0;
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Modo</div>
          <div className="mt-1 text-lg font-semibold tracking-tight">{label}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">R acumulado</div>
          <div className={cn("num mt-1 text-2xl font-medium", positive ? "text-emerald-400" : "text-rose-400")}>
            {positive && stats.totalR > 0 ? "+" : ""}
            {stats.totalR.toFixed(2)}R
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
        <Mini label="Trades" value={stats.total.toString()} />
        <Mini label="Média R" value={`${stats.avgR >= 0 ? "+" : ""}${stats.avgR.toFixed(2)}`} tone={stats.avgR >= 0 ? "emerald" : "rose"} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Tile icon={<TrendingUp className="h-3 w-3" />} label="Ganhos" value={stats.wins} tone="emerald" />
        <Tile icon={<TrendingDown className="h-3 w-3" />} label="Perdas" value={stats.losses} tone="rose" />
        <Tile icon={<Activity className="h-3 w-3" />} label="Abertos" value={stats.open} tone="amber" />
      </div>

      <div className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-400">
        P&L: <span className={cn("num", stats.pnlSum > 0 ? "text-emerald-400" : stats.pnlSum < 0 ? "text-rose-400" : "text-zinc-400")}>{formatPnl(stats.pnlSum)}</span>
      </div>
    </div>
  );
}

function Mini({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "emerald" | "rose" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div
        className={cn(
          "num mt-0.5 text-base font-medium",
          tone === "emerald" && "text-emerald-400",
          tone === "rose" && "text-rose-400",
          tone === "default" && "text-offwhite",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "rose" | "amber";
}) {
  const cls = {
    emerald: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300",
    rose: "border-rose-500/20 bg-rose-500/[0.05] text-rose-300",
    amber: "border-amber-500/20 bg-amber-500/[0.05] text-amber-300",
  }[tone];
  return (
    <div className={cn("rounded-md border px-2 py-2", cls)}>
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest opacity-80">
        {icon}
        {label}
      </div>
      <div className="num mt-1 text-base font-medium">{value}</div>
    </div>
  );
}

function formatPnl(n: number): string {
  if (n === 0) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
