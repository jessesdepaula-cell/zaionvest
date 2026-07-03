/**
 * MOTOR DETERMINÍSTICO — MÉTODO DO GORILA.
 *
 * Implementa em código os gatilhos do manual (gorilaManual.ts):
 *   PC (Ponto Contínuo, pullback à MMA21) > 9.2 > 9.1, com Agulhada como
 * confluência. Contexto obrigatório: alinhamento das médias, fator
 * proximidade (não operar esticado) e viés do timeframe superior.
 *
 * A entrada é uma ordem STOP no rompimento do candle de referência (1 tick
 * além), exatamente como o método manda — ou seja, o sinal nasce ANTES do
 * rompimento acontecer (antecipação real). Saída compatível com ScanResult.
 */
import { ema, sma } from "./indicators";
import { atr, pipSize, round } from "./smcSignal";
import type { ScanResult, Candle } from "./aiScan";

export type GorilaSignalMeta = {
  reason: string;
  trend: "up" | "down" | "lateral";
  setup: "PC" | "9.2" | "9.1" | null;
  checksTrue: number;
  distanceToEntryPct: number | null;
};

export type GorilaSignalOutput = {
  result: ScanResult;
  meta: GorilaSignalMeta;
};

function htfBias(htf: Candle[]): "up" | "down" | "lateral" {
  if (!htf || htf.length < 55) return "lateral";
  const closes = htf.map((c) => c.c);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const i = closes.length - 1;
  if (e20[i] === null || e50[i] === null) return "lateral";
  if (e20[i]! > e50[i]! && closes[i] > e50[i]!) return "up";
  if (e20[i]! < e50[i]! && closes[i] < e50[i]!) return "down";
  return "lateral";
}

export function generateGorilaSignal(input: {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  htfCandles?: Candle[];
}): GorilaSignalOutput {
  const { candles } = input;
  const noSetup = (
    reason: string,
    trend: "up" | "down" | "lateral" = "lateral",
    checksTrue = 0,
  ): GorilaSignalOutput => ({
    result: { hasSetup: false, direction: "NEUTRO", structure: reason, justification: reason },
    meta: { reason, trend, setup: null, checksTrue, distanceToEntryPct: null },
  });

  if (candles.length < 60) return noSetup("Dados insuficientes (menos de 60 velas).");

  const closes = candles.map((c) => c.c);
  const n = closes.length;
  const iRef = n - 2; // último candle FECHADO (o último pode estar em formação)
  const price = closes[n - 1];

  const e9arr = ema(closes, 9);
  const a21arr = sma(closes, 21);
  const a50arr = sma(closes, 50);
  const a200arr = sma(closes, 200);
  const e9 = e9arr[iRef];
  const a21 = a21arr[iRef];
  const a50 = a50arr[iRef];
  const a200 = a200arr[iRef];
  if (e9 === null || a21 === null || a50 === null) {
    return noSetup("Médias indisponíveis (poucas velas).");
  }

  // ---- CONTEXTO 1: alinhamento das médias (compra 9>21>50 / venda 9<21<50) ----
  const alignedUp = e9 > a21 && a21 > a50;
  const alignedDown = e9 < a21 && a21 < a50;
  if (!alignedUp && !alignedDown) {
    return noSetup("Médias embaralhadas — mercado lateral, sem tendência operável (regra do método).");
  }
  const isLong = alignedUp;
  const trend: "up" | "down" = isLong ? "up" : "down";

  // ---- CONTEXTO 2: viés do timeframe superior não pode CONTRARIAR ----
  const bias = htfBias(input.htfCandles ?? []);
  if ((isLong && bias === "down") || (!isLong && bias === "up")) {
    return noSetup(`Viés do timeframe superior (${bias}) contra a operação — hierarquia dos tempos manda.`, trend);
  }

  // ---- CONTEXTO 3: fator proximidade (não operar esticado) ----
  const a = atr(candles);
  const tick = pipSize(price);
  const distA21 = Math.abs(price - a21);
  if (distA21 > a * 4) {
    return noSetup(`Movimento esticado (preço a ${(distA21 / a).toFixed(1)}x ATR da MMA21) — mercado caro, proximidade ruim.`, trend);
  }

  // ---- CONTEXTO 4: pullback não pode ter passado de 61.8% do último impulso ----
  const swingWindow = candles.slice(-40, -1);
  const swingHigh = Math.max(...swingWindow.map((c) => c.h));
  const swingLow = Math.min(...swingWindow.map((c) => c.l));
  const range = swingHigh - swingLow;
  if (range > 0) {
    const fibLevel = isLong ? (swingHigh - price) / range : (price - swingLow) / range;
    if (fibLevel > 0.618) {
      return noSetup(`Correção além de 61.8% de Fibonacci (${(fibLevel * 100).toFixed(0)}%) — tendência comprometida.`, trend);
    }
  }

  // ---- GATILHOS (prioridade: PC > 9.2 > 9.1) ----
  const ref = candles[iRef];
  const prev = candles[iRef - 1];
  const e9Rising = e9arr[iRef]! > e9arr[iRef - 1]! ;
  const e9RisingBefore = e9arr[iRef - 1]! > e9arr[iRef - 2]!;
  const a21SlopeUp = a21arr[iRef]! > a21arr[iRef - 3]!;
  const a21SlopeDown = a21arr[iRef]! < a21arr[iRef - 3]!;

  let setup: "PC" | "9.2" | "9.1" | null = null;
  let refIdx = iRef;

  // PC — Ponto Contínuo: pullback tocando/aproximando a MMA21 inclinada a favor.
  // "Adaptação do Sacra": marca o gatilho já na APROXIMAÇÃO (<=0.5 ATR da média).
  const pcSlopeOk = isLong ? a21SlopeUp : a21SlopeDown;
  const touchedA21 = candles.slice(iRef - 4, iRef + 1).some((c, k) => {
    const idx = iRef - 4 + k;
    const m = a21arr[idx];
    if (m === null) return false;
    return isLong ? c.l <= m + a * 0.5 : c.h >= m - a * 0.5;
  });
  if (pcSlopeOk && touchedA21) {
    setup = "PC";
  }

  // 9.2 — MME9 a favor + candle fechou além do extremo do anterior (recuo de 1 candle)
  if (!setup) {
    const nine2 = isLong
      ? e9Rising && ref.c < prev.l
      : !e9Rising && ref.c > prev.h;
    if (nine2) setup = "9.2";
  }

  // 9.1 — virada da MME9 em candle fechado
  if (!setup) {
    const turnedUp = e9Rising && !e9RisingBefore;
    const turnedDown = !e9Rising && e9RisingBefore;
    if ((isLong && turnedUp) || (!isLong && turnedDown)) setup = "9.1";
  }

  if (!setup) {
    return noSetup("Contexto ok, mas nenhum gatilho armado (PC/9.2/9.1). Aguardando o próximo candle.", trend);
  }

  // ---- PLANO DE TRADE (regras do manual) ----
  const refC = candles[refIdx];
  const buf = Math.max(a * 0.15, tick * 2);

  // Entrada: 1 tick além do extremo do candle de referência (ordem stop)
  const entry = round(isLong ? refC.h + tick : refC.l - tick, price);

  // Stop: extremo do recuo (PC) ou do candle de referência (9.1/9.2), com buffer
  const pullbackLows = candles.slice(iRef - 3, iRef + 1).map((c) => (isLong ? c.l : c.h));
  const stopBase =
    setup === "PC"
      ? isLong
        ? Math.min(...pullbackLows)
        : Math.max(...pullbackLows)
      : isLong
        ? refC.l
        : refC.h;
  const stop = round(isLong ? stopBase - buf : stopBase + buf, price);
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return noSetup("Stop inválido (risco zero).", trend);

  // Alvos: T1 = amplitude do candle de referência projetada (regra do PC);
  // T2 = estrutura anterior (topo/fundo do swing); T3 = extensão. Monotônicos.
  const amplitude = refC.h - refC.l;
  const t1raw = isLong ? entry + Math.max(amplitude, risk) : entry - Math.max(amplitude, risk);
  const structT = isLong ? swingHigh : swingLow;
  const reinforcements = [2.5, 4].map((m) => (isLong ? entry + risk * m : entry - risk * m));
  const pool = [t1raw, structT, ...reinforcements].sort((x, y) => (isLong ? x - y : y - x));
  const minGap = risk * 0.3;
  const targets: number[] = [];
  for (const p of pool) {
    if (isLong ? p <= entry : p >= entry) continue;
    const last = targets[targets.length - 1];
    if (last === undefined || Math.abs(p - last) >= minGap) targets.push(p);
    if (targets.length >= 3) break;
  }
  while (targets.length < 3) {
    const last = targets[targets.length - 1] ?? entry;
    targets.push(isLong ? last + risk : last - risk);
  }
  const [t1, t2, t3] = targets.slice(0, 3).map((t) => round(t, price));

  const rr = Math.abs(t1 - entry) / risk;
  if (rr < 0.75) {
    return noSetup(`R:R do Alvo 1 (${rr.toFixed(2)}) abaixo do mínimo. Sem trade.`, trend);
  }
  // Sanidade: preço não pode já ter passado do Alvo 1
  if (isLong ? price >= t1 : price <= t1) {
    return noSetup(`Preço atual já está além do Alvo 1 (${t1}). Plano sem espaço.`, trend);
  }
  // Sanidade: preço não pode já ter fugido muito além da entrada (gatilho perdido)
  if (isLong ? price > entry + risk * 0.5 : price < entry - risk * 0.5) {
    return noSetup("Rompimento já andou mais de meio risco além do gatilho — entrada perdida.", trend);
  }

  // ---- CHECKLIST (6 itens, chaves compatíveis com a UI) ----
  const trendOk =
    a200 !== null && a200arr[iRef - 10] !== null
      ? isLong
        ? price > a200 && a200 >= a200arr[iRef - 10]!
        : price < a200 && a200 <= a200arr[iRef - 10]!
      : bias === (isLong ? "up" : "down");
  const proximityOk = distA21 <= a * 2.5;

  // Agulhada: 9/21/50 juntas (spread < 0.6 ATR) e candle de referência atravessando
  const spread = Math.max(e9, a21, a50) - Math.min(e9, a21, a50);
  const agulhada = spread <= a * 0.6 && refC.h >= Math.max(e9, a21, a50) && refC.l <= Math.min(e9, a21, a50);
  // Confluência: agulhada OU stop protegido por média (MMA21/50 entre stop e entrada)
  const protectedStop = [a21, a50].some((m) => (isLong ? m >= stop && m <= entry : m <= stop && m >= entry));
  const confluenceOk = agulhada || protectedStop;

  const vols = candles.map((c) => c.v ?? 0);
  const hasVolume = vols.slice(-15).some((v) => v > 0);
  let volumeOk = false;
  if (hasVolume) {
    const recent = vols.slice(-5).reduce((x, y) => x + y, 0) / 5;
    const before = vols.slice(-15, -5).reduce((x, y) => x + y, 0) / 10;
    volumeOk = before > 0 && recent < before;
  }

  // Candle de referência com cara de retomada/rejeição (sombra contra o movimento)
  const body = Math.abs(refC.c - refC.o);
  const wick = isLong ? Math.min(refC.o, refC.c) - refC.l : refC.h - Math.max(refC.o, refC.c);
  const gatilhoCandleOk = body > 0 && wick >= body * 0.4;

  const checks = {
    tendencia_SMA200_alinhada: trendOk,
    alinhamento_perfeito_medias: true, // obrigatório — já validado no contexto
    preco_na_zona_de_valor: proximityOk,
    confluencia_suporte_resistencia: confluenceOk,
    volume_pullback_decrescente: volumeOk,
    candle_gatilho_valido: gatilhoCandleOk,
  };
  const checksTrue = Object.values(checks).filter(Boolean).length;
  if (checksTrue < 4) {
    return noSetup(
      `Gatilho ${setup} armado mas confluência insuficiente (${checksTrue}/6).`,
      trend,
      checksTrue,
    );
  }

  const probability = checksTrue >= 6 ? 82 : checksTrue === 5 ? 66 : 48;
  const confidence: "ALTA" | "MEDIA" | "BAIXA" =
    checksTrue >= 6 ? "ALTA" : checksTrue === 5 ? "MEDIA" : "BAIXA";
  const direction: NonNullable<ScanResult["direction"]> = isLong
    ? checksTrue >= 6 ? "COMPRA_FORTE" : "COMPRA_FRACA"
    : checksTrue >= 6 ? "VENDA_FORTE" : "VENDA_FRACA";

  const setupLabel =
    setup === "PC" ? "PC — Ponto Contínuo" : setup === "9.2" ? "Setup 9.2" : "Setup 9.1";
  const distPct = (Math.abs(entry - price) / price) * 100;

  const structure = `${setupLabel} de ${isLong ? "compra" : "venda"}: médias alinhadas (${isLong ? "9>21>50" : "9<21<50"}), ${
    setup === "PC" ? "pullback na MMA21 inclinada" : setup === "9.2" ? "recuo de 1 candle com MME9 a favor" : "virada da MME9"
  }${agulhada ? " + agulhada de confluência" : ""}. Entrada stop no rompimento do candle de referência.`;

  const result: ScanResult = {
    hasSetup: true,
    tipo_setup: setupLabel,
    direction,
    probability,
    confidence,
    checklist_classico: checks,
    structure,
    entryPrice: entry,
    entryZoneLow: round(Math.min(refC.l, entry), price),
    entryZoneHigh: round(Math.max(refC.h, entry), price),
    stopPrice: stop,
    target1: t1,
    target2: t2,
    target3: t3,
    recommendedTarget: 2,
    riskReward: `1:${rr.toFixed(1)}`,
    justification: `${setupLabel}: ${isLong ? "COMPRA" : "VENDA"} stop em ${entry} (1 tick ${isLong ? "acima da máxima" : "abaixo da mínima"} do candle de referência), stop loss técnico em ${stop}, alvo 1 pela amplitude projetada em ${t1}. Confluências ${checksTrue}/6.`,
  };

  return {
    result,
    meta: { reason: "setup válido", trend, setup, checksTrue, distanceToEntryPct: distPct },
  };
}
