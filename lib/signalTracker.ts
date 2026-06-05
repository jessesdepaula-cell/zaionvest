import { prisma } from "@/lib/prisma";

type Tick = { symbol: string; bid: number; ask: number };

type Candle = { t: number; o: number; h: number; l: number; c: number };

/**
 * Fallback de fechamento por velas: para cada sinal aberto (PENDING ou FILLED)
 * do mesmo símbolo, varre as candles fornecidas e:
 * - PENDING: se uma vela tocou no entryPrice → marca FILLED no horário da vela
 * - FILLED: se uma vela tocou stop ou alvo recomendado → marca WIN/LOSS e cria Trade
 *
 * Usado pelo endpoint de scan a cada fechamento de M15, garantindo que o sinal
 * fecha mesmo se o EA não estiver enviando heartbeat com ticks em tempo real.
 */
export async function evaluateOpenSignalsAgainstCandles(
  accountId: string,
  symbol: string,
  candles: Candle[],
) {
  if (candles.length === 0) return { filled: 0, won: 0, lost: 0 };

  const sym = symbol.toUpperCase();
  const openSignals = await prisma.signal.findMany({
    where: {
      accountId,
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

    let status: "PENDING" | "FILLED" = s.status as "PENDING" | "FILLED";
    let filledAt: Date | null = s.filledAt;
    const scannedSec = Math.floor(new Date(s.scannedAt).getTime() / 1000);

    const tgts = [s.target1, s.target2, s.target3].filter((x): x is number => x !== null);
    const recIdx = (s.recommendedTarget ?? 1) - 1;
    const targetPrice = tgts[recIdx] ?? tgts[0];

    // só considera velas posteriores ao scan
    const relevant = candles.filter((c) => c.t >= scannedSec);
    if (relevant.length === 0) continue;

    let outcome: "WIN" | "LOSS" | null = null;
    let exitPrice: number | null = null;
    let closeAt: Date | null = null;

    for (const c of relevant) {
      // 1) trigger de entrada se ainda PENDING
      if (status === "PENDING" && s.entryPrice !== null) {
        if (c.l <= s.entryPrice && c.h >= s.entryPrice) {
          status = "FILLED";
          filledAt = new Date(c.t * 1000);
        }
      }

      // 2) fechamento se FILLED (ou se acabou de virar FILLED nesta mesma vela)
      if (status === "FILLED" && s.stopPrice !== null) {
        if (isBuy) {
          if (c.l <= s.stopPrice) {
            outcome = "LOSS";
            exitPrice = s.stopPrice;
            closeAt = new Date(c.t * 1000);
            break;
          }
          if (targetPrice !== undefined && c.h >= targetPrice) {
            outcome = "WIN";
            exitPrice = targetPrice;
            closeAt = new Date(c.t * 1000);
            break;
          }
        } else if (isSell) {
          if (c.h >= s.stopPrice) {
            outcome = "LOSS";
            exitPrice = s.stopPrice;
            closeAt = new Date(c.t * 1000);
            break;
          }
          if (targetPrice !== undefined && c.l <= targetPrice) {
            outcome = "WIN";
            exitPrice = targetPrice;
            closeAt = new Date(c.t * 1000);
            break;
          }
        }
      }
    }

    // Persiste mudanças
    if (status === "FILLED" && s.status === "PENDING" && !outcome) {
      await prisma.signal.update({
        where: { id: s.id },
        data: { status: "FILLED", filledAt: filledAt ?? new Date() },
      });
      filled++;
    }

    if (outcome && exitPrice !== null && s.entryPrice !== null && s.stopPrice !== null) {
      const risk = Math.abs(s.entryPrice - s.stopPrice);
      let r: number | null = null;
      if (risk > 0) {
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
        },
      });

      if (!s.tradeCreated) {
        const account = await prisma.mT5Account.findUnique({
          where: { id: accountId },
          select: { userId: true },
        });
        if (account) {
          await prisma.trade.create({
            data: {
              userId: account.userId,
              signalId: s.id,
              asset: s.symbol,
              timeframe: s.timeframe,
              mode: s.mode,
              direction: isBuy ? "BUY" : "SELL",
              entryPrice: s.entryPrice,
              stopPrice: s.stopPrice,
              targetPrice: targetPrice ?? null,
              exitPrice,
              outcome,
              rMultiple: r,
              openedAt: filledAt ?? s.filledAt ?? s.scannedAt,
              closedAt: closeAt ?? new Date(),
              notes: `Sinal automático ${s.mode} · ${s.symbol} ${s.timeframe} (auto-close por velas)`,
            },
          });
          await prisma.signal.update({
            where: { id: s.id },
            data: { tradeCreated: true },
          });
        }
      }
      if (outcome === "WIN") won++;
      else lost++;
    }
  }

  return { filled, won, lost };
}

/**
 * Processa ticks contra sinais abertos:
 * - Se PENDING e preço tocou entrada → marca FILLED
 * - Se FILLED e preço tocou stop → marca LOSS (e cria Trade)
 * - Se FILLED e preço tocou target1/2/3 → marca WIN (e cria Trade)
 */
export async function processTicks(accountId: string, ticks: Tick[]) {
  if (ticks.length === 0) return { evaluated: 0, filled: 0, won: 0, lost: 0 };

  const symbols = Array.from(new Set(ticks.map((t) => t.symbol.toUpperCase())));
  const tickMap = new Map(
    ticks.map((t) => [t.symbol.toUpperCase(), { bid: t.bid, ask: t.ask }]),
  );

  // pega sinais abertos
  const openSignals = await prisma.signal.findMany({
    where: {
      accountId,
      status: { in: ["PENDING", "FILLED"] },
      symbol: { in: symbols },
      hasSetup: true,
    },
  });

  let filled = 0;
  let won = 0;
  let lost = 0;

  for (const s of openSignals) {
    const t = tickMap.get(s.symbol.toUpperCase());
    if (!t) continue;

    const isBuy = s.direction === "COMPRA_FORTE" || s.direction === "COMPRA_FRACA";
    const isSell = s.direction === "VENDA_FORTE" || s.direction === "VENDA_FRACA";
    if (!isBuy && !isSell) continue;

    // Preço de referência: bid para venda (preço que SELL recebe), ask para compra
    const priceForBuy = t.ask;
    const priceForSell = t.bid;

    // PENDING → verifica trigger de entrada
    if (s.status === "PENDING" && s.entryPrice !== null) {
      const tol = (s.entryZoneHigh ?? s.entryPrice) - (s.entryZoneLow ?? s.entryPrice);
      const window = Math.max(tol, Math.abs(s.entryPrice) * 0.0001) || 0;
      if (isBuy && priceForBuy <= s.entryPrice + window) {
        await prisma.signal.update({
          where: { id: s.id },
          data: { status: "FILLED", filledAt: new Date() },
        });
        filled++;
        s.status = "FILLED";
      } else if (isSell && priceForSell >= s.entryPrice - window) {
        await prisma.signal.update({
          where: { id: s.id },
          data: { status: "FILLED", filledAt: new Date() },
        });
        filled++;
        s.status = "FILLED";
      }
    }

    // FILLED → verifica stop ou target
    if (s.status === "FILLED" && s.stopPrice !== null) {
      const tgts = [s.target1, s.target2, s.target3].filter(
        (x): x is number => x !== null,
      );
      const recIdx = (s.recommendedTarget ?? 1) - 1;
      const targetPrice = tgts[recIdx] ?? tgts[0];

      let outcome: "WIN" | "LOSS" | null = null;
      let exitPrice: number | null = null;

      if (isBuy) {
        if (priceForSell <= s.stopPrice) {
          outcome = "LOSS";
          exitPrice = s.stopPrice;
        } else if (targetPrice !== undefined && priceForSell >= targetPrice) {
          outcome = "WIN";
          exitPrice = targetPrice;
        }
      } else if (isSell) {
        if (priceForBuy >= s.stopPrice) {
          outcome = "LOSS";
          exitPrice = s.stopPrice;
        } else if (targetPrice !== undefined && priceForBuy <= targetPrice) {
          outcome = "WIN";
          exitPrice = targetPrice;
        }
      }

      if (outcome && exitPrice !== null && s.entryPrice !== null) {
        const risk = Math.abs(s.entryPrice - s.stopPrice);
        let r: number | null = null;
        if (risk > 0) {
          const reward = isBuy
            ? exitPrice - s.entryPrice
            : s.entryPrice - exitPrice;
          r = Number((reward / risk).toFixed(2));
        }

        await prisma.signal.update({
          where: { id: s.id },
          data: {
            status: outcome,
            closedAt: new Date(),
            exitPrice,
            rMultiple: r,
          },
        });

        // Auto-catalog: cria Trade só se ainda não criado
        if (!s.tradeCreated) {
          const account = await prisma.mT5Account.findUnique({
            where: { id: accountId },
            select: { userId: true },
          });
          if (account) {
            const trade = await prisma.trade.create({
              data: {
                userId: account.userId,
                signalId: s.id,
                asset: s.symbol,
                timeframe: s.timeframe,
                mode: s.mode,
                direction: isBuy ? "BUY" : "SELL",
                entryPrice: s.entryPrice,
                stopPrice: s.stopPrice,
                targetPrice,
                exitPrice,
                outcome,
                rMultiple: r,
                openedAt: s.filledAt ?? s.scannedAt,
                closedAt: new Date(),
                notes: `Sinal automático ${s.mode} · ${s.symbol} ${s.timeframe}`,
              },
            });
            await prisma.signal.update({
              where: { id: s.id },
              data: { tradeCreated: true },
            });
            if (outcome === "WIN") won++;
            else lost++;
          }
        } else {
          if (outcome === "WIN") won++;
          else lost++;
        }
      }
    }
  }

  return { evaluated: openSignals.length, filled, won, lost };
}
