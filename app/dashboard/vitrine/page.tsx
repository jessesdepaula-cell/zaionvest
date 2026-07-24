import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EACard } from "@/components/vitrine/EACard";
import { EAFilters } from "@/components/vitrine/EAFilters";
import { PortfoliosSection } from "@/components/vitrine/PortfoliosSection";
import { Suspense } from "react";
import { Bot } from "lucide-react";
import Link from "next/link";

export const revalidate = 120;

export const metadata = {
  title: "Vitrine de EAs (Forex & Cripto) — ZaionVest",
};

interface SearchParams {
  symbol?: string;
  timeframe?: string;
  style?: string;
  sort?: string;
  top?: string;
  corr?: string;
}

export default async function DashboardVitrinePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { userId: clerkId } = await auth();

  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      subscriptionStatus: true,
      eaDownloads: { select: { eaId: true } },
    },
  });

  if (!user) redirect("/sign-in");

  const canDownload =
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "trialing";

  const downloadedIds = new Set(user.eaDownloads.map((d) => d.eaId));

  // Vitrine de Forex / Cripto (Exclui robôs do Mini Índice Bovespa B3 que possuem sua vitrine exclusiva)
  const where: Record<string, unknown> = {
    status: "APPROVED",
    symbol: { notIn: ["WIN$", "WIN", "WINZ26", "WINFOOT", "WIN@"] },
  };
  if (params.symbol) where.symbol = params.symbol;
  if (params.timeframe) where.timeframe = params.timeframe;
  if (params.style) where.style = params.style;

  const orderBy: Record<string, string>[] = [];
  switch (params.sort ?? "wfe_desc") {
    case "recovery_desc": orderBy.push({ oosRetDd: "desc" }); break;
    case "pf_desc": orderBy.push({ profitFactor: "desc" }); break;
    case "dd_asc": orderBy.push({ maxDrawdown: "asc" }); break;
    case "newest": orderBy.push({ createdAt: "desc" }); break;
    default: orderBy.push({ oosRetDd: "desc" });
  }

  const eas = await prisma.eA.findMany({
    where,
    orderBy,
    select: {
      id: true, slug: true, name: true, symbol: true, timeframe: true,
      style: true, exitMode: true, status: true, wfe: true, oosRetDd: true,
      profitFactor: true, maxDrawdown: true, totalTrades: true,
      oosWins: true, oosTotalWindows: true, equityCurveOos: true,
      strategyDef: true,
    },
  });

  // 1. Filtragem por TOP 25% mais robustos (por Ret/DD do holdout OOS)
  let filteredEas = [...eas];
  if (params.top === "25") {
    const score = (e: { oosRetDd?: number | null; wfe?: number | null }) =>
      e.oosRetDd ?? e.wfe ?? 0;
    const sortedByScore = [...filteredEas].sort((a, b) => score(b) - score(a));
    const limit = Math.ceil(sortedByScore.length * 0.25);
    const top25Ids = new Set(sortedByScore.slice(0, limit).map((ea) => ea.id));
    filteredEas = filteredEas.filter((ea) => top25Ids.has(ea.id));
  }

  // 2. Filtragem por correlação máxima de retornos de curva (Pearson)
  const maxCorr = params.corr ? parseFloat(params.corr) : null;
  if (maxCorr !== null && !isNaN(maxCorr)) {
    const accepted: typeof eas = [];
    for (const ea of filteredEas) {
      const curve = (ea.equityCurveOos as any[]) || [];
      if (curve.length < 3) {
        accepted.push(ea);
        continue;
      }
      
      const rets = getReturns(curve);
      let isClone = false;
      
      for (const other of accepted) {
        const otherCurve = (other.equityCurveOos as any[]) || [];
        if (otherCurve.length < 3) continue;
        const otherRets = getReturns(otherCurve);
        
        const corrVal = pearson(rets, otherRets);
        if (Math.abs(corrVal) > maxCorr) {
          isClone = true;
          break;
        }
      }
      
      if (!isClone) {
        accepted.push(ea);
      }
    }
    filteredEas = accepted;
  }

  return (
    <div className="min-h-screen bg-[#000] text-zinc-300">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-5 w-5 text-[#2563EB]" />
              <h1 className="text-xl font-bold text-[#F5F5F5]">
                Vitrine de EAs
              </h1>
            </div>
            <p className="text-xs text-zinc-500">
              {filteredEas.length} estratégi{filteredEas.length === 1 ? "a aprovada" : "as aprovadas"} e revalidadas ·{" "}
              {downloadedIds.size > 0
                ? `${downloadedIds.size} baixad${downloadedIds.size === 1 ? "a" : "as"} por você`
                : "nenhuma baixada ainda"}
            </p>
          </div>
        </div>

        {/* Banner de assinatura necessária */}
        {!canDownload && (
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-5 py-4">
            <p className="text-xs text-amber-300">
              <strong>Assinatura necessária para download.</strong>{" "}
              Você pode ver todos os EAs e suas métricas, mas precisa de uma
              assinatura ativa para baixar os arquivos .ex5.{" "}
              <Link
                href="/billing"
                className="underline underline-offset-2 hover:text-amber-200"
              >
                Ativar assinatura →
              </Link>
            </p>
          </div>
        )}

        {/* Portfólios Prontos Zaion */}
        <PortfoliosSection />

        {/* Filtros */}
        <Suspense fallback={null}>
          <div className="mb-6">
            <EAFilters total={filteredEas.length} />
          </div>
        </Suspense>

        {/* Grid */}
        {filteredEas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bot className="h-10 w-10 text-zinc-700 mb-4" />
            <p className="text-sm text-zinc-500">
              Nenhuma estratégia aprovada com esses filtros.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEas.map((ea) => (
              <div key={ea.id} className="relative">
                {downloadedIds.has(ea.id) && (
                  <div className="absolute -top-2 -right-2 z-10 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                    Baixado
                  </div>
                )}
                <EACard
                  {...ea}
                  status={ea.status as "APPROVED" | "REJECTED" | "PENDING"}
                  equityCurveOos={
                    ea.equityCurveOos as
                      | Array<{ date: string; value: number }>
                      | null
                  }
                  canDownload={canDownload}
                  detailHref={`/dashboard/vitrine/${ea.slug}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Funções Matemáticas de Correlação (Pearson) ──────────────────────────────

function getReturns(curve: any[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i].value;
    const b = curve[i + 1].value;
    if (a > 0) {
      out.push((b - a) / a);
    }
  }
  return out;
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0.0;
  const x = a.slice(-n);
  const y = b.slice(-n);

  const ma = x.reduce((acc, v) => acc + v, 0) / n;
  const mb = y.reduce((acc, v) => acc + v, 0) / n;

  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - ma;
    const dy = y[i] - mb;
    num += dx * dy;
    da += dx * dx;
    db += dy * dy;
  }
  if (da * db === 0) return 0.0;
  return num / (Math.sqrt(da) * Math.sqrt(db));
}

