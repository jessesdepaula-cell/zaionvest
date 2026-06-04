import { Radar } from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { SignalCard, type SignalData } from "@/components/dashboard/SignalCard";
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

  const signals = await prisma.signal.findMany({
    where,
    orderBy: { scannedAt: "desc" },
    take: 60,
  });

  let visible = signals;
  if (statusFilter === "fechados")
    visible = signals.filter((s) => s.status === "WIN" || s.status === "LOSS");

  const stats = {
    pending: signals.filter((s) => s.status === "PENDING").length,
    filled: signals.filter((s) => s.status === "FILLED").length,
    won: signals.filter((s) => s.status === "WIN").length,
    lost: signals.filter((s) => s.status === "LOSS").length,
    noSetup: signals.filter((s) => !s.hasSetup).length,
  };
  const totalClosed = stats.won + stats.lost;
  const winRate = totalClosed > 0 ? (stats.won / totalClosed) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <AutoRefresh intervalMs={10000} />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-emerald-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Sinais ao vivo</h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Auto-refresh 10s
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Setups identificados pela IA escaneando sua watchlist a cada 15 minutos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip param="modo" value="" label="Todos modos" active={!modoFilter} />
          <FilterChip param="modo" value="smc" label="SMC" active={modoFilter === "smc"} />
          <FilterChip param="modo" value="classico" label="Clássico" active={modoFilter === "classico"} />
          <span className="mx-1 self-center text-zinc-700">|</span>
          <FilterChip param="status" value="" label="Todos status" active={!statusFilter} />
          <FilterChip param="status" value="pendentes" label="Pendentes" active={statusFilter === "pendentes"} />
          <FilterChip param="status" value="abertos" label="Abertos" active={statusFilter === "abertos"} />
          <FilterChip param="status" value="fechados" label="Fechados" active={statusFilter === "fechados"} />
        </div>
      </div>

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
                } satisfies SignalData
              }
            />
          ))}
        </div>
      )}
    </div>
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
