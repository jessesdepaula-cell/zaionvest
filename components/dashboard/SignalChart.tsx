"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type ChartCandle = {
  t?: number; // unix seconds
  o: number;
  h: number;
  l: number;
  c: number;
};

export function SignalChart({
  candles,
  symbol,
  isBuy,
  entry,
  stop,
  target,
  targets,
  recommendedTarget,
  status,
  exitPrice,
  rMultiple,
  scannedAt,
}: {
  candles: ChartCandle[];
  symbol: string;
  isBuy: boolean;
  entry: number | null;
  stop: number | null;
  target: number | null;
  targets?: (number | null)[];
  recommendedTarget?: number | null;
  status: string;
  exitPrice?: number | null;
  rMultiple?: number | null;
  scannedAt: string;
}) {
  const dec = useMemo(() => decimals(symbol), [symbol]);

  const layout = useMemo(() => {
    const W = 1000;
    const H = 320;
    const padL = 12;
    const padR = 78;
    const padT = 16;
    const padB = 26;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    if (candles.length === 0) {
      return { W, H, padL, padR, padT, padB, innerW, innerH, min: 0, max: 1, candleW: 1 };
    }

    const allVals = candles.flatMap((c) => [c.h, c.l]);
    [entry, stop, target, exitPrice].forEach((v) => {
      if (typeof v === "number") allVals.push(v);
    });
    targets?.forEach((v) => {
      if (typeof v === "number") allVals.push(v);
    });
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const pad = (max - min) * 0.05 || max * 0.0005;
    const candleW = innerW / candles.length;
    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      innerW,
      innerH,
      min: min - pad,
      max: max + pad,
      candleW,
    };
  }, [candles, entry, stop, target, exitPrice, targets]);

  if (candles.length === 0) {
    return (
      <div className="grid h-[200px] place-items-center rounded-md border border-white/5 bg-white/[0.01] text-xs text-zinc-500">
        Sem dados de velas
      </div>
    );
  }

  const { W, H, padL, padR, padT, padB, innerW, innerH, min, max, candleW } = layout;
  const range = Math.max(0.0000001, max - min);
  const xOf = (i: number) => padL + i * candleW + candleW / 2;
  const yOf = (v: number) => padT + ((max - v) / range) * innerH;

  // ticks Y
  const yTicks = niceTicks(min, max, 5);

  // X labels — 5 timestamps espaçados se disponíveis
  const xLabels: { x: number; label: string }[] = [];
  if (candles.length > 0 && candles[0].t) {
    const steps = Math.min(5, candles.length);
    for (let i = 0; i < steps; i++) {
      const idx = Math.floor((i * (candles.length - 1)) / Math.max(1, steps - 1));
      const c = candles[idx];
      if (c.t) {
        const d = new Date(c.t * 1000);
        xLabels.push({
          x: xOf(idx),
          label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
        });
      }
    }
  }

  // candle de fill (quando preço tocou entrada)
  const fillIdx = findFillIndex(candles, entry, isBuy);
  // candle de fechamento (quando preço tocou stop ou alvo)
  const closeIdx =
    status === "WIN" || status === "LOSS"
      ? findCloseIndex(candles, isBuy, stop, target, fillIdx)
      : null;

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.015]">
      {/* mini header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
        <span className="flex items-center gap-2">
          <span className="num text-zinc-300">{symbol}</span>
          <span className="text-zinc-600">·</span>
          <span>{candles.length} velas</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] tracking-widest">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            Não repinta · fixado em{" "}
            {new Date(scannedAt).toLocaleTimeString("pt-BR")}
          </span>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[320px] w-full">
        {/* Grade horizontal */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              y1={yOf(v)}
              x2={W - padR}
              y2={yOf(v)}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
            <text
              x={W - padR + 6}
              y={yOf(v) + 3}
              fontSize="9"
              fill="rgba(244,244,247,0.4)"
              fontFamily="JetBrains Mono, monospace"
            >
              {v.toFixed(dec)}
            </text>
          </g>
        ))}

        {/* Linhas de entrada/stop/alvos + labels */}
        {entry !== null && (
          <PriceLine
            y={yOf(entry)}
            price={entry}
            label="ENTRADA"
            color="#10B981"
            W={W}
            padL={padL}
            padR={padR}
            dec={dec}
            solid
          />
        )}
        {stop !== null && (
          <PriceLine
            y={yOf(stop)}
            price={stop}
            label="STOP"
            color="#F43F5E"
            W={W}
            padL={padL}
            padR={padR}
            dec={dec}
            solid
          />
        )}
        {targets && targets.length > 0
          ? targets.map((tv, i) => {
              if (typeof tv !== "number") return null;
              const isRec = (recommendedTarget ?? 1) === i + 1;
              return (
                <PriceLine
                  key={i}
                  y={yOf(tv)}
                  price={tv}
                  label={`ALVO ${i + 1}${isRec ? " ★" : ""}`}
                  color={isRec ? "#10B981" : "#F59E0B"}
                  W={W}
                  padL={padL}
                  padR={padR}
                  dec={dec}
                  solid={false}
                />
              );
            })
          : target !== null && (
              <PriceLine
                y={yOf(target)}
                price={target}
                label="ALVO ★"
                color="#10B981"
                W={W}
                padL={padL}
                padR={padR}
                dec={dec}
                solid={false}
              />
            )}

        {/* Linha de saída se fechado */}
        {typeof exitPrice === "number" && (
          <PriceLine
            y={yOf(exitPrice)}
            price={exitPrice}
            label={status === "WIN" ? "SAÍDA ✓" : "SAÍDA ✗"}
            color={status === "WIN" ? "#34D399" : "#FB7185"}
            W={W}
            padL={padL}
            padR={padR}
            dec={dec}
            solid
            thick
          />
        )}

        {/* Velas */}
        {candles.map((c, i) => {
          const cx = xOf(i);
          const isUp = c.c >= c.o;
          const color = isUp ? "#10B981" : "#F43F5E";
          const yH = yOf(c.h);
          const yL = yOf(c.l);
          const yO = yOf(c.o);
          const yC = yOf(c.c);
          const bodyTop = Math.min(yO, yC);
          const bodyH = Math.max(1, Math.abs(yC - yO));
          const w = Math.max(1, candleW * 0.65);
          return (
            <g key={i}>
              <line
                x1={cx}
                y1={yH}
                x2={cx}
                y2={yL}
                stroke={color}
                strokeWidth="1"
                opacity="0.9"
              />
              <rect
                x={cx - w / 2}
                y={bodyTop}
                width={w}
                height={bodyH}
                fill={color}
                opacity="0.92"
              />
            </g>
          );
        })}

        {/* Marcador de FILL (onde tocou a entrada) */}
        {fillIdx !== null && entry !== null && (
          <g>
            <circle
              cx={xOf(fillIdx)}
              cy={yOf(entry)}
              r="6"
              fill="#0A0A0A"
              stroke="#10B981"
              strokeWidth="2"
            />
            <circle cx={xOf(fillIdx)} cy={yOf(entry)} r="2.5" fill="#10B981" />
          </g>
        )}

        {/* Marcador de FECHAMENTO (WIN ou LOSS) */}
        {closeIdx !== null && typeof exitPrice === "number" && (
          <g>
            <circle
              cx={xOf(closeIdx)}
              cy={yOf(exitPrice)}
              r="7"
              fill={status === "WIN" ? "#34D399" : "#FB7185"}
              opacity="0.92"
            />
            <text
              x={xOf(closeIdx)}
              y={yOf(exitPrice) + 3}
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
              fill="#0A0A0A"
              fontFamily="JetBrains Mono, monospace"
            >
              {status === "WIN" ? "✓" : "✗"}
            </text>
          </g>
        )}

        {/* X labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H - 8}
            fontSize="9"
            textAnchor="middle"
            fill="rgba(244,244,247,0.4)"
            fontFamily="JetBrains Mono, monospace"
          >
            {l.label}
          </text>
        ))}

        {/* Badge de resultado */}
        {(status === "WIN" || status === "LOSS") && (
          <g>
            <rect
              x={padL + 8}
              y={padT + 8}
              width="124"
              height="32"
              rx="6"
              fill={status === "WIN" ? "rgba(16,185,129,0.20)" : "rgba(244,63,94,0.20)"}
              stroke={status === "WIN" ? "rgba(16,185,129,0.6)" : "rgba(244,63,94,0.6)"}
            />
            <text
              x={padL + 18}
              y={padT + 24}
              fontSize="11"
              fontWeight="700"
              fill={status === "WIN" ? "#34D399" : "#FB7185"}
              fontFamily="JetBrains Mono, monospace"
            >
              {status === "WIN" ? "GANHO" : "PERDA"}{" "}
              {typeof rMultiple === "number"
                ? `${rMultiple > 0 ? "+" : ""}${rMultiple.toFixed(2)}R`
                : ""}
            </text>
          </g>
        )}

        {/* Badge AGUARDANDO ou EM EXECUÇÃO */}
        {(status === "PENDING" || status === "FILLED") && (
          <g>
            <rect
              x={padL + 8}
              y={padT + 8}
              width="138"
              height="26"
              rx="5"
              fill={status === "FILLED" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)"}
              stroke={status === "FILLED" ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.15)"}
            />
            <text
              x={padL + 18}
              y={padT + 25}
              fontSize="10"
              fontWeight="600"
              fill={status === "FILLED" ? "#FBBF24" : "rgba(244,244,247,0.7)"}
              fontFamily="JetBrains Mono, monospace"
            >
              {status === "FILLED" ? "● EM EXECUÇÃO" : "○ AGUARDANDO ENTRADA"}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function PriceLine({
  y,
  price,
  label,
  color,
  W,
  padL,
  padR,
  dec,
  solid,
  thick,
}: {
  y: number;
  price: number;
  label: string;
  color: string;
  W: number;
  padL: number;
  padR: number;
  dec: number;
  solid: boolean;
  thick?: boolean;
}) {
  return (
    <g>
      <line
        x1={padL}
        y1={y}
        x2={W - padR}
        y2={y}
        stroke={color}
        strokeWidth={thick ? "1.5" : "1"}
        strokeDasharray={solid ? undefined : "4 4"}
        opacity={solid ? 0.85 : 0.7}
      />
      <rect x={W - padR + 4} y={y - 8} width="68" height="16" rx="3" fill={color} opacity="0.92" />
      <text
        x={W - padR + 38}
        y={y + 4}
        fontSize="9"
        fontWeight="700"
        textAnchor="middle"
        fill="#0A0A0A"
        fontFamily="JetBrains Mono, monospace"
      >
        {label}
      </text>
      <text
        x={padL + 6}
        y={y - 3}
        fontSize="9"
        fill={color}
        fontFamily="JetBrains Mono, monospace"
      >
        {price.toFixed(dec)}
      </text>
    </g>
  );
}

function findFillIndex(
  candles: ChartCandle[],
  entry: number | null,
  isBuy: boolean,
): number | null {
  if (entry === null) return null;
  // procura a primeira vela que tocou o preço de entrada
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (isBuy && c.l <= entry && c.h >= entry) return i;
    if (!isBuy && c.h >= entry && c.l <= entry) return i;
  }
  return null;
}

function findCloseIndex(
  candles: ChartCandle[],
  isBuy: boolean,
  stop: number | null,
  target: number | null,
  fillIdx: number | null,
): number | null {
  if (fillIdx === null) return null;
  for (let i = fillIdx + 1; i < candles.length; i++) {
    const c = candles[i];
    if (isBuy) {
      if (stop !== null && c.l <= stop) return i;
      if (target !== null && c.h >= target) return i;
    } else {
      if (stop !== null && c.h >= stop) return i;
      if (target !== null && c.l <= target) return i;
    }
  }
  return null;
}

function decimals(symbol: string): number {
  if (symbol.includes("XAU") || symbol.includes("GOLD")) return 2;
  if (symbol.includes("JPY")) return 3;
  return 5;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function niceTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const rough = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = norm < 1.5 ? mag : norm < 3 ? 2 * mag : norm < 7 ? 5 * mag : 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.0001; v += step) ticks.push(v);
  return ticks;
}
