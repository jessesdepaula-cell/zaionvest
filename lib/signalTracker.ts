import { prisma } from "@/lib/prisma";

type Candle = { t: number; o: number; h: number; l: number; c: number };

/** Duração de uma vela em segundos, por timeframe. */
const TF_SECONDS: Record<string, number> = {
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D1: 86400,
};

/**
 * Um PENDING cuja entrada nunca foi tocada expira após um número limitado de
 * velas do PRÓPRIO timeframe — assim setups intradiários (ex.: BTC M15) não
 * ficam "Aguardando" por dias bloqueando novos sinais do ativo, enquanto
 * timeframes altos ganham mais tempo. Piso e teto evitam matar setups válidos
 * cedo demais (TF baixo) ou segurá-los tempo demais (TF alto).
 */
const PENDING_MAX_CANDLES = 12;
const PENDING_MIN_AGE_MS = 2 * 60 * 60 * 1000; // nunca antes de 2h
const PENDING_MAX_AGE_MS = 48 * 60 * 60 * 1000; // nunca depois de 48h

function pendingMaxAgeMs(tfSec: number): number {
  return Math.min(
    PENDING_MAX_AGE_MS,
    Math.max(PENDING_MIN_AGE_MS, tfSec * 1000 * PENDING_MAX_CANDLES),
  );
}

/**
 * Fallback de fechamento por velas: para cada sinal aberto (PENDING ou FILLED)
 * do mesmo símbolo, varre as candles fornecidas e:
 * - PENDING: se uma vela tocou no entryPrice → marca FILLED no horário da vela
 * - FILLED: se uma vela tocou stop ou alvo recomendado → marca WIN/LOSS e cria Trade
 *
 * Chamado pelo orquestrador de scan a cada scan, garantindo fechamento mesmo
 * sem stream de ticks em tempo real.
 */
export async function evaluateOpenSignalsAgainstCandles(
  userId: string,
  symbol: string,
  candles: Candle[],
) {
  if (candles.length === 0) return { filled: 0, won: 0, lost: 0 };

  const sym = symbol.toUpperCase();
  const openSignals = await prisma.signal.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "FILLED"] },
      symbol: sym,
      hasSetup: true,
    },
  });

  let filled = 0;
  let won = 0;
  let lost = 0;

  for (const s of openSignals) {
    const isBuy = s.direction === "COMPRA_FORTE" || s.direction === "COMPRA_FRACA";
    const isSell = s.direction === "VENDA_FORTE" || s.direction === "VENDA_FRACA";
    if (!isBuy && !isSell) continue;

    let status: "PENDING" | "FILLED" | "WIN" | "LOSS" | "EXPIRED" = s.status as any;
    let filledAt: Date | null = s.filledAt;
    const scannedSec = Math.floor(new Date(s.scannedAt).getTime() / 1000);
    const tfSec = TF_SECONDS[s.timeframe] ?? 900;

    // Inclui a vela EM FORMAÇÃO no momento da detecção (abriu antes, fecha depois):
    // é nela que a entrada costuma ser tocada logo após o sinal nascer. Filtrar
    // por t >= scannedAt descartava essa vela e o sinal nunca virava FILLED.
    const relevant = candles.filter((c) => c.t + tfSec > scannedSec);
    if (relevant.length === 0) continue;

    let partialHit = s.tradeCreated || s.exitPrice !== null;
    let partialHitAt: Date | null = s.tradeCreated ? (s.closedAt ?? s.filledAt) : null;

    let outcome: "WIN" | "LOSS" | null = null;
    let exitPrice: number | null = s.exitPrice;
    let closeAt: Date | null = s.closedAt;

    const t1 = s.target1;
    const t2 = s.target2 ?? s.target1;
    const stop = s.stopPrice;
    // Alvos válidos em ordem (TP1 -> TP2 -> TP3) para monitoramento progressivo
    const targets = [s.target1, s.target2, s.target3].filter(
      (x): x is number => x !== null,
    );
    // Nível de alvo já atingido (persistido em maxTargetHit; legado usa partialHit)
    let tpLevel = s.maxTargetHit ?? (partialHit ? 1 : 0);

    for (const c of relevant) {
      const candleTime = new Date(c.t * 1000);

      // A vela que JÁ ESTAVA ABERTA no momento da detecção contém movimento
      // ANTERIOR ao nascimento do sinal. Nela só é permitido EXECUTAR a entrada
      // (toque é ação presente); expirar ou bater alvo/stop com high/low dessa
      // vela seria julgar o sinal por preço do passado — era isso que expirava
      // sinais segundos após a criação (e disparava e-mails em loop).
      const isDetectionCandle = c.t <= scannedSec;

      // 1. PENDING -> FILLED
      if (status === "PENDING" && s.entryPrice !== null) {
        if (c.l <= s.entryPrice && c.h >= s.entryPrice) {
          status = "FILLED";
          filledAt = candleTime;
        } else if (
          // Trem perdido: o preço atingiu o Alvo 1 SEM nunca ter tocado a entrada.
          // O movimento aconteceu sem execução — expira para não ficar "Aguardando"
          // para sempre nem bloquear novos sinais deste ativo.
          !isDetectionCandle &&
          t1 !== null &&
          (isBuy ? c.h >= t1 && c.l > s.entryPrice : c.l <= t1 && c.h < s.entryPrice)
        ) {
          status = "EXPIRED";
          closeAt = candleTime;
          break;
        }
      }

      // 2. FILLED -> Monitoramento PROGRESSIVO dos alvos (TP1 -> TP2 -> TP3) e stop,
      // com PROTEÇÃO DINÂMICA: o alvo CONQUISTADO vira o piso de saída (nunca a
      // entrada). Depois do TP1 a proteção trava no PRÓPRIO TP1 (garante +1R real);
      // depois do TP2, no TP2. Assim um vencedor que tocou o alvo e voltou fecha
      // como GANHO no último alvo atingido — em vez de virar "zero a zero" no
      // breakeven, que era o que zerava a expectativa (rabo direito amputado).
      if (status === "FILLED" && !isDetectionCandle) {
        const hitTarget = (p: number) => (isBuy ? c.h >= p : c.l <= p);
        const hitStop = stop !== null && (isBuy ? c.l <= stop : c.h >= stop);

        // Sem nenhum alvo garantido: stop primeiro (convenção conservadora)
        if (tpLevel === 0 && hitStop) {
          outcome = "LOSS";
          exitPrice = stop;
          closeAt = candleTime;
          break;
        }

        // Avança pelos alvos atingidos nesta vela (pode pular mais de um)
        const levelBefore = tpLevel;
        while (tpLevel < targets.length && hitTarget(targets[tpLevel])) {
          tpLevel++;
          if (tpLevel === 1) {
            partialHit = true;
            partialHitAt = candleTime;
            exitPrice = targets[0]; // Parcial garantida no Alvo 1
          }
        }
        const advancedThisCandle = tpLevel > levelBefore;

        // Alvo final (TP3, ou o último disponível) atingido: WIN completo
        if (targets.length > 0 && tpLevel >= targets.length) {
          outcome = "WIN";
          exitPrice = targets[targets.length - 1];
          closeAt = candleTime;
          break;
        }

        // Proteção dinâmica: o nível conquistado vira o piso de saída.
        // tpLevel 1 -> proteção no PRÓPRIO TP1 (trava >= +1R); tpLevel 2 -> proteção no TP2.
        // NUNCA volta para a entrada: devolver o ganho ao breakeven zerava a
        // expectativa. Não avalia na MESMA vela em que o nível foi conquistado (a
        // ordem dos movimentos dentro da vela é desconhecida — benefício da dúvida).
        if (tpLevel >= 1 && !advancedThisCandle) {
          const protection = tpLevel >= 2 ? targets[1] : targets[0];
          const hitProtection =
            protection !== null && (isBuy ? c.l <= protection : c.h >= protection);
          if (hitProtection) {
            outcome = "WIN"; // alvo garantido preserva o ganho (mínimo +1R)
            exitPrice = protection;
            closeAt = candleTime;
            break;
          }
        }
      }
    }

    // 2b. Expiração: trem perdido (TP1 sem toque na entrada) ou PENDING velho demais
    const tooOld =
      status === "PENDING" &&
      Date.now() - new Date(s.scannedAt).getTime() > pendingMaxAgeMs(tfSec);
    if (status === "EXPIRED" || tooOld) {
      await prisma.signal.update({
        where: { id: s.id },
        data: {
          status: "EXPIRED",
          closedAt: closeAt ?? new Date(),
          justification: `${s.justification ?? ""} [Expirado: ${
            tooOld
              ? "entrada não foi tocada dentro da janela do setup"
              : "o preço atingiu o Alvo 1 sem retornar à zona de entrada"
          }]`.trim(),
          candleData: candles as any,
        },
      });
      continue;
    }

    // 3. Persistência de Transição para FILLED
    if (status === "FILLED" && s.status === "PENDING" && !partialHit) {
      await prisma.signal.update({
        where: { id: s.id },
        data: { 
          status: "FILLED", 
          filledAt: filledAt ?? new Date(),
          candleData: candles as any,
        },
      });
      filled++;
    }

    // 4. Persistência de Parcial no Alvo 1 (se ainda não gravada)
    if (partialHit && !s.tradeCreated) {
      const risk = s.entryPrice !== null && s.stopPrice !== null ? Math.abs(s.entryPrice - s.stopPrice) : 0;
      let r: number | null = null;
      if (risk > 0 && s.entryPrice !== null && t1 !== null) {
        const reward = isBuy ? t1 - s.entryPrice : s.entryPrice - t1;
        r = Number((reward / risk).toFixed(2));
      }

      await prisma.trade.create({
        data: {
          userId,
          signalId: s.id,
          asset: s.symbol,
          timeframe: s.timeframe,
          mode: s.mode,
          direction: isBuy ? "BUY" : "SELL",
          entryPrice: s.entryPrice ?? 0,
          stopPrice: s.stopPrice ?? 0,
          targetPrice: t2 ?? null,
          exitPrice: t1,
          outcome: "WIN",
          rMultiple: r,
          openedAt: filledAt ?? s.filledAt ?? s.scannedAt,
          closedAt: partialHitAt ?? new Date(),
          notes: `Sinal automático ${s.mode} · ${s.symbol} ${s.timeframe} (parcial garantida no Alvo 1)`,
        },
      });

      await prisma.signal.update({
        where: { id: s.id },
        data: {
          tradeCreated: true,
          exitPrice: t1,
          rMultiple: r,
          status: "FILLED",
          filledAt: filledAt ?? s.filledAt ?? new Date(),
          maxTargetHit: tpLevel > 0 ? tpLevel : 1,
          candleData: candles as any,
        },
      });

      won++;
    }

    // 4b. Progresso de alvo sem encerramento (ex.: bateu TP2 e segue rumo ao TP3):
    // persiste o maior alvo atingido para as estatísticas de TP1/TP2/TP3.
    if (!outcome && tpLevel > (s.maxTargetHit ?? 0) && s.tradeCreated) {
      await prisma.signal
        .update({ where: { id: s.id }, data: { maxTargetHit: tpLevel } })
        .catch(() => null);
    }

    // 5. Persistência do Encerramento Final (tocar no Alvo 2 ou no Stop Loss)
    if (outcome && exitPrice !== null) {
      const risk = s.entryPrice !== null && s.stopPrice !== null ? Math.abs(s.entryPrice - s.stopPrice) : 0;
      let r: number | null = null;
      if (risk > 0 && s.entryPrice !== null) {
        const reward = isBuy ? exitPrice - s.entryPrice : s.entryPrice - exitPrice;
        r = Number((reward / risk).toFixed(2));
      }

      await prisma.signal.update({
        where: { id: s.id },
        data: {
          status: outcome,
          filledAt: filledAt ?? s.filledAt ?? new Date(),
          closedAt: closeAt ?? new Date(),
          exitPrice,
          rMultiple: r,
          tradeCreated: true,
          maxTargetHit: tpLevel > 0 ? tpLevel : null,
          candleData: candles as any,
        },
      });

      if (s.tradeCreated) {
        // Atualiza o trade existente no diário com o encerramento final real
        await prisma.trade.updateMany({
          where: { signalId: s.id },
          data: {
            exitPrice,
            rMultiple: r,
            closedAt: closeAt ?? new Date(),
            notes: `Sinal automático ${s.mode} · ${s.symbol} ${s.timeframe} (finalizado na saída real: ${exitPrice})`,
          },
        });
      } else {
        // Caso atinja Stop direto (LOSS) sem ter batido no Alvo 1
        await prisma.trade.create({
          data: {
            userId,
            signalId: s.id,
            asset: s.symbol,
            timeframe: s.timeframe,
            mode: s.mode,
            direction: isBuy ? "BUY" : "SELL",
            entryPrice: s.entryPrice ?? 0,
            stopPrice: s.stopPrice ?? 0,
            targetPrice: t2 ?? null,
            exitPrice,
            outcome,
            rMultiple: r,
            openedAt: filledAt ?? s.filledAt ?? s.scannedAt,
            closedAt: closeAt ?? new Date(),
            notes: `Sinal automático ${s.mode} · ${s.symbol} ${s.timeframe} (finalizado com desfecho: ${outcome})`,
          },
        });
      }

      if (outcome === "WIN" && !s.tradeCreated) {
        won++;
      } else if (outcome === "LOSS") {
        lost++;
      }
    }
  }

  return { filled, won, lost };
}
