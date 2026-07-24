import { NextResponse } from "next/server";

/**
 * Autorização server-to-server via Bearer CRON_SECRET (crons da Vercel/pg_cron e
 * o worker Windows/MT5).
 *
 * FAIL-CLOSED: se CRON_SECRET não estiver configurado, a rota REJEITA (503) em
 * vez de ficar aberta. Antes era `if (secret && authHeader !== ...)`, ou seja,
 * uma env var esquecida deixava o endpoint público — o que exporia inclusive o
 * `strategyDef` (lógica proprietária dos EAs) em /api/worker/next.
 *
 * Retorna `null` quando autorizado, ou uma NextResponse de erro caso contrário.
 */
export function checkCronSecret(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[auth] CRON_SECRET não configurado — rota server-to-server rejeitada",
    );
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET ausente" },
      { status: 503 },
    );
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
