import { smcSystemPrompt } from "./smcManual";
import { classicoSystemPrompt } from "./classicoManual";
import { getAIClient } from "./ai";

export type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };

export type SmcChecklist = {
  vies_HTF_a_favor?: boolean;
  liquidez_identificada?: boolean;
  sweep_corpo_fecha_dentro?: boolean;
  displacement_com_FVG?: boolean;
  ChoCh_confirmado_fechamento?: boolean;
  OB_em_zona_correta?: boolean;
};

export type ClassicoChecklist = {
  tendencia_SMA200_alinhada?: boolean;
  alinhamento_perfeito_medias?: boolean;
  preco_na_zona_de_valor?: boolean;
  confluencia_suporte_resistencia?: boolean;
  volume_pullback_decrescente?: boolean;
  candle_gatilho_valido?: boolean;
};

export type ScanResult = {
  hasSetup: boolean;
  tipo_setup?: string;
  direction?: "COMPRA_FORTE" | "COMPRA_FRACA" | "VENDA_FORTE" | "VENDA_FRACA" | "NEUTRO";
  probability?: number;
  confidence?: "ALTA" | "MEDIA" | "BAIXA";
  checklist_smc?: SmcChecklist;
  checklist_classico?: ClassicoChecklist;
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

/** Tabela mais compacta — útil para HTF que precisa menos detalhe */
function candlesCompact(candles: Candle[]): string {
  return candles
    .map((c) => {
      const d = new Date(c.t * 1000).toISOString().slice(5, 16).replace("T", " ");
      return `${d} ${c.o}/${c.h}/${c.l}/${c.c}`;
    })
    .join("\n");
}

function htfFor(tf: string): string {
  switch (tf) {
    case "M5": return "H1";
    case "M15": return "H1";
    case "M30": return "H4";
    case "H1": return "H4";
    case "H4": return "D1";
    case "D1": return "W1";
    default: return "H1";
  }
}

const SMC_PROMPT = smcSystemPrompt({ withImage: false, jsonShape: "scan" });
const CLASSICO_PROMPT = classicoSystemPrompt({ jsonShape: "scan" });

function systemPrompt(mode: "SMC" | "CLASSICO") {
  if (mode === "SMC") return SMC_PROMPT;
  return CLASSICO_PROMPT;
}

function _unused_legacy() {
  return `Você é um Analista Financeiro Institucional de Elite. Analise os dados de OHLC fornecidos e identifique se há um SETUP DE TRADE OPERACIONAL AGORA. Retorne APENAS JSON, sem markdown.

MODO: CLÁSSICO — foque em Tendência, Suportes/Resistências, Padrões de candles/gráficos.

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

// Ambos os modos agora têm manuais rigorosos — usar gpt-4o por padrão
function pickModel(mode: "SMC" | "CLASSICO"): string {
  if (mode === "SMC") {
    return process.env.OPENAI_SCAN_MODEL_SMC ?? process.env.OPENAI_SCAN_MODEL ?? "gpt-4o";
  }
  return process.env.OPENAI_SCAN_MODEL_CLASSICO ?? process.env.OPENAI_SCAN_MODEL ?? "gpt-4o";
}

export async function scanWithAI(input: {
  symbol: string;
  timeframe: string;
  mode: "SMC" | "CLASSICO";
  candles: Candle[];
  htfCandles?: Candle[];
  userKeys?: { geminiApiKey?: string | null; openaiApiKey?: string | null };
}): Promise<ScanResult> {
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY && !input.userKeys?.geminiApiKey && !input.userKeys?.openaiApiKey) {
    throw new Error("Chave de API (GEMINI_API_KEY ou chave nas Configurações) ausente");
  }
  const { openai, model: defaultModel, isGemini } = getAIClient(input.userKeys);
  const model = isGemini ? defaultModel : pickModel(input.mode);

  // Reduzir tamanho dos dados enviados para a IA para evitar estourar limites de tokens (TPM)
  const slicedCandles = input.candles.slice(-120);
  const slicedHtfCandles = input.htfCandles ? input.htfCandles.slice(-60) : [];

  const htfTf = htfFor(input.timeframe);
  const htfSection =
    slicedHtfCandles.length > 0
      ? `\n\nCONTEXTO HTF (timeframe superior ${htfTf}, ${slicedHtfCandles.length} velas — use para validar o viés macro):
${candlesCompact(slicedHtfCandles)}`
      : "";

  const userText = `Símbolo: ${input.symbol}
Timeframe principal (LTF): ${input.timeframe}
Últimas ${slicedCandles.length} velas LTF (mais recentes ao final):
${candlesToText(slicedCandles)}${htfSection}

Há um SETUP CLARO operacional AGORA? Use o contexto HTF para validar o viés. Retorne o JSON conforme especificado.`;

  let completion;
  let attempts = 0;
  while (attempts < 3) {
    try {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(input.mode) },
          { role: "user", content: userText },
        ],
      });
      break;
    } catch (e) {
      attempts++;
      const errMessage = e instanceof Error ? e.message : String(e);
      if (attempts >= 3) {
        throw new Error(`[IA Scan] Limite de tentativas excedido. Erro original: ${errMessage}`);
      }
      if (errMessage.includes("429") || errMessage.includes("Rate limit") || errMessage.includes("rate_limit")) {
        console.warn(`[IA Scan] Limite de taxa da OpenAI atingido. Aguardando 10s para tentar novamente (tentativa ${attempts}/3)...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      } else {
        throw e;
      }
    }
  }

  const raw = completion?.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return parsed as ScanResult;
  } catch {
    return { hasSetup: false };
  }
}
