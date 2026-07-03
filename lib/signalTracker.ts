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

/** PENDING sem execução por mais de 48h expira (não bloqueia novos scans). */
const PENDING_MAX_AGE_MS = 48 * 60 * 60 * 1000;

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

    for (const c of relevant) {
      const candleTime = new Date(c.t * 1000);

      // 1. PENDING -> FILLED
      if (status === "PENDING" && s.entryPrice !== null) {
        if (c.l <= s.entryPrice && c.h >= s.entryPrice) {
          status = "FILLED";
          filledAt = candleTime;
        } else if (
          // Trem perdido: o preço atingiu o Alvo 1 SEM nunca ter tocado a entrada.
          // O movimento aconteceu sem execução — expira para não ficar "Aguardando"
          // para sempre nem bloquear novos sinais deste ativo.
          t1 !== null &&
          (isBuy ? c.h >= t1 && c.l > s.entryPrice : c.l <= t1 && c.h < s.entryPrice)
        ) {
          status = "EXPIRED";
          closeAt = candleTime;
          break;
        }
      }

      // 2. FILLED -> Monitoramento de Alvos e Stop
      if (status === "FILLED") {
        if (isBuy) {
          if (!partialHit) {
            // Ainda não bateu no Alvo 1
            if (stop !== null && c.l <= stop) {
              outcome = "LOSS";
              exitPrice = stop;
              closeAt = candleTime;
              break;
            }
            if (t1 !== null && c.h >= t1) {
              partialHit = true;
              partialHitAt = candleTime;
              exitPrice = t1; // Parcial garantida no Alvo 1
              // Verifica se na mesma vela atinge o Alvo 2
              if (t2 !== null && c.h >= t2) {
                outcome = "WIN";
                exitPrice = t2;
                closeAt = candleTime;
                break;
              }
            }
          } else {
            // Já bateu no Alvo 1 (monitora apenas Alvo 2 e Stop Loss)
            if (t2 !== null && c.h >= t2) {
              outcome = "WIN";
              exitPrice = t2;
              closeAt = candleTime;
              break;
            }
            if (stop !== null && c.l <= stop) {
              outcome = "WIN"; // Permanece WIN porque tocou Alvo 1
              exitPrice = stop;
              closeAt = candleTime;
              break;
            }
          }
        } else if (isSell) {
          if (!partialHit) {
            // Ainda não bateu no Alvo 1
            if (stop !== null && c.h >= stop) {
              outcome = "LOSS";
              exitPrice = stop;
              closeAt = candleTime;
              break;
            }
            if (t1 !== null && c.l <= t1) {
              partialHit = true;
              partialHitAt = candleTime;
              exitPrice = t1; // Parcial garantida no Alvo 1
              // Verifica se na mesma vela atinge o Alvo 2
              if (t2 !== null && c.l <= t2) {
                outcome = "WIN";
                exitPrice = t2;
                closeAt = candleTime;
                break;
              }
            }
          } else {
            // Já bateu no Alvo 1 (monitora apenas Alvo 2 e Stop Loss)
            if (t2 !== null && c.l <= t2) {
              outcome = "WIN";
              exitPrice = t2;
              closeAt = candleTime;
              break;
            }
            if (stop !== null && c.h >= stop) {
              outcome = "WIN"; // Permanece WIN porque tocou Alvo 1
              exitPrice = stop;
              closeAt = candleTime;
              break;
            }
          }
        }
      }
    }

    // 2b. Expiração: trem perdido (TP1 sem toque na entrada) ou PENDING velho demais
    const tooOld =
      status === "PENDING" &&
      Date.now() - new Date(s.scannedAt).getTime() > PENDING_MAX_AGE_MS;
    if (status === "EXPIRED" || tooOld) {
      await prisma.signal.update({
        where: { id: s.id },
        data: {
          status: "EXPIRED",
          closedAt: closeAt ?? new Date(),
          justification: `${s.justification ?? ""} [Expirado: ${
            tooOld
              ? "entrada não foi tocada em 48h"
              : "o preço atingiu o Alvo 1 sem retornar à zona de entrada"
          }]`.trim(),
        },
      });
      continue;
    }

    // 3. Persistência de Transição para FILLED
    if (status === "FILLED" && s.status === "PENDING" && !partialHit) {
      await prisma.signal.update({
        where: { id: s.id },
        data: { status: "FILLED", filledAt: filledAt ?? new Date() },
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
        },
      });

      won++;
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
