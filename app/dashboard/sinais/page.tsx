import { Radar } from "lucide-react";
import { getOrCreateUser, isOwner, getSignalSourceUserId } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { SignalCard, type SignalData } from "@/components/dashboard/SignalCard";
import { ModeAccuracyMeter } from "@/components/dashboard/ModeAccuracyMeter";
import { SignalNotifications } from "@/components/dashboard/SignalNotifications";
import { ResetSignalsButton } from "@/components/dashboard/ResetSignalsButton";
import { getModeStats, periodToDate } from "@/lib/modeStats";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { AutoRefresh } from "./AutoRefresh";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SinaisPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; status?: string; periodo?: string }>;
}) {
  const user = await getOrCreateUser();
  if (!user) return null;
  const owner = isOwner(user);

  // Sinais GLOBAIS: todo assinante lê os sinais da conta mestra (dono). O scan
  // roda só nela; o dashboard de qualquer assinante mostra os mesmos sinais.
  const sourceId = (await getSignalSourceUserId()) ?? user.id;

  const params = await searchParams;
  const modoFilter = params?.modo;
  const statusFilter = params?.status;
  const periodo = params?.periodo ?? "all";
  const since = periodToDate(periodo);

  const where: any = { userId: sourceId };

  if (modoFilter === "smc") where.mode = "SMC";
  if (modoFilter === "classico") where.mode = "CLASSICO";
  if (statusFilter === "abertos") {
    where.status = "FILLED";
    where.hasSetup = true;
  }
  if (statusFilter === "pendentes") {
    where.status = "PENDING";
    where.hasSetup = true;
  }

  // NÃO trazer candleData aqui: são ~500 candles por linha e só os sinais ATIVOS
  // (que desenham gráfico) precisam disso. Puxar o campo em 300 linhas gerava
  // dezenas de MB por request — causa da lentidão de 20-40s por clique/refresh.
  const allRecent = await prisma.signal.findMany({
    where,
    orderBy: { scannedAt: "desc" },
    take: 300,
    omit: { candleData: true },
  });

  const seen = new Set<string>();
  const deduped: typeof allRecent = [];
  for (const s of allRecent) {
    const key = `${s.symbol}|${s.timeframe}|${s.mode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  if (statusFilter !== "fechados") {
    const watchlist = await prisma.watchlist.findMany({
      where: { userId: sourceId, active: true },
    });
    let filteredWatchlist = watchlist;
    if (modoFilter === "smc") {
      filteredWatchlist = watchlist.filter((w) => w.mode === "SMC");
    } else if (modoFilter === "classico") {
      filteredWatchlist = watchlist.filter((w) => w.mode === "CLASSICO");
    }

    for (const w of filteredWatchlist) {
      const hasSignal = deduped.some(
        (s) =>
          s.mode === w.mode &&
          s.timeframe === w.timeframe &&
          s.symbol.toUpperCase() === w.symbol.toUpperCase(),
      );

      if (!hasSignal) {
        deduped.push({
          id: `mock-${w.id}`,
          userId: sourceId,
          symbol: w.symbol,
          timeframe: w.timeframe,
          mode: w.mode,
          hasSetup: false,
          direction: null,
          probability: null,
          confidence: null,
          entryPrice: null,
          entryZoneLow: null,
          entryZoneHigh: null,
          stopPrice: null,
          target1: null,
          target2: null,
          target3: null,
          recommendedTarget: null,
          riskReward: null,
          structure: null,
          justification: "Aguardando primeiro scan automático…",
          status: "NO_SETUP",
          exitPrice: null,
          rMultiple: null,
          maxTargetHit: null,
          scannedAt: w.lastScanAt ?? new Date(),
          tipoSetup: null,
          checklistSmc: null,
          checklistClassico: null,
          tradeCreated: false,
          filledAt: null,
          closedAt: null,
        } as (typeof allRecent)[number]);
      }
    }
  }

  const isFinished = (st: string) => st === "WIN" || st === "LOSS" || st === "EXPIRED";
  const isClosedTrade = (st: string) => st === "WIN" || st === "LOSS";
  const isActiveSignal = (s: (typeof allRecent)[number]) =>
    s.hasSetup && (s.status === "PENDING" || s.status === "FILLED");

  // ── GESTÃO DE CICLO DE VIDA NA TELA ──
  // Ativos: ocupam o palco com gráfico. Concluídos: saem da frente e viram
  // histórico compacto. O par cujo último sinal fechou volta ao radar,
  // liberado para a próxima oportunidade.
  const activeSignals = deduped.filter(isActiveSignal);

  // candleData só é necessário nos cards ATIVOS (gráfico). Buscamos os candles
  // APENAS desses poucos sinais, em vez de trazer o campo em todas as linhas.
  const activeRealIds = activeSignals
    .filter((s) => !s.id.startsWith("mock-"))
    .map((s) => s.id);
  if (activeRealIds.length > 0) {
    const candleRows = await prisma.signal.findMany({
      where: { id: { in: activeRealIds } },
      select: { id: true, candleData: true },
    });
    const candleMap = new Map(candleRows.map((r) => [r.id, r.candleData]));
    for (const s of activeSignals) {
      (s as { candleData?: unknown }).candleData = candleMap.get(s.id) ?? null;
    }
  }

  const monitoring = deduped
    .filter((s) => !isActiveSignal(s))
    .map((s) =>
      s.hasSetup && isFinished(s.status)
        ? ({
            ...s,
            id: `freed-${s.id}`,
            hasSetup: false,
            status: "NO_SETUP",
            direction: null,
            justification: `Último sinal deste par foi concluído (${
              s.status === "WIN" ? "ganho" : s.status === "LOSS" ? "perda" : "expirado"
            }). Gráfico liberado — monitorando a próxima oportunidade.`,
          } as (typeof allRecent)[number])
        : s,
    );
  // Busca os sinais concluídos diretamente no banco de dados para evitar que sejam
  // empurrados pelos milhares de logs "NO_SETUP" do cron job.
  const closedSignalsFromDb = await prisma.signal.findMany({
    where: {
      userId: sourceId,
      hasSetup: true,
      status: { in: ["WIN", "LOSS"] },
      mode: modoFilter === "smc" ? "SMC" : modoFilter === "classico" ? "CLASSICO" : undefined,
      ...(since ? { closedAt: { gte: since } } : {}),
    },
    orderBy: { scannedAt: "desc" },
    take: 100,
    omit: { candleData: true }, // cards fechados não plotam gráfico
  });

  const recentClosed = closedSignalsFromDb.slice(0, 8);

  const visible: typeof allRecent =
    statusFilter === "fechados"
      ? (closedSignalsFromDb as any)
      : deduped;

  const countGroups = await prisma.signal.groupBy({
    by: ["status"],
    where: {
      userId: sourceId,
      hasSetup: true,
      mode: modoFilter === "smc" ? "SMC" : modoFilter === "classico" ? "CLASSICO" : undefined,
      ...(since ? { scannedAt: { gte: since } } : {}),
    },
    _count: {
      id: true,
    },
  });

  const getCount = (status: string) => {
    const group = countGroups.find((g) => g.status === status);
    return group?._count?.id ?? 0;
  };

  const stats = {
    pending: getCount("PENDING"),
    filled: getCount("FILLED"),
    won: getCount("WIN"),
    lost: getCount("LOSS"),
    noSetup: allRecent.filter((s) => !s.hasSetup).length,
  };
  const signals = deduped;
  const totalClosed = stats.won + stats.lost;
  const winRate = totalClosed > 0 ? (stats.won / totalClosed) * 100 : 0;

  const modeStats = await getModeStats(sourceId, since);

  const watchlistCount = await prisma.watchlist.count({
    where: { userId: sourceId, active: true },
  });

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
            Setups identificados a cada 5 minutos, a partir de candles puxados direto do mercado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip param="status" value="" label="Todos" active={!statusFilter} />
          <FilterChip param="status" value="pendentes" label="Pendentes" active={statusFilter === "pendentes"} />
          <FilterChip param="status" value="abertos" label="Em execução" active={statusFilter === "abertos"} />
          <FilterChip param="status" value="fechados" label="Fechados" active={statusFilter === "fechados"} />
          {owner && (
            <>
              <span className="ml-2 hidden h-4 w-px bg-white/10 sm:inline-block" />
              <ResetSignalsButton />
            </>
          )}
        </div>
      </div>

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

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">
            Assertividade por modo de análise
          </h2>
          <PeriodFilter />
        </div>
        <ModeAccuracyMeter
          smc={modeStats.smc}
          classico={modeStats.classico}
          show={modoFilter === "smc" ? "smc" : modoFilter === "classico" ? "classico" : "both"}
        />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Pendentes" value={stats.pending} tone="amber" />
        <Kpi label="Em execução" value={stats.filled} tone="amber" />
        <Kpi label="Ganhos" value={stats.won} tone="emerald" />
        <Kpi label="Perdas" value={stats.lost} tone="rose" />
      </section>

      {watchlistCount === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-sm text-zinc-400">
          Sua watchlist está vazia. Configure em{" "}
          <a href="/dashboard/watchlist" className="text-emerald-400 underline-offset-2 hover:underline">
            /dashboard/watchlist
          </a>{" "}
          para começar a receber sinais automáticos.
        </div>
      ) : statusFilter ? (
        // Filtro explícito: lista simples do recorte pedido
        visible.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {visible.map((s) => (
              <SignalCard key={s.id} signal={toSignalData(s)} />
            ))}
          </div>
        )
      ) : (
        // ── PALCO: gestão de ciclo de vida na tela ──
        <div className="space-y-8">
          <section>
            <SectionHeading
              label={`Sinais ativos (${activeSignals.length})`}
              hint="Somente sinais aguardando entrada ou em execução ficam com gráfico na tela."
            />
            {activeSignals.length === 0 ? (
              <div className="glass grid min-h-[120px] place-items-center rounded-xl p-6 text-center text-sm text-zinc-400">
                <div>
                  <Radar className="mx-auto h-5 w-5 text-zinc-600" />
                  <p className="mt-2">Nenhum sinal ativo agora — o radar está varrendo os pares abaixo.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSignals.map((s) => (
                  <SignalCard key={`${s.symbol}|${s.timeframe}|${s.mode}`} signal={toSignalData(s)} />
                ))}
              </div>
            )}
          </section>

          {monitoring.length > 0 && (
            <section>
              <SectionHeading
                label={`Radar — monitorando ${monitoring.length} ${monitoring.length === 1 ? "par" : "pares"}`}
                hint="Pares sem sinal ativo. Quando um setup for detectado, ele sobe para a área de sinais ativos."
              />
              <div className="space-y-2">
                {monitoring.map((s) => (
                  <SignalCard key={s.id} signal={toSignalData(s)} />
                ))}
              </div>
            </section>
          )}

          {recentClosed.length > 0 && (
            <section>
              <SectionHeading
                label="Concluídos recentes"
                hint="Sinais finalizados saem do palco e ficam aqui de forma compacta. Histórico completo em Estatísticas."
              />
              <div className="space-y-2">
                {recentClosed.map((s) => (
                  <SignalCard key={s.id} signal={toSignalData(s)} />
                ))}
              </div>
              <p className="mt-2 text-right text-[11px]">
                <a
                  href="/dashboard/estatisticas"
                  className="text-emerald-400 underline-offset-2 hover:underline"
                >
                  Ver histórico completo →
                </a>
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function toSignalData(s: {
  id: string;
  symbol: string;
  timeframe: string;
  mode: string;
  hasSetup: boolean;
  direction: string | null;
  probability: number | null;
  confidence: string | null;
  entryPrice: number | null;
  stopPrice: number | null;
  target1: number | null;
  target2: number | null;
  target3: number | null;
  recommendedTarget: number | null;
  riskReward: string | null;
  structure: string | null;
  justification: string | null;
  status: string;
  exitPrice: number | null;
  rMultiple: number | null;
  scannedAt: Date;
  filledAt: Date | null;
  closedAt: Date | null;
  candleData?: unknown;
  tipoSetup: string | null;
  checklistSmc: unknown;
  checklistClassico: unknown;
}): SignalData {
  return {
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
  };
}

function SectionHeading({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[10px] uppercase tracking-widest text-zinc-400">{label}</h2>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-600">{hint}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass grid min-h-[200px] place-items-center rounded-xl p-8 text-center text-sm text-zinc-400">
      <div>
        <Radar className="mx-auto h-5 w-5 text-zinc-600" />
        <p className="mt-3">Nenhum sinal no filtro selecionado ainda.</p>
        <p className="mt-1 text-xs text-zinc-500">O scan roda a cada 5 minutos. Aguarde…</p>
      </div>
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
  const href = value ? `/dashboard/sinais?${param}=${value}` : `/dashboard/sinais`;
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

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "emerald" | "rose" | "amber";
}) {
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
