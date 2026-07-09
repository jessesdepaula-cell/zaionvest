"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type SlopeValue = "ALTA" | "BAIXA" | "LATERAL" | string | undefined;

export type MovingAveragesData = {
  ema9?: string;
  ema9_slope?: SlopeValue;
  ema20?: string;
  ema20_slope?: SlopeValue;
  ema50?: string;
  ema50_slope?: SlopeValue;
  sma200?: string;
  sma200_slope?: SlopeValue;
  distancia_ema9_ema50_pct?: string;
};

const MAS = [
  { key: "ema9", slopeKey: "ema9_slope", label: "EMA 9", color: "#DEA82F" },
  { key: "ema20", slopeKey: "ema20_slope", label: "EMA 20", color: "#F97316" },
  { key: "ema50", slopeKey: "ema50_slope", label: "EMA 50", color: "#3B82F6" },
  { key: "sma200", slopeKey: "sma200_slope", label: "SMA 200", color: "#E4E4E7" },
] as const;

function isSpaghetti(distPct?: string): boolean {
  if (!distPct) return false;
  const m = distPct.match(/(-?\d+(?:[.,]\d+)?)/);
  if (!m) return false;
  const v = parseFloat(m[1].replace(",", "."));
  return isFinite(v) && Math.abs(v) < 0.5;
}

export function MovingAveragesCard({ data }: { data: MovingAveragesData }) {
  const dist = data.distancia_ema9_ema50_pct;
  const spaghetti = isSpaghetti(dist);

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Médias móveis identificadas
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Valores e inclinação lidos do gráfico (EMA 9 / 20 / 50 + SMA 200)
          </p>
        </div>
        {dist && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] uppercase tracking-widest",
              spaghetti
                ? "border-rose-500/30 bg-rose-500/[0.08] text-rose-300"
                : "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
            )}
            title="Distância entre EMA 9 e EMA 50 (<0.5% = médias emboladas)"
          >
            {spaghetti ? "Emboladas" : "Espaçadas"} · {dist}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MAS.map((m) => {
          const value = data[m.key as keyof MovingAveragesData] as string | undefined;
          const slope = data[m.slopeKey as keyof MovingAveragesData] as SlopeValue;
          return (
            <div
              key={m.key}
              className="rounded-md border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02] p-3"
            >
              <div
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest"
                style={{ color: m.color }}
              >
                <span
                  className="inline-block h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.label}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="num text-sm font-medium text-offwhite">
                  {value ?? "—"}
                </span>
                <SlopeBadge slope={slope} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlopeBadge({ slope }: { slope: SlopeValue }) {
  const s = (slope ?? "").toUpperCase();
  if (s === "ALTA") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-500/[0.10] px-1 py-0.5 text-[9px] uppercase tracking-widest text-emerald-300">
        <ArrowUp className="h-2.5 w-2.5" />
        Alta
      </span>
    );
  }
  if (s === "BAIXA") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-sm bg-rose-500/[0.10] px-1 py-0.5 text-[9px] uppercase tracking-widest text-rose-300">
        <ArrowDown className="h-2.5 w-2.5" />
        Baixa
      </span>
    );
  }
  if (s === "LATERAL") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-sm bg-amber-500/[0.10] px-1 py-0.5 text-[9px] uppercase tracking-widest text-amber-300">
        <Minus className="h-2.5 w-2.5" />
        Lateral
      </span>
    );
  }
  return <span className="text-[9px] text-zinc-600">—</span>;
}
