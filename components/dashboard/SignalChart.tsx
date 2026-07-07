"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, RotateCcw, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { ema, sma } from "@/lib/indicators";
import { detectSmc, type SmcOverlay } from "@/lib/smcOverlay";

export type ChartCandle = {
  t?: number; // unix seconds
  o: number;
  h: number;
  l: number;
  c: number;
};

type ViewState = {
  visibleCount: number;
  offset: number; // candles from right end
  yZoom: number; // multiplier on auto-fit range (1 = fit)
  yPan: number; // vertical pan in % of range
};

type DragMode = "pan" | "zoomY" | "zoomX" | null;

type TzMode = "BROKER" | "BRT" | "EST" | "GMT" | "UTC";

function formatTimestamp(t: number, mode: TzMode, symbol: string): string {
  const d = new Date(t * 1000);
  let timeZone = "UTC";
  if (mode === "BRT") timeZone = "America/Sao_Paulo";
  else if (mode === "EST") timeZone = "America/New_York";
  else if (mode === "GMT") timeZone = "Europe/London";
  
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
}

const W = 1000;
const H = 360;
const padL = 12;
const padR = 80;
const padT = 16;
const padB = 28;
const innerW = W - padL - padR;
const innerH = H - padT - padB;
const TZ = "America/Sao_Paulo";

type TfKey = "M5" | "M15" | "M30" | "H1" | "H4" | "D1";
const TF_MIN: Record<TfKey, number> = { M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 };
const TF_OPTIONS: TfKey[] = ["M5", "M15", "M30", "H1", "H4", "D1"];

function tfToKey(tf: string): TfKey {
  if (TF_OPTIONS.includes(tf as TfKey)) return tf as TfKey;
  return "M15";
}

/** Agrega candles para um timeframe superior (down-only). Up-aggregation a partir do base. */
function aggregateCandles(base: ChartCandle[], baseTf: TfKey, targetTf: TfKey): ChartCandle[] {
  if (TF_MIN[targetTf] <= TF_MIN[baseTf]) return base;
  if (base.length === 0) return base;
  const factor = TF_MIN[targetTf] / TF_MIN[baseTf];
  if (!Number.isInteger(factor)) return base;
  const out: ChartCandle[] = [];
  // alinha pelo tempo do primeiro candle para garantir agrupamento consistente
  const bucketSec = TF_MIN[targetTf] * 60;
  let bucketStart = -1;
  let cur: ChartCandle | null = null;
  for (const c of base) {
    if (c.t === undefined) continue;
    const b = Math.floor(c.t / bucketSec) * bucketSec;
    if (b !== bucketStart) {
      if (cur) out.push(cur);
      cur = { t: b, o: c.o, h: c.h, l: c.l, c: c.c };
      bucketStart = b;
    } else if (cur) {
      cur.h = Math.max(cur.h, c.h);
      cur.l = Math.min(cur.l, c.l);
      cur.c = c.c;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function SignalChart({
  candles: rawCandles,
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
  timeframe = "M15",
  defaultShowMA = false,
  defaultShowSmc = true,
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
  timeframe?: string;
  defaultShowMA?: boolean;
  defaultShowSmc?: boolean;
}) {
  const dec = useMemo(() => decimals(symbol), [symbol]);
  const baseTf = useMemo(() => tfToKey(timeframe), [timeframe]);
  const [tf, setTf] = useState<TfKey>(baseTf);
  const [tzMode, setTzMode] = useState<TzMode>("BRT");

  // candles ajustadas ao timeframe selecionado (apenas agregação para cima é possível)
  const candles = useMemo(() => aggregateCandles(rawCandles, baseTf, tf), [rawCandles, baseTf, tf]);

  // Visíveis = 70% do total disponível (mín 30, máx 120) para SEMPRE deixar
  // 30% de margem permitindo arrastar para trás e revelar o início do gráfico.
  function computeInitialVisible(total: number): number {
    if (total <= 30) return total;
    const seventy = Math.floor(total * 0.7);
    return Math.max(30, Math.min(120, seventy));
  }
  const initialVisible = computeInitialVisible(candles.length);
  const [view, setView] = useState<ViewState>({
    visibleCount: initialVisible,
    offset: -Math.floor(initialVisible / 2),
    yZoom: 1,
    yPan: 0,
  });

  // ao trocar TF, reseta visualização
  useEffect(() => {
    const vis = computeInitialVisible(candles.length);
    setView({ visibleCount: vis, offset: -Math.floor(vis / 2), yZoom: 1, yPan: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tf, candles.length]);

  const [showMA, setShowMA] = useState(defaultShowMA);
  const [showSmc, setShowSmc] = useState(defaultShowSmc);

  useEffect(() => {
    setShowMA(defaultShowMA);
    setShowSmc(defaultShowSmc);
  }, [defaultShowMA, defaultShowSmc]);

  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const ma = useMemo(() => {
    const closes = candles.map((c) => c.c);
    return {
      ema9: ema(closes, 9),
      ema20: ema(closes, 20),
      ema50: ema(closes, 50),
      sma200: sma(closes, 200),
    };
  }, [candles]);

  const smc: SmcOverlay = useMemo(() => detectSmc(candles), [candles]);

  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startView: ViewState;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { visible, visibleStart } = useMemo(() => {
    const total = candles.length;
    if (total === 0) return { visible: [], visibleStart: 0 };
    const vc = Math.max(10, Math.min(total, view.visibleCount));
    const off = Math.round(view.offset);
    if (off < 0) {
      const activeCount = Math.max(5, vc - Math.abs(off));
      const start = Math.max(0, total - activeCount);
      return { visible: candles.slice(start, total), visibleStart: start };
    } else {
      const clampedOff = Math.max(0, Math.min(total - vc, off));
      const start = Math.max(0, total - vc - clampedOff);
      const end = total - clampedOff;
      return { visible: candles.slice(start, end), visibleStart: start };
    }
  }, [candles, view.visibleCount, view.offset]);

  // Mapeia um índice "full" da série para o índice "in-view", retornando null se fora.
  const toView = useMemo(() => {
    return (idx: number): number | null => {
      if (idx < visibleStart) return null;
      if (idx >= visibleStart + visible.length) return null;
      return idx - visibleStart;
    };
  }, [visibleStart, visible.length]);

  const { yMin, yMax } = useMemo(() => {
    if (visible.length === 0) return { yMin: 0, yMax: 1 };
    const vals = visible.flatMap((c) => [c.h, c.l]);
    [entry, stop, exitPrice].forEach((v) => {
      if (typeof v === "number") vals.push(v);
    });
    targets?.forEach((v) => {
      if (typeof v === "number") vals.push(v);
    });
    if (showMA) {
      const visibleEndIdx = visibleStart + visible.length;
      [ma.ema9, ma.ema20, ma.ema50, ma.sma200].forEach((series) => {
        for (let i = visibleStart; i < visibleEndIdx; i++) {
          const v = series[i];
          if (v !== null && v !== undefined) vals.push(v);
        }
      });
    }
    const autoMin = Math.min(...vals);
    const autoMax = Math.max(...vals);
    const pad = Math.max((autoMax - autoMin) * 0.05, autoMax * 0.00005);
    const baseMin = autoMin - pad;
    const baseMax = autoMax + pad;
    const center = (baseMin + baseMax) / 2;
    const half = (baseMax - baseMin) / 2 / Math.max(0.2, view.yZoom);
    const panAmount = (baseMax - baseMin) * view.yPan;
    return { yMin: center - half + panAmount, yMax: center + half + panAmount };
  }, [visible, entry, stop, exitPrice, targets, view.yZoom, view.yPan, showMA, ma, visibleStart]);

  const range = Math.max(0.0000001, yMax - yMin);
  const candleW = innerW / Math.max(1, view.visibleCount);
  const xOf = (i: number) => padL + i * candleW + candleW / 2;
  const yOf = (v: number) => padT + ((yMax - v) / range) * innerH;

  function clientToSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function detectZone(x: number, y: number): "yScale" | "xScale" | "plot" {
    if (x > W - padR) return "yScale";
    if (y > H - padB) return "xScale";
    return "plot";
  }

  function applyDragMove(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag || !drag.mode) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dxPx = clientX - drag.startX;
    const dyPx = clientY - drag.startY;
    if (drag.mode === "pan") {
      const dxPct = dxPx / rect.width;
      const candleDelta = dxPct * drag.startView.visibleCount;
      const maxOffset = Math.max(0, candles.length - drag.startView.visibleCount);
      const minOffset = -drag.startView.visibleCount + 10;
      const newOffset = Math.max(
        minOffset,
        Math.min(maxOffset, drag.startView.offset + candleDelta),
      );
      const dyPct = dyPx / rect.height;
      const newPan = Math.max(-1.5, Math.min(1.5, drag.startView.yPan + dyPct));
      setView((v) => ({ ...v, offset: newOffset, yPan: newPan }));
    } else if (drag.mode === "zoomY") {
      const dyPct = dyPx / rect.height;
      const newZoom = Math.max(0.3, Math.min(5, drag.startView.yZoom * (1 - dyPct * 2)));
      setView((v) => ({ ...v, yZoom: newZoom }));
    } else if (drag.mode === "zoomX") {
      const dxPct = dxPx / rect.width;
      const factor = 1 + dxPct * 2;
      const newCount = Math.max(
        15,
        Math.min(candles.length, Math.round(drag.startView.visibleCount / factor)),
      );
      setView((v) => ({ ...v, visibleCount: newCount }));
    }
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    const zone = detectZone(x, y);
    let mode: DragMode = "pan";
    if (zone === "yScale") mode = "zoomY";
    else if (zone === "xScale") mode = "zoomX";
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startView: { ...view },
    };
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {}
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    setCursor({ x, y });
    applyDragMove(e.clientX, e.clientY);
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {}
  }

  function reset() {
    const vis = Math.min(candles.length, 120);
    setView({ visibleCount: vis, offset: -Math.floor(vis / 2), yZoom: 1, yPan: 0 });
  }

  // React seta onWheel passivo por padrão em alguns runtimes — registra manualmente
  // como non-passive para conseguir preventDefault() e parar o scroll da página.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      const zone = x > W - padR ? "yScale" : y > H - padB ? "xScale" : "plot";
      if (zone === "yScale") {
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        setView((v) => ({ ...v, yZoom: Math.max(0.3, Math.min(5, v.yZoom * factor)) }));
      } else {
        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        setView((v) => {
          const newCount = Math.max(
            15,
            Math.min(candles.length, Math.round(v.visibleCount * factor)),
          );
          return { ...v, visibleCount: newCount };
        });
      }
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [candles.length]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragRef.current) return;
      applyDragMove(e.clientX, e.clientY);
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles.length]);

  const isZoomedOrPanned =
    view.visibleCount !== computeInitialVisible(candles.length) ||
    view.offset !== 0 ||
    Math.abs(view.yZoom - 1) > 0.01 ||
    Math.abs(view.yPan) > 0.01;

  // Quanto ainda dá pra arrastar para trás (em velas).
  const maxOffsetAvailable = Math.max(0, candles.length - view.visibleCount);
  const noMoreHistory = maxOffsetAvailable === 0;

  if (candles.length === 0) {
    return (
      <div className="grid h-[200px] place-items-center rounded-md border border-white/5 bg-white/[0.01] text-xs text-zinc-500">
        Sem dados de velas
      </div>
    );
  }

  const yTicks = niceTicks(yMin, yMax, 5);

  const xLabels: { x: number; label: string }[] = [];
  if (visible.length > 0 && visible[0].t) {
    const steps = Math.min(5, visible.length);
    for (let i = 0; i < steps; i++) {
      const idx = Math.floor((i * (visible.length - 1)) / Math.max(1, steps - 1));
      const c = visible[idx];
      if (c.t) {
        xLabels.push({ x: xOf(idx), label: formatTimestamp(c.t, tzMode, symbol) });
      }
    }
  }

  const scanIdxFull = useMemo(() => {
    if (!scannedAt) return null;
    const scanUnix = Math.floor(new Date(scannedAt).getTime() / 1000);
    let foundIdx = -1;
    for (let i = 0; i < candles.length; i++) {
      const t = candles[i].t;
      if (t !== undefined) {
        if (t <= scanUnix) {
          foundIdx = i;
        } else {
          break;
        }
      }
    }
    return foundIdx >= 0 ? foundIdx : null;
  }, [candles, scannedAt]);

  const scanIdxInView = scanIdxFull !== null ? toView(scanIdxFull) : null;

  const xLineStart = useMemo(() => {
    if (scanIdxFull === null) return padL;
    if (scanIdxFull < visibleStart) return padL;
    if (scanIdxFull >= visibleStart + visible.length) return W - padR;
    return xOf(scanIdxFull - visibleStart);
  }, [scanIdxFull, visibleStart, visible.length, xOf]);

  const fillIdxFull = findFillIndex(candles, entry, isBuy, scanIdxFull);
  const closeIdxFull =
    fillIdxFull !== null && (status === "WIN" || status === "LOSS")
      ? findCloseIndex(candles, isBuy, stop, target, fillIdxFull)
      : null;

  const xLineEnd = useMemo(() => {
    if (closeIdxFull === null) return W - padR;
    if (closeIdxFull < visibleStart) return padL;
    if (closeIdxFull >= visibleStart + visible.length) return W - padR;
    return xOf(closeIdxFull - visibleStart);
  }, [closeIdxFull, visibleStart, visible.length, xOf]);

  const fillIdxInView =
    fillIdxFull !== null && fillIdxFull >= visibleStart && fillIdxFull < visibleStart + visible.length
      ? fillIdxFull - visibleStart
      : null;
  const closeIdxInView =
    closeIdxFull !== null && closeIdxFull >= visibleStart && closeIdxFull < visibleStart + visible.length
      ? closeIdxFull - visibleStart
      : null;

  const cursorPrice = cursor ? yMax - ((cursor.y - padT) / innerH) * range : null;
  const cursorIdx = cursor
    ? Math.max(0, Math.min(visible.length - 1, Math.floor((cursor.x - padL) / candleW)))
    : null;
  const cursorCandle = cursorIdx !== null ? visible[cursorIdx] : null;

  const cursorStyle = (() => {
    if (!cursor) return "default";
    const zone = detectZone(cursor.x, cursor.y);
    if (dragRef.current?.mode === "pan") return "grabbing";
    if (zone === "yScale") return "ns-resize";
    if (zone === "xScale") return "ew-resize";
    return "grab";
  })();

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.015]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-white/[0.02] px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
        <span className="flex items-center gap-2">
          <span className="num text-zinc-300">{symbol}</span>
          <span className="text-zinc-600">·</span>
          <span>{visible.length} de {candles.length} velas</span>
          <LiveClocks symbol={symbol} />
        </span>
        <span className="flex items-center gap-2">
          {/* Seletor de timeframe — destacado */}
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/[0.04] px-1.5 py-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-emerald-400">TF</span>
            <span className="flex items-center gap-0.5">
              {TF_OPTIONS.map((opt) => {
                const disabled = TF_MIN[opt] < TF_MIN[baseTf];
                return (
                  <button
                    key={opt}
                    onClick={() => !disabled && setTf(opt)}
                    disabled={disabled}
                    title={disabled ? `Sem dados para ${opt} (base é ${baseTf})` : `Mudar para ${opt}`}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition",
                      tf === opt
                        ? "bg-emerald-500/30 text-emerald-200 ring-1 ring-emerald-400/50"
                        : disabled
                          ? "text-zinc-700 cursor-not-allowed"
                          : "text-zinc-300 hover:bg-white/[0.05] hover:text-emerald-200",
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </span>
          </span>
          {/* Seletor de Timezone */}
          <select
            value={tzMode}
            onChange={(e) => setTzMode(e.target.value as TzMode)}
            className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-300 outline-none hover:bg-white/[0.08]"
          >
            <option value="BROKER" className="bg-[#0a0a0a] text-zinc-300">EXCHANGE</option>
            <option value="BRT" className="bg-[#0a0a0a] text-zinc-300">BRASIL (GMT-3)</option>
            <option value="EST" className="bg-[#0a0a0a] text-zinc-300">NY (GMT-4)</option>
            <option value="GMT" className="bg-[#0a0a0a] text-zinc-300">LONDRES (GMT+1)</option>
            <option value="UTC" className="bg-[#0a0a0a] text-zinc-300">UTC (GMT+0)</option>
          </select>

          {/* Navegação Manual */}
          <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] p-0.5 gap-0.5">
            <button
              onClick={() => {
                setView((v) => {
                  const shift = Math.max(1, Math.round(v.visibleCount * 0.15));
                  const maxOffset = Math.max(0, candles.length - v.visibleCount);
                  return { ...v, offset: Math.min(maxOffset, v.offset + shift) };
                });
              }}
              className="rounded px-1 py-0.5 text-[9px] font-bold text-zinc-300 hover:bg-white/[0.08]"
              title="Voltar no tempo (Esquerda)"
            >
              &larr;
            </button>
            <button
              onClick={() => {
                setView((v) => {
                  const shift = Math.max(1, Math.round(v.visibleCount * 0.15));
                  const minOffset = -v.visibleCount + 10;
                  return { ...v, offset: Math.max(minOffset, v.offset - shift) };
                });
              }}
              className="rounded px-1 py-0.5 text-[9px] font-bold text-zinc-300 hover:bg-white/[0.08]"
              title="Avançar no tempo (Direita)"
            >
              &rarr;
            </button>
          </span>

          {/* Zoom Manual */}
          <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] p-0.5 gap-0.5">
            <button
              onClick={() => {
                setView((v) => {
                  const newCount = Math.max(15, Math.round(v.visibleCount * 0.8));
                  return { ...v, visibleCount: newCount };
                });
              }}
              className="rounded px-1.5 py-0.5 text-[9px] font-bold text-zinc-300 hover:bg-white/[0.08]"
              title="Aumentar Zoom (+)"
            >
              +
            </button>
            <button
              onClick={() => {
                setView((v) => {
                  const newCount = Math.min(candles.length, Math.round(v.visibleCount * 1.25));
                  return { ...v, visibleCount: newCount };
                });
              }}
              className="rounded px-1.5 py-0.5 text-[9px] font-bold text-zinc-300 hover:bg-white/[0.08]"
              title="Diminuir Zoom (-)"
            >
              -
            </button>
          </span>

          <span className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] tracking-widest sm:inline-flex">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            {new Date(scannedAt).toLocaleTimeString("pt-BR", { timeZone: TZ })}
          </span>
          <button
            onClick={() => setShowSmc((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
              showSmc
                ? "border-emerald-500/40 bg-emerald-500/[0.10] text-emerald-300"
                : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-zinc-200",
            )}
            title="Mostrar overlays SMC (FVG, OB, BOS, OTE, liquidez)"
          >
            <Layers className="h-3 w-3" />
            SMC
          </button>
          <button
            onClick={() => setShowMA((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition",
              showMA
                ? "border-blue-500/40 bg-blue-500/[0.10] text-blue-300"
                : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-zinc-200",
            )}
            title="Mostrar médias móveis"
          >
            <Activity className="h-3 w-3" />
            MAs
          </button>
          {isZoomedOrPanned && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-zinc-300 hover:bg-white/[0.08]"
              title="Resetar visualização"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
        </span>
      </div>

      {/* Aviso quando não há mais histórico para arrastar */}
      {noMoreHistory && candles.length > 0 && (
        <div className="border-b border-white/5 bg-amber-500/[0.04] px-3 py-1 text-[9px] uppercase tracking-widest text-amber-300/80">
          fim do histórico ({candles.length} velas) — para arrastar mais para trás, aguarde o EA acumular mais barras ou reduza o zoom (roda do mouse)
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-[360px] w-full select-none touch-none"
        style={{ cursor: cursorStyle }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={reset}
      >
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

        <rect x={W - padR} y={padT} width={padR} height={innerH} fill="rgba(255,255,255,0.005)" />
        <rect x={padL} y={H - padB} width={innerW} height={padB} fill="rgba(255,255,255,0.005)" />

        {/* ====== OVERLAYS SMC (atrás das velas) ====== */}
        {showSmc && (
          <g pointerEvents="none">
            {/* OTE zone */}
            {smc.ote && (() => {
              const yTop = yOf(smc.ote.top);
              const yBot = yOf(smc.ote.bottom);
              const x1 = padL;
              const x2 = W - padR;
              const fill = smc.ote.direction === "bullish" ? "rgba(16,185,129,0.07)" : "rgba(244,63,94,0.07)";
              const stroke = smc.ote.direction === "bullish" ? "rgba(16,185,129,0.35)" : "rgba(244,63,94,0.35)";
              return (
                <g>
                  <rect x={x1} y={Math.min(yTop, yBot)} width={x2 - x1} height={Math.abs(yBot - yTop)} fill={fill} stroke={stroke} strokeDasharray="3 3" />
                  <text x={x1 + 4} y={Math.min(yTop, yBot) + 9} fontSize="8" fill={stroke} fontFamily="JetBrains Mono, monospace">
                    OTE 61.8–78.6
                  </text>
                </g>
              );
            })()}

            {/* FVGs — apenas os não preenchidos pelo preço */}
            {smc.fvgs.filter(f => {
              // Considera FVG "intacto" se as velas após ele não cruzaram a zona
              const testCandles = visible.slice(Math.max(0, (toView(f.endIdx) ?? 0) + 1));
              if (testCandles.length === 0) return true;
              // FVG bullish: preenchido se alguma vela teve low <= bottom do gap
              if (f.direction === "bullish") return !testCandles.some(c => c.l <= f.bottom);
              // FVG bearish: preenchido se alguma vela teve high >= top do gap
              return !testCandles.some(c => c.h >= f.top);
            }).map((f, i) => {
              const sIdx = toView(f.startIdx);
              const eIdx = toView(f.endIdx);
              if (sIdx === null && eIdx === null) return null;
              // FVG se estende da sua origem até o final da tela (permanece aberto)
              const x1 = xOf(sIdx ?? 0) - candleW / 2;
              const x2 = W - padR;
              const fill = f.direction === "bullish" ? "rgba(16,185,129,0.09)" : "rgba(244,63,94,0.09)";
              const stroke = f.direction === "bullish" ? "rgba(16,185,129,0.5)" : "rgba(244,63,94,0.5)";
              const yT = yOf(f.top);
              const yB = yOf(f.bottom);
              const midY = (yT + yB) / 2; // CE — Consequent Encroachment (ponto de entrada)
              return (
                <g key={`fvg-${i}`}>
                  <rect x={x1} y={Math.min(yT, yB)} width={Math.max(2, x2 - x1)} height={Math.abs(yB - yT)} fill={fill} />
                  <rect x={x1} y={Math.min(yT, yB)} width={Math.max(2, x2 - x1)} height={Math.abs(yB - yT)} fill="none" stroke={stroke} strokeWidth="0.5" />
                  {/* CE line — ponto de entrada ótimo no meio do FVG */}
                  <line x1={x1} y1={midY} x2={x2} y2={midY} stroke={stroke} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.7" />
                  <text x={x2 - 40} y={Math.min(yT, yB) + 8} fontSize="7" fill={stroke} fontFamily="JetBrains Mono, monospace" opacity="0.9">
                    FVG {f.direction === "bullish" ? "▲" : "▼"}
                  </text>
                  <text x={x2 - 16} y={midY - 2} fontSize="6" fill={stroke} fontFamily="JetBrains Mono, monospace" opacity="0.7">CE</text>
                </g>
              );
            })}

            {/* Order Blocks — largura limitada a ~25 candles à frente */}
            {smc.obs.map((ob, i) => {
              const idx = toView(ob.idx);
              if (idx === null) return null;
              const x1 = xOf(idx) - candleW / 2;
              // Limita o OB a no máximo 25 candles à frente (não spans o gráfico todo)
              const obEndIdx = Math.min(visible.length - 1, idx + 25);
              const x2 = Math.min(W - padR, xOf(obEndIdx) + candleW / 2);
              const fill = ob.direction === "bullish" ? "rgba(59,130,246,0.12)" : "rgba(168,85,247,0.12)";
              const stroke = ob.direction === "bullish" ? "rgba(59,130,246,0.6)" : "rgba(168,85,247,0.6)";
              const yT = yOf(ob.top);
              const yB = yOf(ob.bottom);
              return (
                <g key={`ob-${i}`}>
                  <rect x={x1} y={Math.min(yT, yB)} width={Math.max(4, x2 - x1)} height={Math.abs(yB - yT)} fill={fill} />
                  {/* Borda esquerda mais grossa para marcar origem do OB */}
                  <line x1={x1 + 1} y1={Math.min(yT, yB)} x2={x1 + 1} y2={Math.max(yT, yB)} stroke={stroke} strokeWidth="2" />
                  <rect x={x1} y={Math.min(yT, yB)} width={Math.max(4, x2 - x1)} height={Math.abs(yB - yT)} fill="none" stroke={stroke} strokeWidth="0.5" strokeDasharray="3 2" />
                  <text x={x1 + 4} y={Math.min(yT, yB) + 9} fontSize="7" fill={stroke} fontFamily="JetBrains Mono, monospace">
                    OB {ob.direction === "bullish" ? "▲" : "▼"}
                  </text>
                </g>
              );
            })}

            {/* Liquidity (SSL/BSL) */}
            {smc.liquidity.map((lq, i) => {
              const from = toView(lq.fromIdx);
              const x1 = xOf(from ?? 0);
              const x2 = W - padR;
              const color = lq.kind === "BSL" ? "rgba(244,63,94,0.6)" : "rgba(16,185,129,0.6)";
              const y = yOf(lq.price);
              return (
                <g key={`lq-${i}`}>
                  <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="1" strokeDasharray="6 3" />
                  <text x={x2 - 28} y={y - 2} fontSize="8" fill={color} fontFamily="JetBrains Mono, monospace">
                    {lq.kind}{lq.equalTouches > 1 ? `×${lq.equalTouches}` : ""}
                  </text>
                </g>
              );
            })}

            {/* BOS / ChoCh */}
            {smc.breaks.map((br, i) => {
              const idx = toView(br.idx);
              if (idx === null) return null;
              const x = xOf(idx);
              const y = yOf(br.level);
              const color = br.kind === "ChoCh" ? "#F59E0B" : "#A78BFA";
              return (
                <g key={`br-${i}`}>
                  <line x1={x - 30} y1={y} x2={x + 8} y2={y} stroke={color} strokeWidth="1" />
                  <text x={x + 10} y={y + 3} fontSize="8" fill={color} fontFamily="JetBrains Mono, monospace">
                    {br.kind} {br.direction === "up" ? "↑" : "↓"}
                  </text>
                </g>
              );
            })}

            {/* Swings — apenas os 8 mais recentes para não poluir */}
            {smc.swings.slice(-8).map((sw, i) => {
              const idx = toView(sw.idx);
              if (idx === null) return null;
              const x = xOf(idx);
              const y = yOf(sw.price);
              const color = sw.kind === "high" ? "rgba(244,63,94,0.75)" : "rgba(16,185,129,0.75)";
              const dy = sw.kind === "high" ? -8 : 8;
              return (
                <g key={`sw-${i}`}>
                  {/* Triângulo indicador de swing */}
                  {sw.kind === "high"
                    ? <polygon points={`${x},${y - 3} ${x - 4},${y - 9} ${x + 4},${y - 9}`} fill={color} opacity="0.8" />
                    : <polygon points={`${x},${y + 3} ${x - 4},${y + 9} ${x + 4},${y + 9}`} fill={color} opacity="0.8" />
                  }
                  <text x={x} y={y + dy + (sw.kind === "high" ? -2 : 5)} fontSize="7" textAnchor="middle" fill={color} fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    {sw.kind === "high" ? "HH" : "LL"}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Linha vertical do momento da detecção do sinal */}
        {scanIdxInView !== null && (
          <g pointerEvents="none">
            <line
              x1={xOf(scanIdxInView)}
              y1={padT}
              x2={xOf(scanIdxInView)}
              y2={H - padB}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <rect
              x={xOf(scanIdxInView) - 27}
              y={H - padB - 18}
              width="54"
              height="14"
              rx="3"
              fill="rgba(255, 255, 255, 0.15)"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="0.5"
            />
            <text
              x={xOf(scanIdxInView)}
              y={H - padB - 8}
              fontSize="7"
              fontWeight="700"
              textAnchor="middle"
              fill="rgba(255, 255, 255, 0.85)"
              fontFamily="JetBrains Mono, monospace"
            >
              DETECÇÃO
            </text>
          </g>
        )}

        {/* Premium/Discount — calculado pelo preço real (50% do range visível) */}
        {showSmc && (() => {
          const midPrice = (yMax + yMin) / 2;
          const yMid = yOf(midPrice);
          const yTop = yOf(yMax);
          const yBot = yOf(yMin);
          return (
            <g pointerEvents="none">
              {/* Zona Premium (acima do equilíbrio) — vermelho suave */}
              <rect x={padL} y={yTop} width={innerW} height={Math.max(0, yMid - yTop)} fill="rgba(244,63,94,0.012)" />
              {/* Zona Discount (abaixo do equilíbrio) — verde suave */}
              <rect x={padL} y={yMid} width={innerW} height={Math.max(0, yBot - yMid)} fill="rgba(16,185,129,0.012)" />
              {/* Linha de Equilíbrio (50%) */}
              <line x1={padL} y1={yMid} x2={W - padR} y2={yMid} stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={padL + 6} y={yMid - 3} fontSize="7" fill="rgba(255,255,255,0.22)" fontFamily="JetBrains Mono, monospace">EQ 50% — Premium ▲ / Discount ▼</text>
            </g>
          );
        })()}

        {entry !== null && (
          <PriceLine
            y={yOf(entry)}
            price={entry}
            label="E"
            color="#8B5CF6"
            dec={dec}
            solid
            x1={padL}
            x2={W - padR}
          />
        )}
        {stop !== null && (
          <PriceLine
            y={yOf(stop)}
            price={stop}
            label="SL"
            color="#EF4444"
            dec={dec}
            solid
            x1={padL}
            x2={W - padR}
          />
        )}
        {targets && targets.length > 0
          ? targets.map((tv, i) => {
              if (typeof tv !== "number") return null;
              const isRec = (recommendedTarget ?? 1) === i + 1;
              const colors = ["#34D399", "#10B981", "#047857"];
              const color = colors[i] ?? "#10B981";

              let pipsText = "";
              let pctText = "";
              if (entry !== null) {
                const diff = Math.abs(tv - entry);
                pipsText = `${calcPips(diff, symbol)}`;
                const pct = (diff / entry) * 100;
                pctText = `+${pct.toFixed(1)}%`;
              }

              return (
                <PriceLine
                  key={i}
                  y={yOf(tv)}
                  price={tv}
                  label={`TP${i + 1}${isRec ? " ★" : ""}`}
                  color={color}
                  dec={dec}
                  solid={false}
                  x1={padL}
                  x2={W - padR}
                  pipsText={pipsText}
                  pctText={pctText}
                />
              );
            })
          : target !== null && (
              <PriceLine
                y={yOf(target)}
                price={target}
                label="TP"
                color="#10B981"
                dec={dec}
                solid={false}
                x1={padL}
                x2={W - padR}
                pipsText={entry !== null ? `${calcPips(Math.abs(target - entry), symbol)}` : undefined}
                pctText={entry !== null ? `+${((Math.abs(target - entry) / entry) * 100).toFixed(1)}%` : undefined}
              />
            )}

        {/* Linha de saída SÓ quando a operação está concluída — com o trade aberto,
            exitPrice pode conter a parcial do TP1 e mostrava "SAÍDA ✗" indevida. */}
        {typeof exitPrice === "number" && (status === "WIN" || status === "LOSS") && (
          <PriceLine
            y={yOf(exitPrice)}
            price={exitPrice}
            label={status === "WIN" ? "SAÍDA ✓" : "SAÍDA ✗"}
            color={status === "WIN" ? "#34D399" : "#FB7185"}
            dec={dec}
            solid
            thick
            x1={padL}
            x2={W - padR}
          />
        )}

        {showMA && (
          <g pointerEvents="none">
            {(["sma200", "ema50", "ema20", "ema9"] as const).map((key) => {
              const meta = MA_META[key];
              const series = ma[key];
              const path = buildMaPath(series, visibleStart, visible.length, xOf, yOf);
              if (!path) return null;
              return (
                <path
                  key={key}
                  d={path}
                  stroke={meta.color}
                  strokeWidth={meta.width}
                  fill="none"
                  opacity="0.92"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        )}

        {/*
          Estilo MetaTrader/MT5: velas de alta OCAS (só o contorno), velas de
          baixa PREENCHIDAS. Corpo mais largo (0.78x da coluna), coords em pixel
          inteiro e wick alinhado ao centro do corpo para não borrar.
        */}
        <g shapeRendering="crispEdges">
          {visible.map((c, i) => {
            const isUp = c.c >= c.o;
            const up = "#26A69A";   // verde MT5 (alta)
            const down = "#EF5350"; // vermelho MT5 (baixa)
            const color = isUp ? up : down;

            const yH = yOf(c.h);
            const yL = yOf(c.l);
            const yO = yOf(c.o);
            const yC = yOf(c.c);

            // corpo 78% da largura da coluna (mín 2px), largura ímpar p/ o wick
            // (1px) cair no centro exato do corpo sem antialiasing borrar.
            let w = Math.max(2, Math.round(candleW * 0.78));
            if (w % 2 === 0) w -= 1;
            const cxI = Math.round(xOf(i));
            const xI = cxI - Math.floor(w / 2);

            const yTopI = Math.round(Math.min(yO, yC));
            const yBotI = Math.round(Math.max(yO, yC));
            const bodyH = Math.max(1, yBotI - yTopI);

            const yHI = Math.round(yH);
            const yLI = Math.round(yL);

            // Doji (open ≈ close): desenha uma linha horizontal em vez do corpo
            // de 1px que ficava "sumido" no gráfico.
            const isDoji = Math.abs(yC - yO) < 0.6;

            return (
              <g key={i}>
                {/* wick de alta (acima do corpo) */}
                {yHI < yTopI && (
                  <line
                    x1={cxI + 0.5}
                    y1={yHI}
                    x2={cxI + 0.5}
                    y2={yTopI}
                    stroke={color}
                    strokeWidth="1"
                  />
                )}
                {/* wick de baixa (abaixo do corpo) */}
                {yLI > yBotI && (
                  <line
                    x1={cxI + 0.5}
                    y1={yBotI}
                    x2={cxI + 0.5}
                    y2={yLI}
                    stroke={color}
                    strokeWidth="1"
                  />
                )}
                {isDoji ? (
                  <line
                    x1={xI}
                    y1={yTopI + 0.5}
                    x2={xI + w}
                    y2={yTopI + 0.5}
                    stroke={color}
                    strokeWidth="1"
                  />
                ) : isUp ? (
                  // vela de alta: OCA (fundo do fundo do gráfico + contorno)
                  <rect
                    x={xI}
                    y={yTopI}
                    width={w}
                    height={bodyH}
                    fill="#0A0A0A"
                    stroke={color}
                    strokeWidth="1"
                  />
                ) : (
                  // vela de baixa: preenchida (padrão MT5)
                  <rect
                    x={xI}
                    y={yTopI}
                    width={w}
                    height={bodyH}
                    fill={color}
                    stroke={color}
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Bolinha de execução: o preço TOCOU a entrada programada neste candle */}
        {fillIdxInView !== null && entry !== null && (
          <g>
            <circle cx={xOf(fillIdxInView)} cy={yOf(entry)} r="7" fill="#0A0A0A" stroke="#10B981" strokeWidth="2" />
            <circle cx={xOf(fillIdxInView)} cy={yOf(entry)} r="3" fill="#10B981" />
            <rect
              x={xOf(fillIdxInView) + 10}
              y={yOf(entry) - 9}
              width="74"
              height="16"
              rx="3"
              fill="rgba(16,185,129,0.15)"
              stroke="rgba(16,185,129,0.5)"
            />
            <text
              x={xOf(fillIdxInView) + 16}
              y={yOf(entry) + 3}
              fontSize="9"
              fontWeight="700"
              fill="#34D399"
              fontFamily="JetBrains Mono, monospace"
            >
              ENTRADA ✓
            </text>
          </g>
        )}

        {closeIdxInView !== null && typeof exitPrice === "number" && (
          <g>
            <circle
              cx={xOf(closeIdxInView)}
              cy={yOf(exitPrice)}
              r="8"
              fill={status === "WIN" ? "#34D399" : "#FB7185"}
              opacity="0.94"
            />
            <text
              x={xOf(closeIdxInView)}
              y={yOf(exitPrice) + 4}
              fontSize="12"
              fontWeight="700"
              textAnchor="middle"
              fill="#0A0A0A"
              fontFamily="JetBrains Mono, monospace"
            >
              {status === "WIN" ? "✓" : "✗"}
            </text>
          </g>
        )}

        {cursor && (
          <g pointerEvents="none">
            <line x1={cursor.x} y1={padT} x2={cursor.x} y2={H - padB} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="2 3" />
            <line x1={padL} y1={cursor.y} x2={W - padR} y2={cursor.y} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="2 3" />
            {cursorPrice !== null && (
              <g>
                <rect x={W - padR + 4} y={cursor.y - 9} width="72" height="18" rx="3" fill="#0A0A0A" stroke="rgba(255,255,255,0.3)" />
                <text
                  x={W - padR + 40}
                  y={cursor.y + 4}
                  fontSize="10"
                  textAnchor="middle"
                  fill="#F5F5F7"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {cursorPrice.toFixed(dec)}
                </text>
              </g>
            )}
            {cursorCandle?.t && (
              <g>
                <rect x={cursor.x - 52} y={H - padB + 2} width="104" height="18" rx="3" fill="#0A0A0A" stroke="rgba(255,255,255,0.3)" />
                <text
                  x={cursor.x}
                  y={H - padB + 14}
                  fontSize="10"
                  textAnchor="middle"
                  fill="#F5F5F7"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {formatTimestamp(cursorCandle.t, tzMode, symbol)}
                </text>
              </g>
            )}
          </g>
        )}

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

        {(status === "WIN" || status === "LOSS") && (
          <g pointerEvents="none">
            <rect
              x={padL + 8}
              y={padT + 8}
              width="138"
              height="32"
              rx="6"
              fill={status === "WIN" ? "rgba(16,185,129,0.20)" : "rgba(244,63,94,0.20)"}
              stroke={status === "WIN" ? "rgba(16,185,129,0.6)" : "rgba(244,63,94,0.6)"}
            />
            <text
              x={padL + 18}
              y={padT + 28}
              fontSize="12"
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

        {(status === "PENDING" || status === "FILLED") && (
          <g pointerEvents="none">
            <rect
              x={padL + 8}
              y={padT + 8}
              width="160"
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

        {showMA && (
          <g pointerEvents="none">
            {(() => {
              const last = visibleStart + visible.length - 1;
              const items: { label: string; color: string; v: number | null }[] = [
                { label: "EMA 9", color: MA_META.ema9.color, v: ma.ema9[last] ?? null },
                { label: "EMA 20", color: MA_META.ema20.color, v: ma.ema20[last] ?? null },
                { label: "EMA 50", color: MA_META.ema50.color, v: ma.ema50[last] ?? null },
                { label: "SMA 200", color: MA_META.sma200.color, v: ma.sma200[last] ?? null },
              ];
              const x = W - padR - 130;
              const y0 = padT + 6;
              return items.map((it, idx) => (
                <g key={it.label} transform={`translate(${x}, ${y0 + idx * 12})`}>
                  <rect width="8" height="2" y={4} fill={it.color} />
                  <text
                    x={14}
                    y={9}
                    fontSize="9"
                    fill={it.color}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {it.label} {it.v !== null ? it.v.toFixed(dec) : "—"}
                  </text>
                </g>
              ));
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}

const MA_META = {
  ema9: { color: "#FBBF24", width: 1.2 },
  ema20: { color: "#F97316", width: 1.4 },
  ema50: { color: "#3B82F6", width: 1.6 },
  sma200: { color: "#E4E4E7", width: 1.8 },
} as const;

function buildMaPath(
  series: (number | null)[],
  startIdx: number,
  count: number,
  xOf: (i: number) => number,
  yOf: (v: number) => number,
): string {
  let path = "";
  let lastWasNull = true;
  for (let i = 0; i < count; i++) {
    const v = series[startIdx + i];
    if (v === null || v === undefined) {
      lastWasNull = true;
      continue;
    }
    path += `${lastWasNull ? "M" : "L"} ${xOf(i).toFixed(2)} ${yOf(v).toFixed(2)} `;
    lastWasNull = false;
  }
  return path.trim();
}

function calcPips(diff: number, symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.includes("BTC") || s.includes("ETH") || s.includes("SOL") || s.includes("XRP") || s.includes("BNB") || s.includes("ADA")) {
    return `$${diff.toFixed(2)}`;
  }
  if (s.includes("XAU") || s.includes("GOLD")) {
    return `${(diff * 10).toFixed(1)} pips`;
  }
  if (s.includes("JPY")) {
    return `${(diff * 100).toFixed(1)} pips`;
  }
  return `${(diff * 10000).toFixed(1)} pips`;
}

function PriceLine({
  y,
  price,
  label,
  color,
  dec,
  solid,
  thick,
  x1,
  x2,
  pipsText,
  pctText,
}: {
  y: number;
  price: number;
  label: string;
  color: string;
  dec: number;
  solid: boolean;
  thick?: boolean;
  x1: number;
  x2: number;
  pipsText?: string;
  pctText?: string;
}) {
  return (
    <g pointerEvents="none">
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke={color}
        strokeWidth={thick ? "1.5" : "1"}
        strokeDasharray={solid ? undefined : "4 4"}
        opacity={solid ? 0.85 : 0.7}
      />
      <rect x={W - padR + 4} y={y - 8} width="72" height="16" rx="3" fill={color} opacity="0.92" />
      <text
        x={W - padR + 6}
        y={y + 4}
        fontSize="9"
        fontWeight="700"
        fill="#0A0A0A"
        fontFamily="JetBrains Mono, monospace"
      >
        {label}
      </text>
      <text
        x={x1 + 6}
        y={y - 3}
        fontSize="9"
        fontWeight="600"
        fill={color}
        fontFamily="JetBrains Mono, monospace"
      >
        {price.toFixed(dec)}
      </text>
      {(pipsText || pctText) && (
        <text
          x={x1 + 90}
          y={y - 3}
          fontSize="9"
          fontWeight="500"
          fill={color}
          opacity="0.85"
          fontFamily="JetBrains Mono, monospace"
        >
          {pipsText ? `${pipsText}` : ""}{pctText ? ` (${pctText})` : ""}
        </text>
      )}
    </g>
  );
}

function findFillIndex(
  candles: ChartCandle[],
  entry: number | null,
  isBuy: boolean,
  scanIdx: number | null
): number | null {
  if (entry === null) return null;
  const start = scanIdx !== null ? scanIdx : 0;
  for (let i = start; i < candles.length; i++) {
    const c = candles[i];
    if (c.l <= entry && c.h >= entry) return i;
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

function fmtTimestampBR(t: number): string {
  const d = new Date(t * 1000);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(d);
}

function marketTzFor(symbol: string): { tz: string; label: string } {
  const s = symbol.toUpperCase();
  if (s.includes("XAU") || s.includes("GOLD") || s.includes("XAG") || s.includes("SILVER") || s.includes("WTI") || s.includes("USOIL") || s.includes("BRENT")) {
    return { tz: "America/New_York", label: "NY" };
  }
  if (s.endsWith("JPY") || s.endsWith("JPYXX") || s.endsWith("JPYM") || s.includes("JPY")) {
    return { tz: "Asia/Tokyo", label: "Tóquio" };
  }
  if (s.startsWith("GBP") || s.includes("GBP")) {
    return { tz: "Europe/London", label: "Londres" };
  }
  if (s.startsWith("EUR") || s.includes("EUR")) {
    return { tz: "Europe/Berlin", label: "Frankfurt" };
  }
  return { tz: "America/New_York", label: "NY" };
}

function LiveClocks({ symbol }: { symbol: string }) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const market = marketTzFor(symbol);
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(now);
  return (
    <span className="hidden items-center gap-2 sm:inline-flex">
      <span className="text-zinc-600">·</span>
      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] tracking-widest">
        <span className="text-zinc-500">BR</span>
        <span className="num text-zinc-200">{fmt(TZ)}</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] tracking-widest">
        <span className="text-zinc-500">{market.label}</span>
        <span className="num text-zinc-200">{fmt(market.tz)}</span>
      </span>
    </span>
  );
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
