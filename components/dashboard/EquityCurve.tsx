"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type EquityPoint = {
  date: string; // ISO
  cum: number;
  r: number;
};

export type EquitySeries = {
  name: string;
  color: string;
  glow?: string;
  points: EquityPoint[];
};

type DrawdownInfo = {
  maxDD: number;
  peakIdx: number;
  troughIdx: number;
  peakDate: string;
  troughDate: string;
  peakValue: number;
  troughValue: number;
};

function computeDrawdown(points: EquityPoint[]): DrawdownInfo | null {
  if (points.length < 2) return null;
  let peak = points[0].cum;
  let peakIdx = 0;
  let currentPeakIdx = 0;
  let maxDD = 0;
  let ddPeakIdx = 0;
  let ddTroughIdx = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].cum > peak) {
      peak = points[i].cum;
      currentPeakIdx = i;
    }
    const dd = peak - points[i].cum;
    if (dd > maxDD) {
      maxDD = dd;
      ddPeakIdx = currentPeakIdx;
      ddTroughIdx = i;
    }
  }
  if (maxDD <= 0) return null;
  return {
    maxDD,
    peakIdx: ddPeakIdx,
    troughIdx: ddTroughIdx,
    peakDate: points[ddPeakIdx].date,
    troughDate: points[ddTroughIdx].date,
    peakValue: points[ddPeakIdx].cum,
    troughValue: points[ddTroughIdx].cum,
  };
}

export function EquityCurve({
  series,
  showDrawdown = true,
}: {
  series: EquitySeries[];
  showDrawdown?: boolean;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [hoverX, setHoverX] = useState<number | null>(null);

  const visible = series.filter((s) => !hidden[s.name] && s.points.length > 0);
  const allPoints = visible.flatMap((s) => s.points);

  if (allPoints.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-zinc-400">
          Sem trades fechados ainda. A curva aparece aqui assim que você fechar a primeira operação.
        </p>
      </div>
    );
  }

  const W = 1000;
  const H = 300;
  const padL = 44;
  const padR = 64;
  const padT = 18;
  const padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xs = allPoints.map((p) => new Date(p.date).getTime());
  const ys = allPoints.map((p) => p.cum);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yRawMin = Math.min(0, ...ys);
  const yRawMax = Math.max(0, ...ys);
  const yPad = Math.max(0.5, (yRawMax - yRawMin) * 0.1);
  const yMin = yRawMin - yPad;
  const yMax = yRawMax + yPad;

  const xScale = (t: number) =>
    padL + ((t - xMin) / Math.max(1, xMax - xMin)) * innerW;
  const yScale = (v: number) =>
    padT + ((yMax - v) / Math.max(0.01, yMax - yMin)) * innerH;

  const zeroY = yScale(0);
  const yTicks = computeTicks(yMin, yMax, 4);

  // Drawdown calculado em cima da série Total (a primeira)
  const totalSeries = visible[0];
  const drawdown =
    showDrawdown && totalSeries && totalSeries.points.length >= 2
      ? computeDrawdown(totalSeries.points)
      : null;

  // hover tooltip data: pick nearest point per visible series
  const hoverData = useMemo(() => {
    if (hoverX === null) return null;
    const targetX = padL + (hoverX / 100) * innerW;
    const items = visible.map((s) => {
      let nearest = s.points[0];
      let minD = Infinity;
      for (const p of s.points) {
        const px = xScale(new Date(p.date).getTime());
        const d = Math.abs(px - targetX);
        if (d < minD) {
          minD = d;
          nearest = p;
        }
      }
      return { name: s.name, color: s.color, point: nearest, px: xScale(new Date(nearest.date).getTime()), py: yScale(nearest.cum) };
    });
    return items;
  }, [hoverX, visible, innerW]);

  const tooltipDate =
    hoverData && hoverData[0]
      ? new Date(hoverData[0].point.date).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        })
      : null;

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Curva de R acumulado
          </p>
          <p className="mt-0.5 text-sm text-zinc-300">
            Evolução do resultado em R múltiplo ao longo do tempo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {series.map((s) => {
            const off = hidden[s.name];
            return (
              <button
                key={s.name}
                onClick={() => setHidden((h) => ({ ...h, [s.name]: !h[s.name] }))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] uppercase tracking-widest transition",
                  off
                    ? "border-[#f5f5f5]/5 text-zinc-600 hover:text-zinc-400"
                    : "border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.03] text-zinc-300",
                )}
              >
                <span
                  className="h-1.5 w-3 rounded-full"
                  style={{ backgroundColor: off ? "#3f3f46" : s.color }}
                />
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="relative w-full"
        onMouseLeave={() => setHoverX(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const xPct = ((e.clientX - rect.left) / rect.width) * 100;
          setHoverX(Math.max(0, Math.min(100, xPct)));
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-[300px] w-full"
        >
          <defs>
            {visible.map((s) => (
              <linearGradient
                key={s.name}
                id={`fill-${slug(s.name)}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid horizontal */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                y1={yScale(t)}
                x2={W - padR}
                y2={yScale(t)}
                stroke="rgba(245,245,245,0.04)"
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={yScale(t) + 4}
                fontSize="10"
                textAnchor="end"
                fill="rgba(245,245,245,0.4)"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatR(t)}
              </text>
            </g>
          ))}

          {/* Zero line */}
          <line
            x1={padL}
            y1={zeroY}
            x2={W - padR}
            y2={zeroY}
            stroke="rgba(245,245,245,0.18)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Drawdown — faixa rosa entre topo e fundo */}
          {drawdown && (
            (() => {
              const px1 = xScale(new Date(drawdown.peakDate).getTime());
              const px2 = xScale(new Date(drawdown.troughDate).getTime());
              const pyTop = yScale(drawdown.peakValue);
              const pyBottom = yScale(drawdown.troughValue);
              return (
                <g>
                  <rect
                    x={px1}
                    y={pyTop}
                    width={Math.max(2, px2 - px1)}
                    height={Math.max(2, pyBottom - pyTop)}
                    fill="rgba(176,22,35,0.10)"
                    stroke="rgba(176,22,35,0.25)"
                    strokeDasharray="2 3"
                  />
                  <line
                    x1={padL}
                    y1={pyBottom}
                    x2={W - padR}
                    y2={pyBottom}
                    stroke="rgba(176,22,35,0.35)"
                    strokeWidth="1"
                    strokeDasharray="1 3"
                  />
                  <text
                    x={px2 + 6}
                    y={pyBottom - 4}
                    fontSize="10"
                    fill="rgb(251,113,133)"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    DD máx: -{drawdown.maxDD.toFixed(2)}R
                  </text>
                </g>
              );
            })()
          )}

          {/* Curves: area + line */}
          {visible.map((s) => {
            if (s.points.length < 2) {
              // single point: render dot
              const p = s.points[0];
              return (
                <circle
                  key={s.name}
                  cx={xScale(new Date(p.date).getTime())}
                  cy={yScale(p.cum)}
                  r="3"
                  fill={s.color}
                />
              );
            }
            const linePath = s.points
              .map((p, i) => {
                const x = xScale(new Date(p.date).getTime());
                const y = yScale(p.cum);
                return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
              })
              .join(" ");
            const firstX = xScale(new Date(s.points[0].date).getTime());
            const lastX = xScale(new Date(s.points[s.points.length - 1].date).getTime());
            const areaPath = `${linePath} L ${lastX.toFixed(2)} ${zeroY.toFixed(2)} L ${firstX.toFixed(2)} ${zeroY.toFixed(2)} Z`;
            return (
              <g key={s.name}>
                <path d={areaPath} fill={`url(#fill-${slug(s.name)})`} />
                <path
                  d={linePath}
                  stroke={s.color}
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Hover crosshair + pontos */}
          {hoverData && hoverData.length > 0 && (
            <g>
              <line
                x1={hoverData[0].px}
                y1={padT}
                x2={hoverData[0].px}
                y2={H - padB}
                stroke="rgba(245,245,245,0.18)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              {hoverData.map((h) => (
                <g key={h.name}>
                  <circle cx={h.px} cy={h.py} r="5" fill="#0A0A0A" />
                  <circle cx={h.px} cy={h.py} r="4" fill={h.color} />
                </g>
              ))}
            </g>
          )}

          {/* Eixo X labels */}
          <text
            x={padL}
            y={H - 10}
            fontSize="10"
            fill="rgba(245,245,245,0.4)"
            fontFamily="JetBrains Mono, monospace"
          >
            {fmtDate(new Date(xMin))}
          </text>
          <text
            x={W - padR}
            y={H - 10}
            fontSize="10"
            textAnchor="end"
            fill="rgba(245,245,245,0.4)"
            fontFamily="JetBrains Mono, monospace"
          >
            {fmtDate(new Date(xMax))}
          </text>

          {/* Valor final à direita de cada série */}
          {visible.map((s, idx) => {
            const last = s.points[s.points.length - 1];
            if (!last) return null;
            const y = yScale(last.cum);
            return (
              <g key={"label-" + s.name}>
                <rect
                  x={W - padR + 4}
                  y={y - 9 + idx * 0}
                  width="56"
                  height="18"
                  rx="3"
                  fill={s.color}
                  opacity="0.92"
                />
                <text
                  x={W - padR + 32}
                  y={y + 4}
                  fontSize="10"
                  textAnchor="middle"
                  fill="#0A0A0A"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="600"
                >
                  {formatR(last.cum)}
                </text>
              </g>
            );
          })}
        </svg>

        {hoverData && tooltipDate && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border border-[#f5f5f5]/10 bg-charcoal/95 px-2.5 py-2 text-xs backdrop-blur"
            style={{
              left: `calc(${(hoverData[0].px / W) * 100}% + 12px)`,
              transform: hoverData[0].px > W * 0.7 ? "translateX(-110%)" : undefined,
            }}
          >
            <div className="num text-[10px] uppercase tracking-widest text-zinc-500">
              {tooltipDate}
            </div>
            <div className="mt-1 space-y-0.5">
              {hoverData.map((h) => (
                <div key={h.name} className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: h.color }}
                  />
                  <span className="text-zinc-400">{h.name}</span>
                  <span
                    className={cn(
                      "num ml-auto font-medium",
                      h.point.cum > 0
                        ? "text-emerald-400"
                        : h.point.cum < 0
                          ? "text-rose-400"
                          : "text-zinc-300",
                    )}
                  >
                    {formatR(h.point.cum)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatR(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}R`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function computeTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const rough = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step =
    norm < 1.5 ? mag : norm < 3 ? 2 * mag : norm < 7 ? 5 * mag : 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.0001; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return ticks;
}
