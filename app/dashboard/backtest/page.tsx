import {
  Activity,
  Crosshair,
  FlaskConical,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import {
  runBacktest,
  type BacktestMode,
  type BacktestPeriod,
} from "@/lib/backtest";
import { EquityCurve } from "@/components/dashboard/EquityCurve";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BacktestPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; mode?: string; periodo?: string }>;
}) {
  const user = await getOrCreateUser();
  if (!user) return null;

  const params = await searchParams;
  const symbol = params?.symbol;
  const mode = (params?.mode ?? "ALL") as BacktestMode;
  const periodo = (params?.periodo ?? "30d") as BacktestPeriod;

  const result = await runBacktest({
    userId: user.id,
    symbol,
    mode,
    period: periodo,
  });

  const { stats, signals, availableSymbols, equityCurve } = result;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-emerald-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Backtest</h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400">
              {periodLabel(periodo)}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Performance histórica do scanner contra os dados do seu banco. Use pra calibrar
            quais ativos e qual modo te dão mais R.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-8 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <FilterRow label="Ativo">
          <FilterPill href={buildHref({ mode, periodo })} active={!symbol} label="Todos" />
          {availableSymbols.slice(0, 12).map((s) => (
            <FilterPill
              key={s}
              href={buildHref({ symbol: s, mode, periodo })}
              active={symbol === s}
              label={s}
            />
          ))}
        </FilterRow>

        <FilterRow label="Modo">
          <FilterPill
            href={buildHref({ symbol, mode: "ALL", periodo })}
            active={mode === "ALL"}
            label="Todos"
          />
          <FilterPill
            href={buildHref({ symbol, mode: "SMC", periodo })}
            active={mode === "SMC"}
            label="SMC"
            tone="emerald"
          />
          <FilterPill
            href={buildHref({ symbol, mode: "CLASSICO", periodo })}
            active={mode === "CLASSICO"}
            label="Clássico"
            tone="amber"
          />
        </FilterRow>

        <FilterRow label="Período">
          <FilterPill
            href={buildHref({ symbol, mode, periodo: "7d" })}
            active={periodo === "7d"}
            label="7 dias"
          />
          <FilterPill
            href={buildHref({ symbol, mode, periodo: "30d" })}
            active={periodo === "30d"}
            label="30 dias"
          />
          <FilterPill
            href={buildHref({ symbol, mode, periodo: "90d" })}
            active={periodo === "90d"}
            label="90 dias"
          />
          <FilterPill
            href={buildHref({ symbol, mode, periodo: "all" })}
            active={periodo === "all"}
            label="Tudo"
          />
        </FilterRow>
      </div>

      {/* KPIs */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi
          label="Scans"
          value={stats.totalScans}
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <Kpi
          label="Setups detectados"
          value={`${stats.detectedSetups} (${stats.setupRate.toFixed(0)}%)`}
        />
        <Kpi
          label="R acumulado"
          value={`${stats.rTotal >= 0 ? "+" : ""}${stats.rTotal.toFixed(2)}R`}
          tone={stats.rTotal >= 0 ? "emerald" : "rose"}
        />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Ganhos" value={stats.wins} tone="emerald" />
        <Kpi label="Perdas" value={stats.losses} tone="rose" />
        <Kpi
          label="Expectativa"
          value={`${stats.expectancy >= 0 ? "+" : ""}${stats.expectancy.toFixed(2)}R/trade`}
          tone={stats.expectancy >= 0 ? "emerald" : "rose"}
        />
        <Kpi
          label="Melhor / Pior"
          value={
            stats.bestTrade !== null && stats.worstTrade !== null
              ? `+${stats.bestTrade.toFixed(2)} / ${stats.worstTrade.toFixed(2)}`
              : "—"
          }
        />
      </section>

      {/* Equity curve */}
      <section className="mb-8">
        <EquityCurve
          series={[
            {
              name: mode === "ALL" ? "Todos modos" : mode === "SMC" ? "SMC" : "Clássico",
              color:
                mode === "SMC" ? "#10B981" : mode === "CLASSICO" ? "#F59E0B" : "#F5F5F7",
              points: equityCurve,
            },
          ]}
        />
      </section>

      {/* Tabela de sinais */}
      {signals.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-sm text-zinc-400">
          Sem sinais nesse filtro. O backtest aparece quando o EA produzir scans
          suficientes no período selecionado.
        </div>
      ) : (
        <section className="glass overflow-hidden rounded-xl">
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px_60px] items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-500">
            <span>Sinal</span>
            <span>Prob.</span>
            <span>Conf.</span>
            <span>R</span>
            <span>Status</span>
            <span>Quando</span>
          </div>
          <div className="divide-y divide-white/5">
            {signals.map((s) => (
              <SignalRow key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SignalRow({
  s,
}: {
  s: {
    id: string;
    symbol: string;
    timeframe: string;
    mode: string;
    hasSetup: boolean;
    direction: string | null;
    probability: number | null;
    confidence: string | null;
    status: string;
    rMultiple: number | null;
    scannedAt: Date;
  };
}) {
  const dirMeta = (() => {
    if (!s.direction) return { label: "—", color: "text-zinc-400" };
    if (s.direction.startsWith("COMPRA")) return { label: "Compra", color: "text-emerald-300" };
    if (s.direction.startsWith("VENDA")) return { label: "Venda", color: "text-rose-300" };
    return { label: "Neutro", color: "text-zinc-400" };
  })();
  const statusMeta = statusBadge(s.status, s.hasSetup);

  return (
    <div className="grid grid-cols-[1fr_80px_80px_80px_80px_60px] items-center gap-2 px-4 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="num text-sm text-offwhite">{s.symbol}</span>
        <span className="num text-[10px] text-zinc-500">· {s.timeframe}</span>
        <span
          className={cn(
            "rounded-sm border px-1 py-0.5 text-[9px] uppercase tracking-widest",
            s.mode === "SMC"
              ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300"
              : "border-amber-500/30 bg-amber-500/[0.06] text-amber-300",
          )}
        >
          {s.mode === "SMC" ? "SMC" : "Clássico"}
        </span>
        <span className={cn("text-xs font-medium", dirMeta.color)}>
          {dirMeta.label}
        </span>
      </div>
      <span className="num text-zinc-200">
        {s.probability !== null ? `${s.probability}%` : "—"}
      </span>
      <span className="num text-zinc-300">{s.confidence ?? "—"}</span>
      <span
        className={cn(
          "num font-medium",
          s.rMultiple !== null && s.rMultiple > 0
            ? "text-emerald-400"
            : s.rMultiple !== null && s.rMultiple < 0
              ? "text-rose-400"
              : "text-zinc-400",
        )}
      >
        {s.rMultiple !== null
          ? `${s.rMultiple > 0 ? "+" : ""}${s.rMultiple.toFixed(2)}R`
          : "—"}
      </span>
      <span
        className={cn(
          "rounded-sm border px-1 py-0.5 text-center text-[9px] uppercase tracking-widest",
          statusMeta.cls,
        )}
      >
        {statusMeta.label}
      </span>
      <span className="num text-right text-[10px] text-zinc-500">
        {new Date(s.scannedAt).toLocaleDateString("pt-BR")}
      </span>
    </div>
  );
}

function statusBadge(status: string, hasSetup: boolean): { label: string; cls: string } {
  if (!hasSetup) return { label: "—", cls: "border-white/5 text-zinc-600" };
  switch (status) {
    case "PENDING":
      return { label: "Aguard.", cls: "border-white/10 text-zinc-300" };
    case "FILLED":
      return { label: "Em exec.", cls: "border-amber-500/30 bg-amber-500/[0.06] text-amber-300" };
    case "WIN":
      return { label: "Ganho", cls: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300" };
    case "LOSS":
      return { label: "Perda", cls: "border-rose-500/30 bg-rose-500/[0.06] text-rose-300" };
    default:
      return { label: status, cls: "border-white/10 text-zinc-400" };
  }
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
  tone = "default",
}: {
  href: string;
  active: boolean;
  label: string;
  tone?: "default" | "emerald" | "amber";
}) {
  return (
    <a
      href={href}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[11px] transition",
        active && tone === "emerald" && "border-emerald-500/40 bg-emerald-500/[0.10] text-emerald-200",
        active && tone === "amber" && "border-amber-500/40 bg-amber-500/[0.10] text-amber-200",
        active && tone === "default" && "border-white/20 bg-white/[0.06] text-offwhite",
        !active && "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-offwhite",
      )}
    >
      {label}
    </a>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: number | string;
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
          "num mt-2 text-xl font-medium tabular-nums",
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

function buildHref(p: {
  symbol?: string;
  mode?: BacktestMode;
  periodo?: BacktestPeriod;
}): string {
  const sp = new URLSearchParams();
  if (p.symbol) sp.set("symbol", p.symbol);
  if (p.mode && p.mode !== "ALL") sp.set("mode", p.mode);
  if (p.periodo && p.periodo !== "30d") sp.set("periodo", p.periodo);
  const qs = sp.toString();
  return `/dashboard/backtest${qs ? `?${qs}` : ""}`;
}

function periodLabel(p: BacktestPeriod): string {
  return p === "7d"
    ? "Últimos 7 dias"
    : p === "30d"
      ? "Últimos 30 dias"
      : p === "90d"
        ? "Últimos 90 dias"
        : "Histórico completo";
}
