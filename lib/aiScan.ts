import OpenAI from "openai";

export type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };

export type ScanResult = {
  hasSetup: boolean;
  direction?: "COMPRA_FORTE" | "COMPRA_FRACA" | "VENDA_FORTE" | "VENDA_FRACA" | "NEUTRO";
  probability?: number;
  confidence?: "ALTA" | "MEDIA" | "BAIXA";
  structure?: string;
  entryPrice?: number;
  entryZoneLow?: number;
  entryZoneHigh?: number;
  stopPrice?: number;
  target1?: number;
  target2?: number;
  target3?: number;
  recommendedTarget?: number;
  riskReward?: string;
  justification?: string;
};

function candlesToText(candles: Candle[]): string {
  return candles
    .map((c) => {
      const d = new Date(c.t * 1000).toISOString().slice(0, 16).replace("T", " ");
      return `${d} O:${c.o} H:${c.h} L:${c.l} C:${c.c}`;
    })
    .join("\n");
}

function systemPrompt(mode: "SMC" | "CLASSICO") {
  return `Você é um Analista Financeiro Institucional de Elite. Analise os dados de OHLC fornecidos e identifique se há um SETUP DE TRADE OPERACIONAL AGORA. Retorne APENAS JSON, sem markdown.

MODO: ${mode}
- Se SMC: foque em Estrutura (BOS/CHoCH), POIs (Order Blocks, FVG/Imbalances), Liquidez (Equal Highs/Lows).
- Se CLASSICO: foque em Tendência, Suportes/Resistências, Padrões de candles/gráficos.

QUANDO RETORNAR "hasSetup": false:
- Mercado em consolidação sem POI claro
- Sem confluência mínima de sinais
- Em meio a movimento exaustivo sem pullback
- Estrutura ambígua

QUANDO RETORNAR "hasSetup": true:
- Há um plano operacional CLARO agora, com entrada/stop/alvo bem definidos
- Pelo menos 2 confluências

PREÇOS: Use sempre valores NUMÉRICOS exatos lidos das velas (não estimativas).

REGRAS:
- Seja conciso. Justificativa em 2-3 frases máximo.
- Sem emojis, sem markdown, sem **.
- Probabilidade entre 0-100 (inteiro).
- recommendedTarget: 1, 2 ou 3.

FORMATO JSON OBRIGATÓRIO:
{
  "hasSetup": true | false,
  "direction": "COMPRA_FORTE" | "COMPRA_FRACA" | "VENDA_FORTE" | "VENDA_FRACA" | "NEUTRO",
  "probability": 0-100,
  "confidence": "ALTA" | "MEDIA" | "BAIXA",
  "structure": "string (1-2 frases)",
  "entryPrice": number,
  "entryZoneLow": number,
  "entryZoneHigh": number,
  "stopPrice": number,
  "target1": number,
  "target2": number,
  "target3": number,
  "recommendedTarget": 1 | 2 | 3,
  "riskReward": "string ex: 1:2.3",
  "justification": "string (2-3 frases)"
}`;
}

export async function scanWithAI(input: {
  symbol: string;
  timeframe: string;
  mode: "SMC" | "CLASSICO";
  candles: Candle[];
}): Promise<ScanResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_SCAN_MODEL ?? "gpt-4o-mini";

  const userText = `Símbolo: ${input.symbol}
Timeframe: ${input.timeframe}
Últimas ${input.candles.length} velas (mais recentes ao final):
${candlesToText(input.candles)}

Há um SETUP CLARO operacional AGORA? Retorne o JSON conforme especificado.`;

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt(input.mode) },
      { role: "user", content: userText },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return parsed as ScanResult;
  } catch {
    return { hasSetup: false };
  }
}
