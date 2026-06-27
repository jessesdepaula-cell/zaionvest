import { NextResponse } from "next/server";
import { requireActiveSubscription } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { smcSystemPrompt } from "@/lib/smcManual";
import { classicoSystemPrompt } from "@/lib/classicoManual";
import { getAIClient } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type Mode = "CLASSICO" | "SMC";

const SMC_SYSTEM_PROMPT = smcSystemPrompt({ withImage: true, jsonShape: "analyze" });
const CLASSICO_RIGOROSO_PROMPT = classicoSystemPrompt({ jsonShape: "analyze" });

const SYSTEM_PROMPT = (mode: Mode) =>
  mode === "SMC" ? SMC_SYSTEM_PROMPT : CLASSICO_RIGOROSO_PROMPT;

// Mantido apenas como referência histórica — não é mais usado.
const _CLASSICO_LEGACY = `Você é um Analista Financeiro Institucional de Elite e especialista em Visão Computacional. Sua tarefa é analisar a imagem de um gráfico financeiro fornecida e retornar APENAS um objeto JSON válido, sem markdown, sem texto explicativo fora do JSON.
Modo de análise: CLÁSSICO (Tendência + Suportes/Resistências + Padrões de candles).

PASSO 1: PORTÃO DE QUALIDADE (QUALITY GATE)
Verifique visualmente se a imagem contém: 1. Nome do ativo legível. 2. Timeframe legível. 3. Escala de preços legível. 4. Contexto suficiente (30-50 velas). 5. Imagem nítida.
SE QUALQUER ITEM FALTAR: Retorne {"status": "INVALIDO", "mensagem_erro": "Explique exatamente o que falta"}. NÃO INVENTE DADOS.

PASSO 2: ANÁLISE TÉCNICA (Se "status": "VALIDO")
Foque em Tendência, Suportes/Resistências, Padrões de Velas/Gráficos.

PASSO 3: PLANO DE TRADE — OBJETIVO E ACIONÁVEL

Sempre leia a escala de preços do gráfico para devolver VALORES NUMÉRICOS reais. Não invente preços fora da escala visível.

- DIRECAO: classifique como "COMPRA_FORTE" (todos os sinais alinhados a favor da compra), "COMPRA_FRACA" (viés de compra mas com ressalvas/contraindicações), "VENDA_FORTE", "VENDA_FRACA" ou "NEUTRO" (sem setup claro).
- PROBABILIDADE: estimativa em % de sucesso do setup, considerando contexto, confluências e qualidade da estrutura. Ex: "65%".
- CONFIANCA_IA: o quanto VOCÊ confia na sua própria leitura visual (não confunda com probabilidade do trade). Use "ALTA", "MEDIA" ou "BAIXA".
- ENTRADA:
    • preco: valor numérico exato em que entrar (ex: "1.0850", "67250", "R$ 28.50").
    • zona: faixa aceitável (ex: "1.0845 - 1.0855").
    • tipo: como entrar (ex: "Limit em pullback no Order Block", "Market após rompimento confirmado", "Sell stop abaixo do range").
- STOP_LOSS:
    • preco: valor numérico estrutural.
    • justificativa_estrutural: 1 frase do PORQUÊ daquele nível (ex: "Abaixo do fundo do Order Block 1H", "Acima da liquidez interna do range").
- ALVOS: SEMPRE 3 alvos progressivos (mesmo no Modo Clássico). Cada um com:
    • nivel: 1, 2 ou 3.
    • preco: valor numérico.
    • rr: R:R calculado em cima do stop, ex: "1:1.5", "1:2.8".
- ALVO_RECOMENDADO: qual dos 3 buscar (1, 2 ou 3) considerando contexto/risco.
- RAZAO_ALVO_RECOMENDADO: 1 frase explicando por que esse alvo é o ideal (ex: "Próxima liquidez forte antes de zona de oferta diária").
- RISCO_RETORNO_ESTIMADO: o R:R do alvo recomendado.
- JUSTIFICATIVA: 2-3 frases objetivas, sem enrolação. Direto ao ponto.

REGRAS:
- Seja conciso. Cada campo, no máximo 1-2 frases. Sem florear.
- Não use emojis, não use markdown, não use ** ou ##.
- Se for "NEUTRO", ainda assim devolva entrada/stop/alvos como "—" e direcao "NEUTRO".

FORMATO JSON OBRIGATÓRIO:
{
  "status": "VALIDO" ou "INVALIDO",
  "modo_aplicado": "CLASSICO" ou "SMC",
  "validacao": { "ativo_identificado": "string", "timeframe_identificado": "string", "qualidade_imagem": "ALTA" | "MEDIA" | "BAIXA" },
  "mensagem_erro": "string (apenas se INVALIDO)",
  "analise": {
    "direcao": "COMPRA_FORTE" | "COMPRA_FRACA" | "VENDA_FORTE" | "VENDA_FRACA" | "NEUTRO",
    "probabilidade": "string (ex: '70%')",
    "confianca_ia": "ALTA" | "MEDIA" | "BAIXA",
    "estrutura_ou_tendencia": "string (1-2 frases)",
    "entrada": { "preco": "string", "zona": "string", "tipo": "string" },
    "stop_loss": { "preco": "string", "justificativa_estrutural": "string" },
    "alvos": [
      { "nivel": 1, "preco": "string", "rr": "string" },
      { "nivel": 2, "preco": "string", "rr": "string" },
      { "nivel": 3, "preco": "string", "rr": "string" }
    ],
    "alvo_recomendado": 1,
    "razao_alvo_recomendado": "string (1 frase)",
    "risco_retorno_estimado": "string",
    "justificativa": "string (2-3 frases)"
  },
  "escala_visivel": {
    "preco_topo": "string (maior preço visível na escala da imagem, ex: '1.0920')",
    "preco_base": "string (menor preço visível na escala da imagem, ex: '1.0780')"
  }
}

IMPORTANTE: O bloco "escala_visivel" é OBRIGATÓRIO quando status=VALIDO. Leia os preços extremos da régua de preços da imagem — esses valores serão usados para desenhar linhas no gráfico do usuário, então precisam ser precisos.`;
void _CLASSICO_LEGACY; // evita warning unused

function cleanJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  return s.trim();
}

export async function POST(req: Request) {
  const sub = await requireActiveSubscription();
  if (!sub.ok) {
    return NextResponse.json(
      { error: sub.reason === "unauthenticated" ? "Não autenticado" : "Assinatura inativa" },
      { status: sub.reason === "unauthenticated" ? 401 : 402 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { image, mode } = body as { image?: string; mode?: Mode };

  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "Imagem obrigatória" }, { status: 400 });
  }
  if (mode !== "CLASSICO" && mode !== "SMC") {
    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Chave de API (OPENAI_API_KEY ou GEMINI_API_KEY) não configurada" },
      { status: 500 },
    );
  }

  const { openai, model } = getAIClient(sub.user);

  const imageUrl = image.startsWith("data:")
    ? image
    : `data:image/png;base64,${image}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT(mode) },
        {
          role: "user",
          content: [
            { type: "text", text: `Modo: ${mode}. Leia a escala de preços da imagem e use VALORES NUMÉRICOS reais. Retorne APENAS o JSON.` },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = cleanJson(raw);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        {
          status: "INVALIDO",
          modo_aplicado: mode,
          mensagem_erro:
            "A IA retornou um formato inesperado. Tente novamente com um print mais nítido.",
        },
        { status: 200 },
      );
    }

    await prisma.analysis
      .create({
        data: {
          userId: sub.user.id,
          mode,
          status: String(parsed.status ?? "INVALIDO"),
          asset:
            (parsed as { validacao?: { ativo_identificado?: string } })?.validacao
              ?.ativo_identificado ?? null,
          timeframe:
            (parsed as { validacao?: { timeframe_identificado?: string } })?.validacao
              ?.timeframe_identificado ?? null,
          resultJson: parsed as object,
        },
      })
      .catch(() => null);

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { status: "INVALIDO", mensagem_erro: `Falha na análise: ${message}` },
      { status: 500 },
    );
  }
}
