"use client";

import { cn } from "@/lib/utils";
import { Clock, Target, TrendingDown, TrendingUp } from "lucide-react";

export type SignalData = {
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
  scannedAt: string;
  filledAt: string | null;
  closedAt: string | null;
  candleData: { o: number; h: number; l: number; c: number }[] | null;
};

export function SignalCard({ signal: s }: { signal: SignalData }) {
  if (!s.hasSetup) return <NoSetupRow signal={s} />;

  const isBuy = s.direction?.startsWith("COMPRA");
  const meta = directionMeta(s.direction);
  const statusMeta = statusBadge(s.status);
  const target = pickTarget(s);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition",
        s.status === "WIN" && "border-emerald-500/30 bg-emerald-500/[0.04]",
        s.status === "LOSS" && "border-rose-500/30 bg-rose-500/[0.04]",
        s.status === "FILLED" && "border-amber-500/30 bg-amber-500/[0.04]",
        s.status === "PENDING" && "border-white/10 bg-white/[0.02]",
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="num text-sm font-medium text-offwhite">{s.symbol}</span>
          <span className="num text-[10px] text-zinc-500">· {s.timeframe}</span>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest",
              s.mode === "SMC"
                ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
                : "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
            )}
          >
            {s.mode === "SMC" ? "SMC" : "Clássico"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-md border px-2 py-0.5 text-[9px] uppercase tracking-widest", statusMeta.cls)}>
            {statusMeta.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
            <Clock className="h-3 w-3" />
            {timeAgo(s.scannedAt)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          {/* Sinal e probabilidade */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Sinal</p>
              <p className={cn("mt-0.5 text-base font-semibold tracking-tight", meta.text)}>
                {meta.label}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Probabilidade</p>
              <p className={cn("num mt-0.5 text-base font-medium", meta.text)}>
                {s.probability !== null ? `${s.probability}%` : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Conf.</p>
              <p className="num mt-0.5 text-base font-medium text-offwhite">
                {s.confidence ?? "—"}
              </p>
            </div>
          </div>

          {s.probability !== null && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={cn("h-full rounded-full", meta.bar)}
                style={{ width: `${Math.min(s.probability, 100)}%` }}
              />
            </div>
          )}

          {/* Preços */}
          <div className="grid grid-cols-3 gap-2">
            <PriceBox
              icon={<Target className="h-3 w-3" />}
              label="Entrada"
              value={s.entryPrice}
              symbol={s.symbol}
              tone="emerald"
            />
            <PriceBox
              icon={<TrendingDown className="h-3 w-3" />}
              label="Stop"
              value={s.stopPrice}
              symbol={s.symbol}
              tone="rose"
            />
            <PriceBox
              icon={<TrendingUp className="h-3 w-3" />}
              label={`Alvo${s.recommendedTarget ? " " + s.recommendedTarget : ""}`}
              value={target}
              symbol={s.symbol}
              tone="emerald"
              extra={s.riskReward ?? undefined}
            />
          </div>

          {/* Estrutura/justificativa */}
          {s.justification && (
            <p className="text-xs leading-relaxed text-zinc-300">
              {s.justification}
            </p>
          )}

          {/* Resultado se fechado */}
          {(s.status === "WIN" || s.status === "LOSS") && (
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
              <span className="text-zinc-500">
                Fechado{" "}
                {s.closedAt && (
                  <span className="num text-zinc-300">
                    {new Date(s.closedAt).toLocaleTimeString("pt-BR")}
                  </span>
                )}
                {" · saída "}
                <span className="num text-zinc-300">{s.exitPrice?.toFixed(decimals(s.symbol))}</span>
              </span>
              <span
                className={cn(
                  "num font-medium",
                  s.rMultiple !== null && s.rMultiple > 0
                    ? "text-emerald-400"
                    : "text-rose-400",
                )}
              >
                {s.rMultiple !== null
                  ? `${s.rMultiple > 0 ? "+" : ""}${s.rMultiple.toFixed(2)}R`
                  : "—"}
              </span>
            </div>
          )}
        </div>

        {/* Sparkline */}
        {s.candleData && s.candleData.length > 0 && (
          <Sparkline
            candles={s.candleData}
            entry={s.entryPrice}
            stop={s.stopPrice}
            target={target}
            isBuy={!!isBuy}
          />
        )}
      </div>
    </div>
  );
}

function PriceBox({
  icon,
  label,
  value,
  symbol,
  tone,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  symbol: string;
  tone: "emerald" | "rose";
  extra?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2",
        tone === "emerald"
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : "border-rose-500/20 bg-rose-500/[0.04]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 text-[9px] uppercase tracking-widest",
          tone === "emerald" ? "text-emerald-400" : "text-rose-400",
        )}
      >
        {icon}
        {label}
      </div>
      <p className="num mt-1 text-sm font-medium text-offwhite">
        {value !== null ? value.toFixed(decimals(symbol)) : "—"}
      </p>
      {extra && <p className="num mt-0.5 text-[10px] text-zinc-500">{extra}</p>}
    </div>
  );
}

function Sparkline({
  candles,
  entry,
  stop,
  target,
  isBuy,
}: {
  candles: { o: number; h: number; l: number; c: number }[];
  entry: number | null;
  stop: number | null;
  target: number | null;
  isBuy: boolean;
}) {
  if (!candles.length) return null;
  const allVals = candles.flatMap((c) => [c.h, c.l]);
  if (entry !== null) allVals.push(entry);
  if (stop !== null) allVals.push(stop);
  if (target !== null) allVals.push(target);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const W = 220;
  const H = 140;
  const padX = 4;
  const padY = 8;
  const yScale = (v: number) =>
    padY + ((max - v) / Math.max(0.0001, max - min)) * (H - padY * 2);
  const candleW = (W - padX * 2) / candles.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[140px] w-full">
      {[entry, stop, target].map((v, i) => {
        if (v === null) return null;
        const color = i === 0 ? "#10B981" : i === 1 ? "#F43F5E" : "#10B981";
        return (
          <g key={i}>
            <line
              x1={0}
              y1={yScale(v)}
              x2={W}
              y2={yScale(v)}
              stroke={color}
              strokeWidth="0.7"
              strokeDasharray="2 3"
              opacity="0.7"
            />
          </g>
        );
      })}
      {candles.map((c, i) => {
        const x = padX + i * candleW + candleW / 2;
        const isUp = c.c >= c.o;
        const color = isUp ? "#10B981" : "#F43F5E";
        return (
          <g key={i}>
            <line
              x1={x}
              y1={yScale(c.h)}
              x2={x}
              y2={yScale(c.l)}
              stroke={color}
              strokeWidth="0.7"
              opacity="0.7"
            />
            <rect
              x={x - candleW / 3}
              y={yScale(Math.max(c.o, c.c))}
              width={(candleW / 3) * 2}
              height={Math.max(1, Math.abs(yScale(c.c) - yScale(c.o)))}
              fill={color}
              opacity="0.85"
            />
          </g>
        );
      })}
    </svg>
  );
}

function NoSetupRow({ signal: s }: { signal: SignalData }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.015] px-4 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="num text-sm text-zinc-300">{s.symbol}</span>
        <span className="num text-[10px] text-zinc-500">· {s.timeframe}</span>
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest",
            s.mode === "SMC"
              ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400/80"
              : "border-amber-500/20 bg-amber-500/[0.04] text-amber-400/80",
          )}
        >
          {s.mode}
        </span>
        <span className="text-zinc-500">sem setup</span>
      </div>
      <span className="num text-[10px] text-zinc-500">{timeAgo(s.scannedAt)}</span>
    </div>
  );
}

function pickTarget(s: SignalData): number | null {
  const tgts = [s.target1, s.target2, s.target3];
  const idx = (s.recommendedTarget ?? 1) - 1;
  return tgts[idx] ?? tgts.find((x) => x !== null) ?? null;
}

function decimals(symbol: string): number {
  if (symbol.includes("XAU") || symbol.includes("GOLD")) return 2;
  if (symbol.includes("JPY")) return 3;
  return 5;
}

function directionMeta(d: string | null) {
  switch (d) {
    case "COMPRA_FORTE":
      return { label: "Compra forte", text: "text-emerald-300", bar: "bg-emerald-500" };
    case "COMPRA_FRACA":
      return { label: "Compra fraca", text: "text-emerald-400/90", bar: "bg-emerald-500/60" };
    case "VENDA_FORTE":
      return { label: "Venda forte", text: "text-rose-300", bar: "bg-rose-500" };
    case "VENDA_FRACA":
      return { label: "Venda fraca", text: "text-rose-400/90", bar: "bg-rose-500/60" };
    case "NEUTRO":
    default:
      return { label: "—", text: "text-zinc-300", bar: "bg-zinc-500" };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return { label: "Aguardando", cls: "border-white/10 bg-white/[0.03] text-zinc-300" };
    case "FILLED":
      return { label: "Em execução", cls: "border-amber-500/30 bg-amber-500/[0.08] text-amber-300" };
    case "WIN":
      return { label: "Ganho", cls: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300" };
    case "LOSS":
      return { label: "Perda", cls: "border-rose-500/30 bg-rose-500/[0.08] text-rose-300" };
    case "EXPIRED":
      return { label: "Expirado", cls: "border-white/10 bg-white/[0.03] text-zinc-400" };
    default:
      return { label: status, cls: "border-white/10 bg-white/[0.03] text-zinc-400" };
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
