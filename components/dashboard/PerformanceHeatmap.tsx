"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type TradePoint = {
  closedAt: string; // ISO
  rMultiple: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Cell = { day: number; hour: number; trades: number; wins: number; rSum: number };

export function PerformanceHeatmap({ trades }: { trades: TradePoint[] }) {
  const cells = useMemo(() => {
    const grid: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) grid.push({ day: d, hour: h, trades: 0, wins: 0, rSum: 0 });
    }
    for (const t of trades) {
      const dt = new Date(t.closedAt);
      const d = dt.getDay();
      const h = dt.getHours();
      const cell = grid[d * 24 + h];
      cell.trades += 1;
      cell.rSum += t.rMultiple;
      if (t.outcome === "WIN") cell.wins += 1;
    }
    return grid;
  }, [trades]);

  const maxAbsR = useMemo(() => {
    let m = 0.5;
    for (const c of cells) m = Math.max(m, Math.abs(c.rSum));
    return m;
  }, [cells]);

  const [hover, setHover] = useState<Cell | null>(null);

  if (trades.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center text-sm text-zinc-400">
        Heatmap aparece quando você fechar trades. Cada célula mostra o R somado por dia × hora.
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Heatmap dia × hora
          </p>
          <p className="mt-0.5 text-sm text-zinc-300">
            Onde você é lucrativo. Verde = R positivo, vermelho = R negativo.
          </p>
        </div>
        <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-zinc-500">
          <span>-{maxAbsR.toFixed(1)}R</span>
          <div
            className="h-2 w-24 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(244,63,94,0.85), rgba(255,255,255,0.06) 50%, rgba(16,185,129,0.85))",
            }}
          />
          <span>+{maxAbsR.toFixed(1)}R</span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <div className="min-w-[680px]">
          {/* Header de horas */}
          <div className="grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-px text-[9px] text-zinc-600">
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="num text-center">
                {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
              </div>
            ))}
          </div>

          {/* Linhas por dia */}
          {DAYS.map((dayLabel, d) => (
            <div
              key={d}
              className="mt-px grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-px"
            >
              <div className="flex items-center justify-end pr-2 text-[10px] uppercase tracking-widest text-zinc-500">
                {dayLabel}
              </div>
              {Array.from({ length: 24 }).map((_, h) => {
                const cell = cells[d * 24 + h];
                const empty = cell.trades === 0;
                const ratio = empty ? 0 : Math.min(1, Math.abs(cell.rSum) / maxAbsR);
                const isPos = cell.rSum > 0;
                const bg = empty
                  ? "rgba(255,255,255,0.025)"
                  : isPos
                    ? `rgba(16,185,129,${0.12 + ratio * 0.6})`
                    : cell.rSum < 0
                      ? `rgba(244,63,94,${0.12 + ratio * 0.6})`
                      : "rgba(255,255,255,0.06)";
                return (
                  <div
                    key={h}
                    onMouseEnter={() => setHover(cell)}
                    onMouseLeave={() => setHover(null)}
                    className={cn(
                      "aspect-square rounded-sm border border-white/[0.04] transition hover:border-white/30",
                      cell.trades > 0 && "cursor-pointer",
                    )}
                    style={{ backgroundColor: bg }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {hover && hover.trades > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
          <span className="num text-zinc-300">
            {DAYS[hover.day]} · {String(hover.hour).padStart(2, "0")}:00
          </span>
          <span className="text-zinc-500">
            Trades:{" "}
            <span className="num text-zinc-200">{hover.trades}</span>
          </span>

          <span className="text-zinc-500">
            R:{" "}
            <span
              className={cn(
                "num font-medium",
                hover.rSum > 0
                  ? "text-emerald-400"
                  : hover.rSum < 0
                    ? "text-rose-400"
                    : "text-zinc-300",
              )}
            >
              {hover.rSum > 0 ? "+" : ""}
              {hover.rSum.toFixed(2)}R
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
