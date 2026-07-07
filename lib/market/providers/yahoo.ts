import type { Candle, Quote, Timeframe } from "../types";

// Yahoo Chart API aceita: 1m,2m,5m,15m,30m,60m,90m,1h,1d,5d,1wk,1mo,3mo.
// Não existe "4h" nativo — H4 é agregado a partir de 60m (ver yahooCandles).
const TF_TO_YAHOO: Record<Exclude<Timeframe, "H4">, string> = {
  M5: "5m",
  M15: "15m",
  M30: "30m",
  H1: "60m",
  D1: "1d",
};

// Símbolos do Yahoo Finance. Nada de futuro (GC=F) para XAUUSD — spot é o que
// o MT5/corretoras Forex mostram. Yahoo não tem XAU/USD spot puro, então
// XAUUSD sai daqui vazio e o router deve pegar TwelveData primeiro.
const SYMBOL_MAP: Record<string, string> = {
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "USDJPY=X",
  USDCHF: "USDCHF=X",
  XAUUSD: "XAUUSD=X",
};

function rangeForLimit(tf: Timeframe, limit: number): string {
  if (tf === "M5") {
    return limit <= 100 ? "1d" : "5d";
  }
  if (tf === "M15" || tf === "M30") {
    return limit <= 100 ? "5d" : "1mo";
  }
  if (tf === "H1") {
    return limit <= 100 ? "1mo" : "3mo";
  }
  if (tf === "H4") {
    // Precisamos de 4x mais candles H1 para agregar em H4 sem furos.
    return limit <= 100 ? "3mo" : "1y";
  }
  if (tf === "D1") {
    return limit <= 100 ? "1y" : "max";
  }
  return "1mo";
}

/**
 * Agrega candles H1 -> H4 alinhando pelo horário UTC (buckets de 4h).
 * Preserva o OHLC correto: open do 1º candle do bucket, high/low máximos/mínimos,
 * close do último. Só emite bucket completo se tiver >=2 candles (evita "H4 de 1h").
 */
function aggregateH1ToH4(h1: Candle[]): Candle[] {
  if (h1.length === 0) return h1;
  const out: Candle[] = [];
  const bucketSec = 4 * 3600;
  let bucketStart = -1;
  let cur: Candle | null = null;
  let n = 0;
  for (const c of h1) {
    const b = Math.floor(c.t / bucketSec) * bucketSec;
    if (b !== bucketStart) {
      if (cur && n >= 1) out.push(cur);
      cur = { t: b, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v };
      bucketStart = b;
      n = 1;
    } else if (cur) {
      cur.h = Math.max(cur.h, c.h);
      cur.l = Math.min(cur.l, c.l);
      cur.c = c.c;
      if (typeof c.v === "number") cur.v = (cur.v ?? 0) + c.v;
      n += 1;
    }
  }
  if (cur && n >= 1) out.push(cur);
  return out;
}

export async function yahooCandles(
  symbol: string,
  tf: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  // H4 é sintético em cima de H1 (Yahoo não oferece 4h nativo).
  if (tf === "H4") {
    const h1 = await yahooCandles(symbol, "H1", Math.min(1000, limit * 4 + 20));
    const h4 = aggregateH1ToH4(h1);
    return h4.length > limit ? h4.slice(-limit) : h4;
  }

  const yahooSymbol = SYMBOL_MAP[symbol.toUpperCase().replace("/", "")] ?? `${symbol}=X`;
  const range = rangeForLimit(tf, limit);
  const interval = TF_TO_YAHOO[tf as Exclude<Timeframe, "H4">] ?? "15m";
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance candles HTTP ${res.status}`);
  }

  const j = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: (number | null)[];
            high?: (number | null)[];
            low?: (number | null)[];
            close?: (number | null)[];
            volume?: (number | null)[];
          }>;
        };
      }>;
      error?: {
        code?: string;
        description?: string;
      };
    };
  };

  if (j.chart?.error) {
    throw new Error(`Yahoo Finance Error: ${j.chart.error.description ?? "desconhecido"}`);
  }

  const result = j.chart?.result?.[0];
  const timestamp = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];

  if (!result || !timestamp || !quote) {
    throw new Error("Yahoo Finance: estrutura de resposta inválida");
  }

  const candles: Candle[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const t = timestamp[i];
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i];

    if (
      t === undefined ||
      o === null ||
      h === null ||
      l === null ||
      c === null ||
      o === undefined ||
      h === undefined ||
      l === undefined ||
      c === undefined
    ) {
      continue;
    }

    const on = Number(o), hn = Number(h), ln = Number(l), cn = Number(c);
    // OHLC inválido do Yahoo (não é raro: candles com low=0 ou high<low no
    // fim de semana em Forex, buracos em cripto de baixa liquidez).
    if (!(hn >= ln && hn >= on && hn >= cn && ln <= on && ln <= cn && ln > 0)) {
      continue;
    }
    candles.push({
      t,
      o: on,
      h: hn,
      l: ln,
      c: cn,
      v: v !== null && v !== undefined ? Number(v) : undefined,
    });
  }

  // Sanity: descarta spikes fantasmas (candle >8x o range mediano da amostra).
  // Aparecem em Forex do Yahoo perto da abertura de segunda e distorcem a
  // escala do gráfico e o cálculo do ATR/stops.
  if (candles.length > 20) {
    const ranges = candles.map((k) => k.h - k.l).sort((a, b) => a - b);
    const median = ranges[Math.floor(ranges.length / 2)] || 0;
    if (median > 0) {
      const cutoff = median * 8;
      for (let i = candles.length - 1; i >= 0; i--) {
        if (candles[i].h - candles[i].l > cutoff) candles.splice(i, 1);
      }
    }
  }

  // Se retornou mais candles do que o limite solicitado, pega os últimos
  if (candles.length > limit) {
    return candles.slice(-limit);
  }

  return candles;
}

export async function yahooQuote(symbol: string): Promise<Quote> {
  const yahooSymbol = SYMBOL_MAP[symbol.toUpperCase().replace("/", "")] ?? `${symbol}=X`;
  
  // Usamos o endpoint de chart de 1 dia para pegar o regularMarketPrice mais recente sem precisar de autenticação
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?interval=1m&range=1d`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance quote HTTP ${res.status}`);
  }

  const j = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          symbol?: string;
        };
      }>;
      error?: {
        description?: string;
      };
    };
  };

  if (j.chart?.error) {
    throw new Error(`Yahoo Finance Quote Error: ${j.chart.error.description ?? "desconhecido"}`);
  }

  const meta = j.chart?.result?.[0]?.meta;
  const mid = meta?.regularMarketPrice ?? 0;

  if (mid === 0) {
    throw new Error("Yahoo Finance Quote: preço regular de mercado indisponível");
  }

  return {
    symbol: symbol.toUpperCase(),
    bid: mid,
    ask: mid,
    spread: 0,
    ts: Math.floor(Date.now() / 1000),
  };
}
