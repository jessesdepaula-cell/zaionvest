import { Radar } from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { SignalCard, type SignalData } from "@/components/dashboard/SignalCard";
import { ModeAccuracyMeter } from "@/components/dashboard/ModeAccuracyMeter";
import { SignalNotifications } from "@/components/dashboard/SignalNotifications";
import { ResetSignalsButton } from "@/components/dashboard/ResetSignalsButton";
import { getModeStats } from "@/lib/modeStats";
import { AutoRefresh } from "./AutoRefresh";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SinaisPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; status?: string }>;
}) {
  const user = await getOrCreateUser();
  if (!user) return null;

  const params = await searchParams;
  const modoFilter = params?.modo;
  const statusFilter = params?.status;

  const accounts = await prisma.mT5Account.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);

  const where: {
    accountId: { in: string[] };
    mode?: string;
    status?: string;
    hasSetup?: boolean;
  } = { accountId: { in: accountIds } };

  if (modoFilter === "smc") where.mode = "SMC";
  if (modoFilter === "classico") where.mode = "CLASSICO";
  if (statusFilter === "abertos") where.status = "FILLED";
  if (statusFilter === "pendentes") where.status = "PENDING";
  if (statusFilter === "fechados") {
    // mostrar WIN/LOSS — handle via post filter
  }

  // Pega janela maior para conseguir agregar histórico de fechados, mas
  // depois reduz a 1 sinal por (símbolo, timeframe, modo) — o mais recente.
  // Exceção: sinais já fechados (WIN/LOSS) ou em execução (FILLED) ficam
  // visíveis individualmente para o usuário ver o histórico ativo.
  const allRecent = await prisma.signal.findMany({
    where,
    orderBy: { scannedAt: "desc" },
    take: 300,
  });

  // Dedup base: 1 sinal por (símbolo, timeframe, modo) — o mais recente.
  // Usado para a lista padrão e para os contadores das abas.
  const seen = new Set<string>();
  const deduped: typeof allRecent = [];
  for (const s of allRecent) {
    const key = `${s.symbol}|${s.timeframe}|${s.mode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  // No filtro "Fechados" o usuário quer histórico completo de trades — NÃO dedupa.
  // Nos demais filtros, mostra só o último sinal de cada par/modo.
  const visible: typeof allRecent =
    statusFilter === "fechados"
      ? allRecent.filter((s) => s.status === "WIN" || s.status === "LOSS")
      : deduped;

  // KPIs somam o histórico real (allRecent), não a versão dedupada
  const stats = {
    pending: allRecent.filter((s) => s.status === "PENDING" && s.hasSetup).length,
    filled: allRecent.filter((s) => s.status === "FILLED").length,
    won: allRecent.filter((s) => s.status === "WIN").length,
    lost: allRecent.filter((s) => s.status === "LOSS").length,
    noSetup: allRecent.filter((s) => !s.hasSetup).length,
  };
  const signals = deduped; // contadores das abas refletem 1 por par/modo
  const totalClosed = stats.won + stats.lost;
  const winRate = totalClosed > 0 ? (stats.won / totalClosed) * 100 : 0;

  const modeStats = await getModeStats(user.id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <AutoRefresh intervalMs={30000} />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-emerald-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Sinais ao vivo</h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Auto-refresh 30s
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Setups identificados pela IA escaneando sua watchlist a cada 15 minutos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip param="status" value="" label="Todos" active={!statusFilter} />
          <FilterChip param="status" value="pendentes" label="Pendentes" active={statusFilter === "pendentes"} />
          <FilterChip param="status" value="abertos" label="Em execução" active={statusFilter === "abertos"} />
          <FilterChip param="status" value="fechados" label="Fechados" active={statusFilter === "fechados"} />
          <span className="ml-2 hidden h-4 w-px bg-white/10 sm:inline-block" />
          <ResetSignalsButton />
        </div>
      </div>

      {/* Tabs por modo */}
      <div className="mb-6 border-b border-white/10">
        <nav className="flex gap-1">
          <ModeTab href={buildModeHref(undefined, statusFilter)} active={!modoFilter} count={signals.length} label="Todos" />
          <ModeTab
            href={buildModeHref("smc", statusFilter)}
            active={modoFilter === "smc"}
            count={signals.filter((s) => s.mode === "SMC").length}
            label="SMC"
            tone="emerald"
          />
          <ModeTab
            href={buildModeHref("classico", statusFilter)}
            active={modoFilter === "classico"}
            count={signals.filter((s) => s.mode === "CLASSICO").length}
            label="Clássico"
            tone="amber"
          />
        </nav>
      </div>

      {/* Notificações de sinais fortes */}
      <section className="mb-4">
        <SignalNotifications
          signals={allRecent.map((s) => ({
            id: s.id,
            symbol: s.symbol,
            mode: s.mode,
            direction: s.direction,
            probability: s.probability,
            confidence: s.confidence,
            hasSetup: s.hasSetup,
            status: s.status,
            scannedAt: s.scannedAt.toISOString(),
          }))}
        />
      </section>

      {/* Medidor de assertividade por modo (segue a aba ativa) */}
      <section className="mb-6">
        <h2 className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500">
          Assertividade por modo de análise
        </h2>
        <ModeAccuracyMeter
          smc={modeStats.smc}
          classico={modeStats.classico}
          show={
            modoFilter === "smc" ? "smc" : modoFilter === "classico" ? "classico" : "both"
          }
        />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Pendentes" value={stats.pending} tone="amber" />
        <Kpi label="Em execução" value={stats.filled} tone="amber" />
        <Kpi label="Ganhos" value={stats.won} tone="emerald" />
        <Kpi label="Perdas" value={stats.lost} tone="rose" />
        <Kpi
          label="Win rate"
          value={totalClosed > 0 ? `${winRate.toFixed(0)}%` : "—"}
          tone={winRate >= 50 ? "emerald" : "rose"}
        />
      </section>

      {accountIds.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-sm text-zinc-400">
          Conecte uma conta MT5 em{" "}
          <a href="/dashboard/mt5" className="text-emerald-400 underline-offset-2 hover:underline">
            /dashboard/mt5
          </a>{" "}
          para começar a receber sinais automáticos.
        </div>
      ) : visible.length === 0 ? (
        <div className="glass grid min-h-[200px] place-items-center rounded-xl p-8 text-center text-sm text-zinc-400">
          <div>
            <Radar className="mx-auto h-5 w-5 text-zinc-600" />
            <p className="mt-3">Nenhum sinal no filtro selecionado ainda.</p>
            <p className="mt-1 text-xs text-zinc-500">
              O EA scaner roda a cada fechamento de M15. Aguarde…
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((s) => (
            <SignalCard
              key={s.id}
              signal={
                {
                  id: s.id,
                  symbol: s.symbol,
                  timeframe: s.timeframe,
                  mode: s.mode,
                  hasSetup: s.hasSetup,
                  direction: s.direction,
                  probability: s.probability,
                  confidence: s.confidence,
                  entryPrice: s.entryPrice,
                  stopPrice: s.stopPrice,
                  target1: s.target1,
                  target2: s.target2,
                  target3: s.target3,
                  recommendedTarget: s.recommendedTarget,
                  riskReward: s.riskReward,
                  structure: s.structure,
                  justification: s.justification,
                  status: s.status,
                  exitPrice: s.exitPrice,
                  rMultiple: s.rMultiple,
                  scannedAt: s.scannedAt.toISOString(),
                  filledAt: s.filledAt?.toISOString() ?? null,
                  closedAt: s.closedAt?.toISOString() ?? null,
                  candleData: (s.candleData as SignalData["candleData"]) ?? null,
                  tipoSetup: s.tipoSetup,
                  checklistSmc: (s.checklistSmc as Record<string, boolean> | null) ?? null,
                  checklistClassico: (s.checklistClassico as Record<string, boolean> | null) ?? null,
                } satisfies SignalData
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function buildModeHref(modo: string | undefined, status: string | undefined): string {
  const params = new URLSearchParams();
  if (modo) params.set("modo", modo);
  if (status) params.set("status", status);
  const qs = params.toString();
  return `/dashboard/sinais${qs ? `?${qs}` : ""}`;
}

function ModeTab({
  href,
  active,
  label,
  count,
  tone = "default",
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tone?: "default" | "emerald" | "amber";
}) {
  return (
    <a
      href={href}
      className={cn(
        "relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition",
        active ? "text-offwhite" : "text-zinc-500 hover:text-zinc-300",
      )}
      title={`${count} ${count === 1 ? "par" : "pares"} no escaneamento`}
    >
      {label}
      <span
        className={cn(
          "num rounded-md border px-1.5 py-0.5 text-[10px] font-normal",
          active && tone === "emerald" && "border-emerald-500/40 bg-emerald-500/[0.10] text-emerald-300",
          active && tone === "amber" && "border-amber-500/40 bg-amber-500/[0.10] text-amber-300",
          active && tone === "default" && "border-white/15 bg-white/[0.05] text-zinc-200",
          !active && "border-white/10 bg-white/[0.02] text-zinc-500",
        )}
      >
        {count} {count === 1 ? "par" : "pares"}
      </span>
      {active && (
        <span
          className={cn(
            "absolute bottom-[-1px] left-0 right-0 h-[2px]",
            tone === "emerald" && "bg-emerald-400",
            tone === "amber" && "bg-amber-400",
            tone === "default" && "bg-offwhite",
          )}
        />
      )}
    </a>
  );
}

function FilterChip({
  param,
  value,
  label,
  active,
}: {
  param: string;
  value: string;
  label: string;
  active: boolean;
}) {
  const href = value
    ? `/dashboard/sinais?${param}=${value}`
    : `/dashboard/sinais`;
  return (
    <a
      href={href}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-widest transition",
        active
          ? "border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-300"
          : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-offwhite",
      )}
    >
      {label}
    </a>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone: "emerald" | "rose" | "amber" }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div
        className={cn(
          "num mt-2 text-2xl font-medium",
          tone === "emerald" && "text-emerald-400",
          tone === "rose" && "text-rose-400",
          tone === "amber" && "text-amber-400",
        )}
      >
        {value}
      </div>
    </div>
  );
}
