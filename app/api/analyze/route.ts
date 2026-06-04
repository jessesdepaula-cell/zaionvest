import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireActiveSubscription } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

type Mode = "CLASSICO" | "SMC";

const SYSTEM_PROMPT = (mode: Mode) => `Você é um Analista Financeiro Institucional de Elite e especialista em Visão Computacional. Sua tarefa é analisar a imagem de um gráfico financeiro fornecida e retornar APENAS um objeto JSON válido, sem markdown, sem texto explicativo fora do JSON.
O modo de análise solicitado é: ${mode}.

PASSO 1: PORTÃO DE QUALIDADE (QUALITY GATE)
Verifique visualmente se a imagem contém: 1. Nome do ativo legível. 2. Timeframe legível. 3. Escala de preços legível. 4. Contexto suficiente (30-50 velas). 5. Imagem nítida.
SE QUALQUER ITEM FALTAR: Retorne {"status": "INVALIDO", "mensagem_erro": "Explique exatamente o que falta"}. NÃO INVENTE DADOS.

PASSO 2: ANÁLISE TÉCNICA (Se "status": "VALIDO")
- Se "CLASSICO": Foque em Tendência, Suportes/Resistências, Padrões de Velas/Gráficos.
- Se "SMC": Foque em Estrutura (BOS/CHoCH), POIs (Order Blocks, FVG/Imbalances) e Liquidez (Equal Highs/Lows).

PASSO 3: PLANO DE TRADE
Defina Entrada, Stop Loss (estrutural), Take Profit (próxima liquidez/resistência) e Risco/Retorno estimado.

FORMATO JSON OBRIGATÓRIO:
{
  "status": "VALIDO" ou "INVALIDO",
  "modo_aplicado": "CLASSICO" ou "SMC",
  "validacao": { "ativo_identificado": "string", "timeframe_identificado": "string", "qualidade_imagem": "ALTA" | "MEDIA" | "BAIXA" },
  "mensagem_erro": "string (apenas se INVALIDO)",
  "analise": {
    "estrutura_ou_tendencia": "string",
    "ponto_entrada": "string",
    "stop_loss": "string",
    "take_profit": "string",
    "risco_retorno_estimado": "string",
    "confianca_ia": "string",
    "justificativa": "string"
  }
}`;

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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada" },
      { status: 500 },
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  const imageUrl = image.startsWith("data:")
    ? image
    : `data:image/png;base64,${image}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT(mode) },
        {
          role: "user",
          content: [
            { type: "text", text: `Modo: ${mode}. Retorne APENAS o JSON, sem texto fora dele.` },
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
