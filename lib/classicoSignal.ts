/**
 * MOTOR DETERMINÍSTICO DE SINAIS CLÁSSICO (Pullback em Médias Móveis).
 *
 * Implementa em código a estratégia do CLASSICO_MANUAL: tendência definida pelo
 * alinhamento EMA 9/20/50 + SMA 200, entrada no pullback à Zona de Valor
 * (faixa entre EMA 20 e EMA 50), stop estrutural abaixo do fundo/EMA 50 e
 * alvos na estrutura anterior. Sem custo de IA, reproduzível e PREDITIVO:
 * o plano nasce enquanto o preço ainda está SE APROXIMANDO da zona.
 *
 * Saída compatível com ScanResult (mesmo shape do aiScan/smcSignal); o
 * orchestrator persiste igual e a IA fica só como narradora opcional.
 */
import { ema, sma } from "./indicators";
import { atr, pipSize, round } from "./smcSignal";
import type { ScanResult, Candle } from "./aiScan";

export type ClassicoSignalMeta = {
  reason: string;
  trend: "up" | "down" | "lateral";
  checksTrue: number;
  distanceToEntryPct: number | null;
};

export type ClassicoSignalOutput = {
  result: ScanResult;
  meta: ClassicoSignalMeta;
};

export function generateClassicoSignal(input: {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  htfCandles?: Candle[];
}): ClassicoSignalOutput {
  const { candles } = input;
  const noSetup = (
    reason: string,
    trend: "up" | "down" | "lateral" = "lateral",
    checksTrue = 0,
  ): ClassicoSignalOutput => ({
    result: { hasSetup: false, direction: "NEUTRO", structure: reason, justification: reason },
    meta: { reason, trend, checksTrue, distanceToEntryPct: null },
  });

  if (candles.length < 60) return noSetup("Dados insuficientes (menos de 60 velas).");

  const closes = candles.map((c) => c.c);
  const i = closes.length - 1;
  const price = closes[i];

  const e9 = ema(closes, 9)[i];
  const e20 = ema(closes, 20)[i];
  const e50 = ema(closes, 50)[i];
  const s200arr = sma(closes, 200);
  const s200 = s200arr[i];
  const s200prev = s200arr[Math.max(0, i - 10)];

  if (e9 === null || e20 === null || e50 === null) {
    return noSetup("Médias móveis indisponíveis (poucas velas).");
  }

  // ---- TENDÊNCIA pelo alinhamento das médias (item obrigatório) ----
  const alignedUp = e9 > e20 && e20 > e50;
  const alignedDown = e9 < e20 && e20 < e50;
  if (!alignedUp && !alignedDown) {
    return noSetup("Médias embaralhadas — mercado lateral, sem tendência operável.");
  }
  const isLong = alignedUp;
  const trend: "up" | "down" = isLong ? "up" : "down";

  // SMA200: preço do lado certo E inclinação a favor
  const trendOk =
    s200 !== null &&
    s200prev !== null &&
    (isLong ? price > s200 && s200 >= s200prev : price < s200 && s200 <= s200prev);

  // ---- SMA200 obrigatória (tendência maior a favor) ----
  // Antes era opcional (só somava no score). Sem SMA200 a favor operar pullback
  // vira brigar contra tendência maior — principal causa de perdas do modo.
  if (!trendOk) {
    return noSetup(
      "SMA200 não confirma a favor (preço do lado errado ou inclinação contrária).",
      trend,
    );
  }

  // ---- ZONA DE VALOR (faixa EMA20–EMA50) — a entrada é o pullback até ela ----
  const zoneTop = Math.max(e20, e50);
  const zoneBottom = Math.min(e20, e50);
  // Entrada Limit na borda da zona mais próxima do preço:
  // compra: preço acima da zona cai até a EMA20 (borda superior);
  // venda: preço abaixo da zona sobe até a EMA20 (borda inferior).
  const entryRaw = isLong ? zoneTop : zoneBottom;

  // Pullback saudável: o preço precisa estar do lado certo da zona (ainda não
  // a atravessou) e a uma distância operável (senão é tarde ou cedo demais).
  if (isLong && price < zoneBottom) {
    return noSetup("Pullback profundo demais: preço abaixo da EMA 50 — tendência em risco.", trend);
  }
  if (!isLong && price > zoneTop) {
    return noSetup("Pullback profundo demais: preço acima da EMA 50 — tendência em risco.", trend);
  }
  const distPct = (Math.abs(price - entryRaw) / price) * 100;
  // Distância máxima ajustada por tipo de ativo. 1% era largo demais em Forex
  // (100 pips no EURUSD = pullback tarde: risco fica desproporcional ao alvo).
  const isFx = /^(EUR|GBP|USD|CHF|JPY|AUD|NZD|CAD|XAU)/i.test(input.symbol);
  const maxDistPct = isFx ? 0.35 : 0.8;
  if (distPct > maxDistPct) {
    return noSetup(
      `Preço longe da Zona de Valor (${distPct.toFixed(2)}% > ${maxDistPct}%). Aguardando pullback.`,
      trend,
    );
  }
  const zonaOk = true; // chegou aqui: preço operável em relação à zona

  // ---- CONFLUÊNCIA: swing (fundo/topo) anterior encostado na zona ----
  const lookback = candles.slice(-50, -1);
  const tol = price * 0.0015;
  const confluenciaOk = lookback.some((c) =>
    isLong
      ? c.l >= zoneBottom - tol && c.l <= zoneTop + tol
      : c.h >= zoneBottom - tol && c.h <= zoneTop + tol,
  );

  // ---- VOLUME decrescente no pullback (quando o provedor entrega volume) ----
  const vols = candles.map((c) => c.v ?? 0);
  const hasVolume = vols.slice(-15).some((v) => v > 0);
  let volumeOk = false;
  if (hasVolume) {
    const recent = vols.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const before = vols.slice(-15, -5).reduce((a, b) => a + b, 0) / 10;
    volumeOk = before > 0 && recent < before;
  }

  // ---- CANDLE GATILHO: rejeição na zona (pavio contra a zona + corpo a favor) ----
  const last = candles[i];
  const prevC = candles[i - 1];
  const gatilhoOk = [last, prevC].some((c) => {
    const body = Math.abs(c.c - c.o);
    if (body === 0) return false;
    if (isLong) {
      const lowerWick = Math.min(c.o, c.c) - c.l;
      return c.l <= zoneTop + tol && c.c > c.o && lowerWick >= body * 0.5;
    }
    const upperWick = c.h - Math.max(c.o, c.c);
    return c.h >= zoneBottom - tol && c.c < c.o && upperWick >= body * 0.5;
  });

  // Gatilho é obrigatório: sem candle de rejeição na zona, é chute — não sinal.
  if (!gatilhoOk) {
    return noSetup(
      "Sem candle-gatilho de rejeição na Zona de Valor (pavio contra a zona + corpo a favor).",
      trend,
    );
  }

  const checks = {
    tendencia_SMA200_alinhada: trendOk,
    alinhamento_perfeito_medias: true, // obrigatório — já validado acima
    preco_na_zona_de_valor: zonaOk,
    confluencia_suporte_resistencia: confluenciaOk,
    volume_pullback_decrescente: volumeOk,
    candle_gatilho_valido: gatilhoOk,
  };
  const checksTrue = Object.values(checks).filter(Boolean).length;

  // PORTÃO DE QUALIDADE (novo — mesmo padrão do Gorila).
  // Só as confluências DISCRICIONÁRIAS entram no score — as automáticas
  // (alinhamento, zona) já foram exigidas como filtro rígido. O volume só entra
  // no denominador quando o provedor entrega volume: em Forex vem zerado e
  // contá-lo como falha travava o tier ALTA para sempre e ainda liberava sinais
  // fracos de graça no gate antigo (4/6 com 2 automáticos).
  const discretionary = [
    confluenciaOk,
    gatilhoOk, // já obrigatório acima, mantém no score p/ tier
    ...(hasVolume ? [volumeOk] : []),
  ];
  const scoreTotal = discretionary.length; // 2 (sem volume) ou 3 (com volume)
  const scoreTrue = discretionary.filter(Boolean).length;
  if (scoreTrue < scoreTotal - (hasVolume ? 1 : 0)) {
    return noSetup(
      `Confluência insuficiente (${scoreTrue}/${scoreTotal}). Faltam: ${Object.entries(checks)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ")}.`,
      trend,
      checksTrue,
    );
  }

  // ---- PLANO DE TRADE ----
  const a = atr(candles);
  const buf = Math.max(a * 0.2, pipSize(price) * 2);
  const entry = round(entryRaw, price);

  // Stop estrutural: além da zona + fundo/topo recente do pullback
  const recentExtreme = isLong
    ? Math.min(...candles.slice(-10).map((c) => c.l), zoneBottom)
    : Math.max(...candles.slice(-10).map((c) => c.h), zoneTop);
  const stop = round(isLong ? recentExtreme - buf : recentExtreme + buf, price);
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return noSetup("Stop inválido (risco zero).", trend, checksTrue);

  // Alvos: topo/fundo estrutural recente + extensões em R, monotônicos
  const structTarget = isLong
    ? Math.max(...candles.slice(-40).map((c) => c.h))
    : Math.min(...candles.slice(-40).map((c) => c.l));
  const reinforcements = [1.5, 2.5, 4].map((m) => (isLong ? entry + risk * m : entry - risk * m));
  const pool = [structTarget, ...reinforcements].sort((x, y) => (isLong ? x - y : y - x));
  const minGap = risk * 0.3;
  const targets: number[] = [];
  for (const p of pool) {
    if (isLong ? p <= entry : p >= entry) continue;
    const prev = targets[targets.length - 1];
    if (prev === undefined || Math.abs(p - prev) >= minGap) targets.push(p);
    if (targets.length >= 3) break;
  }
  while (targets.length < 3) {
    const lastT = targets[targets.length - 1] ?? entry;
    targets.push(isLong ? lastT + risk : lastT - risk);
  }
  const [t1, t2, t3] = targets.slice(0, 3).map((t) => round(t, price));

  const rr = Math.abs(t1 - entry) / risk;
  // R:R mínimo 1.5 no Alvo 1. Com 0.75 (antigo) mesmo 60% de acerto dava
  // expectativa negativa (0.6·0.75 − 0.4·1 = +0.05 antes de custos → negativo).
  if (rr < 1.5) {
    return noSetup(
      `R:R do Alvo 1 (${rr.toFixed(2)}) abaixo do mínimo (1.5). Sem trade — expectativa ruim.`,
      trend,
      checksTrue,
    );
  }

  // Sanidade do plano: o preço atual NÃO pode já ter passado do Alvo 1
  // (plano sem espaço de lucro nasceria morto e geraria alertas inúteis).
  if (isLong ? price >= t1 : price <= t1) {
    return noSetup(
      `Preço atual (${price}) já está além do Alvo 1 (${t1}). Plano sem espaço — aguardando novo contexto.`,
      trend,
      checksTrue,
    );
  }

  // Calibração baseada nas discricionárias (mesma lógica do Gorila):
  // todas as confirmações a favor = ALTA; senão MEDIA. BAIXA não sai mais no
  // clássico (o gate acima já impede — ou é sinal decente ou não é sinal).
  const strong = scoreTrue === scoreTotal;
  const probability = strong ? 78 : 62;
  const confidence: "ALTA" | "MEDIA" | "BAIXA" = strong ? "ALTA" : "MEDIA";
  const direction: NonNullable<ScanResult["direction"]> = isLong
    ? strong ? "COMPRA_FORTE" : "COMPRA_FRACA"
    : strong ? "VENDA_FORTE" : "VENDA_FRACA";

  const structure = `${isLong ? "Compra" : "Venda"} no pullback à Zona de Valor (EMA20–EMA50), tendência ${
    isLong ? "de alta" : "de baixa"
  } com médias alinhadas${trendOk ? " e SMA200 a favor" : ""}. Preço a ${distPct.toFixed(2)}% da entrada.`;

  const result: ScanResult = {
    hasSetup: true,
    tipo_setup: isLong ? "Pullback de alta" : "Pullback de baixa",
    direction,
    probability,
    confidence,
    checklist_classico: checks,
    structure,
    entryPrice: entry,
    entryZoneLow: round(zoneBottom, price),
    entryZoneHigh: round(zoneTop, price),
    stopPrice: stop,
    target1: t1,
    target2: t2,
    target3: t3,
    recommendedTarget: 2,
    riskReward: `1:${rr.toFixed(1)}`,
    justification: `Plano ${isLong ? "de COMPRA" : "de VENDA"} calculado: entrada Limit em ${entry} (borda da Zona de Valor), stop estrutural em ${stop}, alvos ${t1} / ${t2} / ${t3}. Confluências ${checksTrue}/6.`,
  };

  return {
    result,
    meta: { reason: "setup válido", trend, checksTrue, distanceToEntryPct: distPct },
  };
}
