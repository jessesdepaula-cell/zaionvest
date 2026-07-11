import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Scanner de sinais DESCONTINUADO (produto = vitrine de EAs, decisão Jessé
// 2026-07-11). A rota vira no-op: o pg_cron/Vercel Cron que ainda a chame não
// gera mais sinais nem consome recursos. A lógica de scan segue em
// lib/scan/orchestrator.ts caso precise ser reativada.
export async function GET() {
  return NextResponse.json({ ok: true, disabled: true, reason: "signals feature discontinued" });
}
