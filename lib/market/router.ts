import { findSymbol, type SymbolSpec } from "./symbols";
import type { Candle, Quote, Timeframe } from "./types";
import { binanceCandles, binanceQuote } from "./providers/binance";
import { twelveCandles, twelveQuote } from "./providers/twelvedata";
import { yahooCandles, yahooQuote } from "./providers/yahoo";

type CacheEntry<T> = { value: T; expiresAt: number };
const memCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const e = memCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return e.value as T;
}

function setCached<T>(key: string, value: T, ttlMs: number) {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function specOrThrow(symbol: string): SymbolSpec {
  const s = findSymbol(symbol);
  if (!s) throw new Error(`Símbolo não suportado: ${symbol}`);
  return s;
}

const CANDLES_TTL: Record<Timeframe, number> = {
  M5: 30_000,
  M15: 60_000,
  M30: 120_000,
  H1: 300_000,
  H4: 600_000,
  D1: 1_800_000,
};

export async function getCandles(
  symbol: string,
  tf: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  const spec = specOrThrow(symbol);
  const cacheKey = `c:${spec.symbol}:${tf}:${limit}`;
  const cached = getCached<Candle[]>(cacheKey);
  if (cached) return cached;

  let candles: Candle[];
  if (spec.assetClass === "crypto" && spec.binance) {
    try {
      candles = await binanceCandles(spec.binance, tf, limit);
    } catch (e) {
      if (spec.twelvedata) {
        candles = await twelveCandles(spec.twelvedata, tf, limit);
      } else {
        throw e;
      }
    }
  } else {
    // XAUUSD: Yahoo retorna GC=F (futuro COMEX) — OHLC bem diferente do XAU/USD
    // spot que o MT5 (e as corretoras Forex) usam. TwelveData tem XAU/USD spot,
    // então priorizamos ele para o ouro quando a chave existir.
    const preferTwelve = spec.symbol === "XAUUSD" && !!spec.twelvedata;
    if (preferTwelve && spec.twelvedata) {
      try {
        candles = await twelveCandles(spec.twelvedata, tf, limit);
      } catch (e) {
        console.warn(`[getCandles] TwelveData falhou para ${spec.symbol}. Caindo p/ Yahoo. Erro:`, e instanceof Error ? e.message : e);
        candles = await yahooCandles(spec.symbol, tf, limit);
      }
    } else {
      // Forex geral: Yahoo primário (grátis, sem chave), TwelveData fallback.
      try {
        candles = await yahooCandles(spec.symbol, tf, limit);
      } catch (e) {
        console.warn(`[getCandles] Falha no Yahoo Finance para ${spec.symbol}. Tentando TwelveData... Erro:`, e instanceof Error ? e.message : e);
        if (spec.twelvedata) {
          candles = await twelveCandles(spec.twelvedata, tf, limit);
        } else {
          throw e;
        }
      }
    }
  }

  setCached(cacheKey, candles, CANDLES_TTL[tf]);
  return candles;
}

export async function getQuote(symbol: string): Promise<Quote> {
  const spec = specOrThrow(symbol);
  const cacheKey = `q:${spec.symbol}`;
  const cached = getCached<Quote>(cacheKey);
  if (cached) return cached;

  let q: Quote;
  if (spec.assetClass === "crypto" && spec.binance) {
    try {
      q = await binanceQuote(spec.binance);
    } catch (e) {
      if (spec.twelvedata) {
        q = await twelveQuote(spec.twelvedata);
      } else {
        throw e;
      }
    }
  } else {
    // Para Forex, usamos Yahoo Finance como primário e TwelveData como fallback
    try {
      q = await yahooQuote(spec.symbol);
    } catch (e) {
      console.warn(`[getQuote] Falha no Yahoo Finance para ${spec.symbol}. Tentando TwelveData... Erro:`, e instanceof Error ? e.message : e);
      if (spec.twelvedata) {
        q = await twelveQuote(spec.twelvedata);
      } else {
        throw e;
      }
    }
  }

  // mantém símbolo canônico (não o do provider)
  q.symbol = spec.symbol;
  setCached(cacheKey, q, spec.assetClass === "crypto" ? 5_000 : 30_000);
  return q;
}

