/**
 * MOTOR DETERMINÍSTICO DE SINAIS SMC.
 *
 * Ao contrário do scan por LLM (que "lê" as velas em texto e adivinha), aqui a
 * estrutura é CALCULADA em código a partir do detectSmc(): swings, ChoCh/BOS,
 * Order Blocks ativos, FVG, liquidez e Premium/Discount (OTE). O resultado é
 * reproduzível, testável e sem custo de API.
 *
 * Filosofia PREDITIVA: monta o plano ANTES do preço tocar a zona de entrada.
 * Procura um Order Block ativo (POI) do qual o preço está SE APROXIMANDO e
 * devolve entrada (Limit no OB), stop estrutural e alvos na próxima liquidez.
 *
 * A saída é compatível com ScanResult (mesmo shape do aiScan), então o
 * orchestrator persiste do mesmo jeito. A IA passa a ser apenas narradora.
 */
import { detectSmc, type Candle as OverlayCandle } from "./smcOverlay";
import { ema } from "./indicators";
import type { ScanResult, Candle } from "./aiScan";

export type SmcSignalMeta = {
  reason: string;                 // por que houve/não houve setup (para debug/log)
  htfBias: "up" | "down" | "lateral";
  checksTrue: number;
  distanceToEntryPct: number | null;
};

export type SmcSignalOutput = {
  result: ScanResult;
  meta: SmcSignalMeta;
};

/** Tamanho aproximado de um "pip" para o buffer do stop, inferido do preço. */
export function pipSize(price: number): number {
  if (price >= 1000) return 1;        // BTC
  if (price >= 100) return 0.01;      // JPY, XAU (~2000)
  if (price >= 10) return 0.01;
  return 0.0001;                       // majors FX
}

/** ATR simples (média do True Range) das últimas `period` velas. */
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Viés do timeframe superior via inclinação/ordem das EMAs 20 e 50. */
function computeHtfBias(htf: Candle[]): "up" | "down" | "lateral" {
  if (!htf || htf.length < 55) return "lateral";
  const closes = htf.map((c) => c.c);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const i = closes.length - 1;
  const a = e20[i];
  const b = e50[i];
  const last = closes[i];
  if (a === null || b === null) return "lateral";
  if (a > b && last > b) return "up";
  if (a < b && last < b) return "down";
  return "lateral";
}

export function round(v: number, price: number): number {
  const decimals = price >= 100 ? 2 : price >= 1 ? 4 : 5;
  return Number(v.toFixed(decimals));
}

/**
 * Gera um sinal SMC determinístico. Devolve hasSetup=false quando não há um
 * Order Block ativo próximo com confluência mínima.
 */
export function generateSmcSignal(input: {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  htfCandles?: Candle[];
}): SmcSignalOutput {
  const { candles } = input;
  const noSetup = (reason: string, htfBias: "up" | "down" | "lateral"): SmcSignalOutput => ({
    result: { hasSetup: false, direction: "NEUTRO", structure: reason, justification: reason },
    meta: { reason, htfBias, checksTrue: 0, distanceToEntryPct: null },
  });

  if (candles.length < 30) return noSetup("Dados insuficientes (menos de 30 velas).", "lateral");

  const htfBias = computeHtfBias(input.htfCandles ?? []);
  const smc = detectSmc(candles as OverlayCandle[]);
  const price = candles[candles.length - 1].c;
  const a = atr(candles);
  const buf = Math.max(a * 0.15, pipSize(price) * 2);

  // Order Blocks ativos (não mitigados). Escolhemos o mais próximo do preço atual.
  if (smc.obs.length === 0) return noSetup("Nenhum Order Block ativo (POI) no momento.", htfBias);

  // Enriquecemos cada OB com direção de trade e distância até a entrada.
  type Cand = {
    ob: (typeof smc.obs)[number];
    dir: "LONG" | "SHORT";
    entry: number;            // Limit no OB
    stopStructural: number;   // extremo do OB
    distPct: number;
  };
  const cands: Cand[] = smc.obs.map((ob) => {
    const isLong = ob.direction === "bullish";
    const entry = isLong ? ob.top : ob.bottom;         // toca a borda do OB
    const stopStructural = isLong ? ob.bottom : ob.top;
    const distPct = Math.abs(price - entry) / price * 100;
    return { ob, dir: isLong ? "LONG" : "SHORT", entry, stopStructural, distPct };
  });

  // A ENTRADA TEM QUE ESTAR NO FUTURO: se o preço JÁ retestou a borda do OB
  // depois da formação (em qualquer vela fechada anterior à atual), a
  // oportunidade passou — criar sinal agora seria "sinal pós-fato" que nunca
  // executa e fica "Aguardando" para sempre. Só aceitamos OB virgem de reteste
  // (toque apenas na vela ATUAL em formação ainda vale: é a entrada acontecendo).
  const lastIdx = candles.length - 1;
  const notYetRetested = (c: Cand): boolean => {
    const from = Math.min(c.ob.idx + 3, lastIdx); // pula o displacement colado ao OB
    for (let i = from; i < lastIdx; i++) {
      const k = candles[i];
      if (c.dir === "LONG" ? k.l <= c.entry : k.h >= c.entry) return false;
    }
    return true;
  };

  // Só interessa OB do qual o preço está se APROXIMANDO (não atravessou de vez):
  // distância <= 1.2% do preço, ainda não retestado. E, se possível, alinhado ao viés HTF.
  const near = cands
    .filter((c) => c.distPct <= 1.2 && notYetRetested(c))
    .sort((x, y) => x.distPct - y.distPct);
  if (near.length === 0) {
    return noSetup(
      `Sem POI operável: Order Blocks distantes (>1.2%) ou já retestados (entrada ficou no passado).`,
      htfBias,
    );
  }
  // Prioriza OB a favor do viés HTF; se nenhum, pega o mais próximo.
  const chosen =
    near.find((c) => (c.dir === "LONG" && htfBias === "up") || (c.dir === "SHORT" && htfBias === "down")) ??
    near[0];

  const isLong = chosen.dir === "LONG";

  // ---- CHECKLIST (6 itens) calculado deterministicamente ----
  const lastBreak = smc.breaks.length ? smc.breaks[smc.breaks.length - 1] : null;
  const chochOk =
    !!lastBreak &&
    lastBreak.kind === "ChoCh" &&
    ((isLong && lastBreak.direction === "up") || (!isLong && lastBreak.direction === "down"));

  // FVG de displacement na direção do trade, próximo do OB.
  const fvgOk = smc.fvgs.some(
    (f) => (isLong ? f.direction === "bullish" : f.direction === "bearish") && f.endIdx >= chosen.ob.idx,
  );

  // Liquidez alvo do lado oposto (para onde o preço deve ir).
  const targetLiquidity = smc.liquidity
    .filter((z) => (isLong ? z.kind === "BSL" && z.price > chosen.entry : z.kind === "SSL" && z.price < chosen.entry))
    .sort((x, y) => (isLong ? x.price - y.price : y.price - x.price)); // do mais próximo ao mais distante
  const liqOk = targetLiquidity.length > 0;

  // Sweep: houve varrida de liquidez do lado da entrada (pavio fura, corpo volta) perto do OB?
  const sweepOk = detectRecentSweep(candles, chosen.ob.idx, isLong);

  // OB em zona correta via OTE: OB de compra deve estar em Discount, venda em Premium.
  const oteOk = smc.ote
    ? isLong
      ? smc.ote.direction === "bullish"
      : smc.ote.direction === "bearish"
    : chochOk; // se não há OTE clara, aceita se o ChoCh confirmou

  const biasOk = (isLong && htfBias !== "down") || (!isLong && htfBias !== "up");

  const checks = { biasOk, liqOk, sweepOk, fvgOk, chochOk, oteOk };
  const checksTrue = Object.values(checks).filter(Boolean).length;

  // Precisa de pelo menos 4/6 (mesma régua do manual) para virar setup.
  if (checksTrue < 4) {
    return noSetup(
      `Confluência insuficiente (${checksTrue}/6). Faltam: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(", ")}.`,
      htfBias,
    );
  }

  // ---- PLANO DE TRADE ----
  const entry = round(chosen.entry, price);
  const stop = round(isLong ? chosen.stopStructural - buf : chosen.stopStructural + buf, price);
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return noSetup("Stop inválido (risco zero).", htfBias);

  // Alvos: junta a liquidez oposta com reforços em múltiplos de R, ordena NA
  // DIREÇÃO do trade e remove alvos colados (mín. 0.3R de espaçamento). Assim os
  // alvos ficam sempre monotônicos (T1<T2<T3 na compra, inverso na venda).
  const liqPrices = targetLiquidity.map((z) => z.price);
  const reinforcements = [1.5, 2.5, 4].map((m) => (isLong ? entry + risk * m : entry - risk * m));
  const pool = [...liqPrices, ...reinforcements].sort((x, y) => (isLong ? x - y : y - x));
  const minGap = risk * 0.3;
  const targets: number[] = [];
  for (const p of pool) {
    if (isLong ? p <= entry : p >= entry) continue; // alvo tem que estar além da entrada
    const prev = targets[targets.length - 1];
    if (prev === undefined || Math.abs(p - prev) >= minGap) targets.push(p);
    if (targets.length >= 3) break;
  }
  while (targets.length < 3) {
    const last = targets[targets.length - 1] ?? entry;
    targets.push(isLong ? last + risk : last - risk);
  }
  const [t1, t2, t3] = targets.slice(0, 3).map((t) => round(t, price));

  const reward1 = Math.abs(t1 - entry);
  const rr = reward1 / risk;
  if (rr < 0.75) {
    return noSetup(`R:R do Alvo 1 (${rr.toFixed(2)}) abaixo do mínimo. Sem trade.`, htfBias);
  }

  // Sanidade do plano: o preço atual NÃO pode já ter passado do Alvo 1.
  // Comprar com alvo atrás do preço é um plano sem espaço de lucro — o sinal
  // nasceria morto (expiraria de imediato) e dispararia alertas inúteis.
  if (isLong ? price >= t1 : price <= t1) {
    return noSetup(
      `Preço atual (${price}) já está além do Alvo 1 (${t1}). Plano sem espaço — aguardando novo contexto.`,
      htfBias,
    );
  }

  const probability =
    checksTrue >= 6 ? 82 : checksTrue === 5 ? 66 : 48;
  const confidence: "ALTA" | "MEDIA" | "BAIXA" =
    checksTrue >= 6 ? "ALTA" : checksTrue === 5 ? "MEDIA" : "BAIXA";
  const direction: NonNullable<ScanResult["direction"]> = isLong
    ? checksTrue >= 6 ? "COMPRA_FORTE" : "COMPRA_FRACA"
    : checksTrue >= 6 ? "VENDA_FORTE" : "VENDA_FRACA";

  const zoneLow = round(Math.min(chosen.ob.bottom, chosen.ob.top), price);
  const zoneHigh = round(Math.max(chosen.ob.bottom, chosen.ob.top), price);

  const structure = `${isLong ? "Compra" : "Venda"} em Order Block ${isLong ? "bullish" : "bearish"} ${chosen.distPct.toFixed(2)}% do preço. Viés HTF: ${htfBias}. ${chochOk ? "ChoCh confirmado." : "Sem ChoCh no LTF."}`;

  const result: ScanResult = {
    hasSetup: true,
    tipo_setup: isLong ? "Spring" : "Upthrust",
    direction,
    probability,
    confidence,
    checklist_smc: {
      vies_HTF_a_favor: biasOk,
      liquidez_identificada: liqOk,
      sweep_corpo_fecha_dentro: sweepOk,
      displacement_com_FVG: fvgOk,
      ChoCh_confirmado_fechamento: chochOk,
      OB_em_zona_correta: oteOk,
    },
    structure,
    entryPrice: entry,
    entryZoneLow: zoneLow,
    entryZoneHigh: zoneHigh,
    stopPrice: stop,
    target1: t1,
    target2: t2,
    target3: t3,
    recommendedTarget: 2,
    riskReward: `1:${rr.toFixed(1)}`,
    justification: `Plano ${isLong ? "de COMPRA" : "de VENDA"} calculado: entrada Limit em ${entry} (borda do OB), stop estrutural em ${stop}, alvo na liquidez ${isLong ? "BSL" : "SSL"} em ${t1}. Confluências ${checksTrue}/6.`,
  };

  return {
    result,
    meta: { reason: "setup válido", htfBias, checksTrue, distanceToEntryPct: chosen.distPct },
  };
}

/** Detecta um sweep recente perto do OB: pavio fura um extremo mas o corpo fecha de volta. */
function detectRecentSweep(candles: Candle[], obIdx: number, isLong: boolean): boolean {
  const start = Math.max(1, obIdx - 3);
  const end = Math.min(candles.length - 1, obIdx + 3);
  for (let i = start; i <= end; i++) {
    const c = candles[i];
    const prev = candles.slice(Math.max(0, i - 6), i);
    if (prev.length === 0) continue;
    if (isLong) {
      const prevLow = Math.min(...prev.map((p) => p.l));
      // pavio fura o fundo anterior mas o corpo fecha acima dele (Spring)
      if (c.l < prevLow && Math.min(c.o, c.c) > prevLow) return true;
    } else {
      const prevHigh = Math.max(...prev.map((p) => p.h));
      if (c.h > prevHigh && Math.max(c.o, c.c) < prevHigh) return true;
    }
  }
  return false;
}
