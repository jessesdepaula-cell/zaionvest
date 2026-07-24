import { NextResponse } from "next/server";
import { getQuote } from "@/lib/market/router";
import { getOrCreateUser } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Não é proxy público: exige login para não virar um túnel aberto de dados de
  // mercado (custo/abuso das APIs upstream).
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol obrigatório" }, { status: 400 });
  }
  try {
    const q = await getQuote(symbol);
    return NextResponse.json(q);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro" },
      { status: 502 },
    );
  }
}
