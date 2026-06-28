/**
 * Detector heurístico de elementos SMC para overlay no gráfico:
 * Swing Highs/Lows, Liquidez (SSL/BSL), BOS/ChoCh, FVG (Fair Value Gap),
 * Order Blocks (OB), Premium/Discount + zona OTE (61.8 a 78.6 Fib).
 *
 * Não substitui a análise da IA — serve apenas como anotação visual baseada
 * nas regras do checklist SMC.
 */
export type Candle = { t?: number; o: number; h: number; l: number; c: number };

export type SwingPoint = { idx: number; price: number; kind: "high" | "low" };

export type Fvg = {
  startIdx: number;        // índice da vela 1 do padrão de 3 velas
  endIdx: number;          // índice da vela 3
  top: number;             // limite superior do gap
  bottom: number;          // limite inferior do gap
  direction: "bullish" | "bearish";
};

export type OrderBlock = {
  idx: number;
  top: number;
  bottom: number;
  direction: "bullish" | "bearish"; // OB de compra (bullish) ou venda
};

export type StructureBreak = {
  idx: number;             // vela cujo corpo confirmou o rompimento
  level: number;           // nível rompido (swing anterior)
  kind: "BOS" | "ChoCh";
  direction: "up" | "down";
};

export type LiquidityZone = {
  price: number;
  fromIdx: number;
  toIdx: number;            // estende até a última vela
  kind: "BSL" | "SSL";      // BSL = topo (stops de vendidos), SSL = fundo
  equalTouches: number;     // 1 = swing simples, 2+ = EQH/EQL
};

export type OteZone = {
  bottom: number;           // 61.8% do swing
  top: number;              // 78.6% do swing
  fromIdx: number;          // início do swing
  toIdx: number;            // fim do swing
  direction: "bullish" | "bearish"; // bullish = retração para zona de compra
};

export type SmcOverlay = {
  swings: SwingPoint[];
  fvgs: Fvg[];
  obs: OrderBlock[];
  breaks: StructureBreak[];
  liquidity: LiquidityZone[];
  ote: OteZone | null;
};

const SWING_LOOKBACK = 3;          // candles à esquerda/direita para confirmar swing
const EQUAL_TOL_FRAC = 0.0008;     // 0.08% para considerar "equal high/low"
const MIN_BODY_FACTOR = 1.2;       // displacement = corpo > 1.2x média

export function detectSmc(candles: Candle[]): SmcOverlay {
  if (candles.length < 10) {
    return { swings: [], fvgs: [], obs: [], breaks: [], liquidity: [], ote: null };
  }

  const swings = detectSwings(candles, SWING_LOOKBACK);
  const fvgs = detectFvg(candles);
  const allBreaks = detectStructureBreaks(candles, swings);
  const obs = detectOrderBlocks(candles, allBreaks, fvgs);
  const liquidity = detectLiquidity(candles, swings);
  const ote = detectOte(candles, swings);

  // Mantém apenas os 4 breaks mais recentes para plotagem limpa no gráfico
  const breaks = allBreaks.slice(-4);

  return { swings, fvgs, obs, breaks, liquidity, ote };
}

function detectSwings(candles: Candle[], lookback: number): SwingPoint[] {
  const out: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].h >= c.h || candles[i + j].h >= c.h) isHigh = false;
      if (candles[i - j].l <= c.l || candles[i + j].l <= c.l) isLow = false;
    }
    if (isHigh) out.push({ idx: i, price: c.h, kind: "high" });
    if (isLow) out.push({ idx: i, price: c.l, kind: "low" });
  }
  return out;
}

function detectFvg(candles: Candle[]): Fvg[] {
  const out: Fvg[] = [];
  for (let i = 2; i < candles.length; i++) {
    const a = candles[i - 2];
    const c = candles[i];
    // bullish FVG: low da vela 3 > high da vela 1 (gap para cima)
    if (c.l > a.h) {
      out.push({
        startIdx: i - 2,
        endIdx: i,
        top: c.l,
        bottom: a.h,
        direction: "bullish",
      });
    }
    // bearish FVG: high da vela 3 < low da vela 1
    if (c.h < a.l) {
      out.push({
        startIdx: i - 2,
        endIdx: i,
        top: a.l,
        bottom: c.h,
        direction: "bearish",
      });
    }
  }
  // só mantém os últimos 8 para não poluir o gráfico
  return out.slice(-8);
}

function detectStructureBreaks(
  candles: Candle[],
  swings: SwingPoint[],
): StructureBreak[] {
  const breaks: StructureBreak[] = [];
  if (swings.length < 2) return breaks;
  let lastDir: "up" | "down" | null = null;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const body = Math.abs(c.c - c.o);
    if (body === 0) continue;
    // pega último swing high/low antes de i
    const prevHigh = lastSwingBefore(swings, i, "high");
    const prevLow = lastSwingBefore(swings, i, "low");
    if (prevHigh && c.c > prevHigh.price) {
      const kind: "BOS" | "ChoCh" = lastDir === "down" ? "ChoCh" : "BOS";
      breaks.push({ idx: i, level: prevHigh.price, kind, direction: "up" });
      lastDir = "up";
    } else if (prevLow && c.c < prevLow.price) {
      const kind: "BOS" | "ChoCh" = lastDir === "up" ? "ChoCh" : "BOS";
      breaks.push({ idx: i, level: prevLow.price, kind, direction: "down" });
      lastDir = "down";
    }
  }
  return breaks;
}

function lastSwingBefore(
  swings: SwingPoint[],
  beforeIdx: number,
  kind: "high" | "low",
): SwingPoint | null {
  let last: SwingPoint | null = null;
  for (const s of swings) {
    if (s.idx >= beforeIdx) break;
    if (s.kind === kind) last = s;
  }
  return last;
}

function detectOrderBlocks(
  candles: Candle[],
  breaks: StructureBreak[],
  fvgs: Fvg[],
): OrderBlock[] {
  const obs: OrderBlock[] = [];
  
  for (const br of breaks) {
    // 1. Identificar a última vela oposta (bearish para alta, bullish para baixa) nos últimos 10 candles antes do break
    const wantBearish = br.direction === "up";
    let obIdx = -1;
    for (let j = br.idx - 1; j >= Math.max(0, br.idx - 10); j--) {
      const c = candles[j];
      const isBearish = c.c < c.o;
      if (wantBearish === isBearish) {
        obIdx = j;
        break;
      }
    }
    if (obIdx < 0) continue;
    const c = candles[obIdx];
    const top = Math.max(c.o, c.c, c.h);
    const bottom = Math.min(c.o, c.c, c.l);

    // 2. Verificar se o OB foi mitigado (preço fechou abaixo do bottom para compras, ou acima do top para vendas)
    let mitigated = false;
    for (let k = br.idx; k < candles.length; k++) {
      const test = candles[k];
      if (br.direction === "up") {
        if (test.c < bottom) {
          mitigated = true;
          break;
        }
      } else {
        if (test.c > top) {
          mitigated = true;
          break;
        }
      }
    }

    if (!mitigated) {
      // Evita duplicar o mesmo candle como OB
      if (!obs.some((o) => o.idx === obIdx)) {
        obs.push({
          idx: obIdx,
          top,
          bottom,
          direction: br.direction === "up" ? "bullish" : "bearish",
        });
      }
    }
  }

  // Retorna os 3 OBs ativos (não mitigados) mais recentes
  return obs.slice(-3);
}

function detectLiquidity(candles: Candle[], swings: SwingPoint[]): LiquidityZone[] {
  const lastN = 60;
  const startIdx = Math.max(0, candles.length - lastN);
  const recentSwings = swings.filter((s) => s.idx >= startIdx);
  const zones: LiquidityZone[] = [];

  const highs = recentSwings.filter((s) => s.kind === "high");
  const lows = recentSwings.filter((s) => s.kind === "low");

  function group(points: SwingPoint[], kind: "BSL" | "SSL") {
    const used = new Set<number>();
    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;
      const base = points[i];
      const tol = base.price * EQUAL_TOL_FRAC;
      let touches = 1;
      let fromIdx = base.idx;
      for (let j = i + 1; j < points.length; j++) {
        if (Math.abs(points[j].price - base.price) <= tol) {
          touches += 1;
          used.add(j);
          fromIdx = Math.min(fromIdx, points[j].idx);
        }
      }
      // só guarda os 2 níveis mais significativos por lado
      zones.push({
        price: base.price,
        fromIdx,
        toIdx: candles.length - 1,
        kind,
        equalTouches: touches,
      });
    }
  }
  group(highs, "BSL");
  group(lows, "SSL");

  // mantém os mais recentes/significativos
  return zones
    .sort((a, b) => b.equalTouches - a.equalTouches || b.fromIdx - a.fromIdx)
    .slice(0, 6);
}

function detectOte(candles: Candle[], swings: SwingPoint[]): OteZone | null {
  // pega último impulso (último swing high e último swing low)
  if (swings.length < 2) return null;
  const lastHigh = [...swings].reverse().find((s) => s.kind === "high");
  const lastLow = [...swings].reverse().find((s) => s.kind === "low");
  if (!lastHigh || !lastLow) return null;
  // direção: se o high é mais novo, impulso bullish (preço subiu) -> zona OTE de venda?
  // Convenção: bullish OTE = retração de uma perna de alta (low->high), zona para comprar
  const high = lastHigh;
  const low = lastLow;
  const isBullishImpulse = high.idx > low.idx;
  const range = Math.abs(high.price - low.price);
  if (range === 0) return null;
  if (isBullishImpulse) {
    const top = high.price - range * 0.618;
    const bottom = high.price - range * 0.786;
    return {
      bottom,
      top,
      fromIdx: low.idx,
      toIdx: candles.length - 1,
      direction: "bullish",
    };
  } else {
    const bottom = low.price + range * 0.618;
    const top = low.price + range * 0.786;
    return {
      bottom,
      top,
      fromIdx: high.idx,
      toIdx: candles.length - 1,
      direction: "bearish",
    };
  }
}
