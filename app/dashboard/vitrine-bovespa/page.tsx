import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EACard } from "@/components/vitrine/EACard";
import { EAFilters } from "@/components/vitrine/EAFilters";
import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import Link from "next/link";

export const revalidate = 120;

export const metadata = {
  title: "Vitrine Bovespa (Mini Índice B3) — ZaionVest",
};

interface SearchParams {
  symbol?: string;
  timeframe?: string;
  style?: string;
  sort?: string;
  top?: string;
  corr?: string;
}

export default async function DashboardVitrineBovespaPage({
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

  // Filtra EXCLUSIVAMENTE símbolos de Mini Índice Bovespa B3
  const where: Record<string, unknown> = {
    status: "APPROVED",
    symbol: { in: ["WIN$", "WIN", "WINZ26", "WINFOOT", "WIN@"] },
  };

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

  let filteredEas = [...eas];

  return (
    <div className="min-h-screen bg-[#000] text-zinc-300">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header Exclusivo Bovespa */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end gap-4 justify-between border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xl">🇧🇷</span>
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h1 className="text-xl font-bold text-[#F5F5F5]">
                Vitrine Bovespa — Mini Índice (B3)
              </h1>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-400">
                MERCADO NACIONAL
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Estratégias exclusivas e revalidadas para o Mini Índice Bovespa (WIN$), operadas no MetaTrader 5 via XP Investimentos.
            </p>
          </div>
          <div className="text-right sm:text-left">
            <span className="text-xs font-semibold text-zinc-500">
              {filteredEas.length} {filteredEas.length === 1 ? "estratégia aprovada" : "estratégias aprovadas"} no Mini Índice
            </span>
          </div>
        </div>

        {/* Banner de aviso de assinatura */}
        {!canDownload && (
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-5 py-4">
            <p className="text-xs text-amber-300">
              <strong>Assinatura necessária para download.</strong> Você pode visualizar o desempenho de todos os robôs do Mini Índice, mas precisa de uma assinatura ativa para baixar os arquivos .ex5.{" "}
              <Link href="/billing" className="underline underline-offset-2 hover:text-amber-200">
                Ativar assinatura →
              </Link>
            </p>
          </div>
        )}

        {/* Filtros Simplificados */}
        <Suspense fallback={null}>
          <div className="mb-6">
            <EAFilters total={filteredEas.length} />
          </div>
        </Suspense>

        {/* Grid de EAs */}
        {filteredEas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
            <TrendingUp className="h-10 w-10 text-zinc-700 mb-4" />
            <h3 className="text-sm font-bold text-zinc-300 mb-1">
              Nenhuma estratégia encontrada com esses filtros.
            </h3>
            <p className="text-xs text-zinc-500 max-w-md">
              As estratégias de Mini Índice (WIN$) estão sendo atualizadas pelo motor de testes.
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
