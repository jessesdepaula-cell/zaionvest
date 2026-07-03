import { prisma } from "@/lib/prisma";
import type { Candle } from "@/lib/aiScan";
import { generateSmcSignal } from "@/lib/smcSignal";
import { generateGorilaSignal } from "@/lib/gorilaSignal";
import { narrateSignal } from "@/lib/narrator";
import { evaluateOpenSignalsAgainstCandles } from "@/lib/signalTracker";
import { sendSignalEmail } from "@/lib/email";
import { getCandles } from "@/lib/market/router";
import { findSymbol } from "@/lib/market/symbols";
import type { Timeframe } from "@/lib/market/types";

const HTF_FOR: Record<Timeframe, Timeframe> = {
  M5: "H1",
  M15: "H1",
  M30: "H4",
  H1: "H4",
  H4: "D1",
  D1: "D1",
};

type ScanWatchInput = {
  userId: string;
  watchlistId: string | null;
  symbol: string;
  timeframe: string;
  mode: "SMC" | "CLASSICO";
};

export type ScanWatchResult = {
  ok: true;
  signalId: string;
  hasSetup: boolean;
  direction: string | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  tracked: { filled: number; won: number; lost: number };
};

export type ScanWatchError = { ok: false; error: string };

const VALID_TFS: Timeframe[] = ["M5", "M15", "M30", "H1", "H4", "D1"];

function asTimeframe(tf: string): Timeframe {
  return VALID_TFS.includes(tf as Timeframe) ? (tf as Timeframe) : "M15";
}

export async function scanWatchlistItem(
  input: ScanWatchInput,
): Promise<ScanWatchResult | ScanWatchError> {
  const spec = findSymbol(input.symbol);
  if (!spec) {
    return { ok: false, error: `Símbolo não suportado: ${input.symbol}` };
  }

  const tf = asTimeframe(input.timeframe);
  const htf = HTF_FOR[tf];

  let candles: Candle[];
  let htfCandles: Candle[] = [];
  try {
    candles = (await getCandles(spec.symbol, tf, 500)) as Candle[];
  } catch (e) {
    return {
      ok: false,
      error: `Falha ao obter candles ${spec.symbol} ${tf}: ${
        e instanceof Error ? e.message : "erro"
      }`,
    };
  }
  if (candles.length < 20) {
    return { ok: false, error: "Dados insuficientes (menos de 20 velas)" };
  }
  try {
    htfCandles = (await getCandles(spec.symbol, htf, 200)) as Candle[];
  } catch {
    htfCandles = [];
  }

  // Avalia sinais já abertos contra novas velas
  let tracked = { filled: 0, won: 0, lost: 0 };
  try {
    tracked = await evaluateOpenSignalsAgainstCandles(
      input.userId,
      spec.symbol,
      candles,
    );
  } catch {
    // não interrompe
  }

  // Verifica se já existe um sinal ativo (PENDING ou FILLED) para este ativo/timeframe/modo
  const activeSignal = await prisma.signal.findFirst({
    where: {
      userId: input.userId,
      symbol: spec.symbol,
      timeframe: tf,
      mode: input.mode,
      status: { in: ["PENDING", "FILLED"] },
    },
  });

  if (activeSignal) {
    // Se já existe um sinal ativo, pulamos o novo escaneamento da IA para evitar duplicidade.
    if (input.watchlistId) {
      await prisma.watchlist
        .updateMany({
          where: { id: input.watchlistId, userId: input.userId },
          data: { lastScanAt: new Date() },
        })
        .catch(() => null);
    }
    return {
      ok: true,
      signalId: activeSignal.id,
      hasSetup: activeSignal.hasSetup,
      direction: activeSignal.direction,
      entry: activeSignal.entryPrice,
      stop: activeSignal.stopPrice,
      target: activeSignal.target1,
      tracked,
    };
  }

  // Carrega as chaves de API do usuário do banco
  const userKeys = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { geminiApiKey: true, openaiApiKey: true },
  });

  // Geração do sinal — ambos os modos usam motor DETERMINÍSTICO (estrutura
  // calculada em código: grátis, reproduzível, sem depender de chave de IA).
  // A IA entra apenas como narradora opcional do plano já pronto.
  let result;

  if (input.mode === "SMC") {
    const det = generateSmcSignal({
      symbol: spec.symbol,
      timeframe: tf,
      candles,
      htfCandles,
    });
    result = det.result;
    console.log(
      `[scan] SMC determinístico ${spec.symbol}/${tf}: hasSetup=${result.hasSetup} ` +
        `checks=${det.meta.checksTrue}/6 bias=${det.meta.htfBias} dist=${det.meta.distanceToEntryPct?.toFixed(2) ?? "-"}% (${det.meta.reason})`,
    );
  } else {
    // Modo CLÁSSICO agora roda o MÉTODO DO GORILA (price action + médias):
    // gatilhos PC/9.2/9.1 com contexto de alinhamento, proximidade e hierarquia.
    const det = generateGorilaSignal({
      symbol: spec.symbol,
      timeframe: tf,
      candles,
      htfCandles,
    });
    result = det.result;
    console.log(
      `[scan] GORILA (modo Clássico) ${spec.symbol}/${tf}: hasSetup=${result.hasSetup} ` +
        `setup=${det.meta.setup ?? "-"} checks=${det.meta.checksTrue}/6 trend=${det.meta.trend} dist=${det.meta.distanceToEntryPct?.toFixed(2) ?? "-"}% (${det.meta.reason})`,
    );
  }

  // Narração opcional pela IA (grátis/barata). Best-effort: se falhar ou não
  // houver chave, mantém a justificativa gerada pelo código. Nunca bloqueia o sinal.
  if (result.hasSetup) {
    const narrated = await narrateSignal({
      symbol: spec.symbol,
      timeframe: tf,
      mode: input.mode,
      result,
      userKeys: userKeys ?? undefined,
    });
    if (narrated) result.justification = narrated;
  }

  const num = (v: unknown): number | null =>
    typeof v === "number" && isFinite(v) ? v : null;

  // Validação de R:R mínimo de 1:1 no Alvo 1
  let hasSetup = !!result.hasSetup;
  let rrValidationMessage = "";
  if (hasSetup) {
    const entry = num(result.entryPrice);
    const stop = num(result.stopPrice);
    const t1 = num(result.target1);
    if (entry !== null && stop !== null && t1 !== null) {
      const risk = Math.abs(entry - stop);
      const reward = Math.abs(t1 - entry);
      if (risk <= 0) {
        hasSetup = false;
        rrValidationMessage = "Stop Loss inválido (igual à entrada).";
      } else if ((reward / risk) < 0.75) {
        hasSetup = false;
        rrValidationMessage = `Risco/Retorno no Alvo 1 de ${parseFloat((reward / risk).toFixed(2))} é menor do que 3:4 (mínimo aceitável).`;
      }
    } else {
      hasSetup = false;
      rrValidationMessage = "Faltam parâmetros de Entrada, Stop Loss ou Alvo 1.";
    }
  }

  // Anti-respawn: se um sinal GÊMEO (mesma entrada ±0.1%) deste par/modo acabou
  // de EXPIRAR (últimas 2h), não recria — evita o loop "cria → expira → recria"
  // que dispara e-mails repetidos do mesmo plano já invalidado pelo mercado.
  if (hasSetup) {
    const entryNew = num(result.entryPrice);
    if (entryNew !== null) {
      const recentExpired = await prisma.signal.findFirst({
        where: {
          userId: input.userId,
          symbol: spec.symbol,
          timeframe: tf,
          mode: input.mode,
          status: "EXPIRED",
          closedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        },
        orderBy: { closedAt: "desc" },
        select: { entryPrice: true },
      });
      if (
        recentExpired?.entryPrice != null &&
        Math.abs(entryNew - recentExpired.entryPrice) / entryNew < 0.001
      ) {
        hasSetup = false;
        rrValidationMessage =
          "Plano idêntico expirou há pouco — aguardando novo contexto de mercado.";
      }
    }
  }

  const signal = await prisma.signal.create({
    data: {
      userId: input.userId,
      symbol: spec.symbol,
      timeframe: tf,
      mode: input.mode,
      hasSetup: hasSetup,
      direction: hasSetup ? (result.direction ?? null) : null,
      probability:
        hasSetup && typeof result.probability === "number"
          ? Math.max(0, Math.min(100, Math.round(result.probability)))
          : null,
      confidence: hasSetup ? (result.confidence ?? null) : null,
      entryPrice: hasSetup ? num(result.entryPrice) : null,
      entryZoneLow: hasSetup ? num(result.entryZoneLow) : null,
      entryZoneHigh: hasSetup ? num(result.entryZoneHigh) : null,
      stopPrice: hasSetup ? num(result.stopPrice) : null,
      target1: hasSetup ? num(result.target1) : null,
      target2: hasSetup ? num(result.target2) : null,
      target3: hasSetup ? num(result.target3) : null,
      recommendedTarget:
        hasSetup && result.recommendedTarget && [1, 2, 3].includes(result.recommendedTarget)
          ? result.recommendedTarget
          : null,
      riskReward: hasSetup ? (result.riskReward ?? null) : null,
      structure: result.structure ?? null,
      justification: hasSetup ? (result.justification ?? null) : `${result.justification ?? ""} (Rejeitado: ${rrValidationMessage})`,
      tipoSetup: hasSetup ? (result.tipo_setup ?? null) : null,
      checklistSmc:
        hasSetup && input.mode === "SMC" && result.checklist_smc
          ? (result.checklist_smc as object)
          : undefined,
      checklistClassico:
        hasSetup && input.mode === "CLASSICO" && result.checklist_classico
          ? (result.checklist_classico as object)
          : undefined,
      status: hasSetup ? "PENDING" : "NO_SETUP",
      candleData: candles.slice(-3000) as object,
    },
  });

  // Disparo assíncrono do e-mail de alerta para o assinante
  if (hasSetup && signal.status === "PENDING") {
    prisma.user
      .findUnique({
        where: { id: input.userId },
        select: { email: true },
      })
      .then((u) => {
        if (u?.email) {
          sendSignalEmail(u.email, {
            symbol: signal.symbol,
            timeframe: signal.timeframe,
            mode: signal.mode,
            direction: signal.direction ?? "NEUTRO",
            entryPrice: signal.entryPrice,
            stopPrice: signal.stopPrice,
            target1: signal.target1,
            target2: signal.target2,
            target3: signal.target3,
            riskReward: signal.riskReward,
            justification: signal.justification,
            tipoSetup: signal.tipoSetup,
          }).catch((err) => console.error("[sendSignalEmail Catch]", err));
        }
      })
      .catch((err) => {
        console.error("[Email User Query Error]", err);
      });
  }

  if (input.watchlistId) {
    await prisma.watchlist
      .updateMany({
        where: { id: input.watchlistId, userId: input.userId },
        data: { lastScanAt: new Date() },
      })
      .catch(() => null);
  }

  return {
    ok: true,
    signalId: signal.id,
    hasSetup: signal.hasSetup,
    direction: signal.direction,
    entry: signal.entryPrice,
    stop: signal.stopPrice,
    target: signal.target1,
    tracked,
  };
}

export async function scanAllActiveForUser(userId: string) {
  const watchlist = await prisma.watchlist.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
  });
  const results: Array<{
    watchlistId: string;
    symbol: string;
    timeframe: string;
    mode: string;
    ok: boolean;
    error?: string;
  }> = [];
  
  for (let i = 0; i < watchlist.length; i++) {
    const w = watchlist[i];
    
    // Apenas aguarda de 500ms entre itens para evitar estourar o limite de tokens/minuto da OpenAI
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    
    const r = await scanWatchlistItem({
      userId,
      watchlistId: w.id,
      symbol: w.symbol,
      timeframe: w.timeframe,
      mode: w.mode as "SMC" | "CLASSICO",
    });
    
    results.push({
      watchlistId: w.id,
      symbol: w.symbol,
      timeframe: w.timeframe,
      mode: w.mode,
      ok: r.ok,
      error: r.ok ? undefined : r.error,
    });
  }
  return results;
}
