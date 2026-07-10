import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EACard } from "@/components/vitrine/EACard";
import { EAFilters } from "@/components/vitrine/EAFilters";
import { Suspense } from "react";
import { Bot, Package } from "lucide-react";
import Link from "next/link";

export const revalidate = 120;

export const metadata = {
  title: "Vitrine de EAs — ZaionVest",
};

interface SearchParams {
  symbol?: string;
  timeframe?: string;
  style?: string;
  sort?: string;
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

  const where: Record<string, unknown> = { status: "APPROVED" };
  if (params.symbol) where.symbol = params.symbol;
  if (params.timeframe) where.timeframe = params.timeframe;
  if (params.style) where.style = params.style;

  const orderBy: Record<string, string>[] = [];
  switch (params.sort ?? "wfe_desc") {
    case "pf_desc": orderBy.push({ profitFactor: "desc" }); break;
    case "dd_asc": orderBy.push({ maxDrawdown: "asc" }); break;
    case "newest": orderBy.push({ createdAt: "desc" }); break;
    default: orderBy.push({ wfe: "desc" });
  }

  const eas = await prisma.eA.findMany({
    where,
    orderBy,
    select: {
      id: true, slug: true, name: true, symbol: true, timeframe: true,
      style: true, exitMode: true, status: true, wfe: true,
      profitFactor: true, maxDrawdown: true, totalTrades: true,
      oosWins: true, oosTotalWindows: true, equityCurveOos: true,
    },
  });

  return (
    <div className="min-h-screen bg-[#000] text-zinc-300">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-5 w-5 text-[#DC1F2E]" />
              <h1 className="text-xl font-bold text-[#F5F5F5]">
                Vitrine de EAs
              </h1>
            </div>
            <p className="text-xs text-zinc-500">
              {eas.length} estratégi{eas.length === 1 ? "a aprovada" : "as aprovadas"}{" "}
              pela esteira DQ Labs ·{" "}
              {downloadedIds.size > 0
                ? `${downloadedIds.size} baixad${downloadedIds.size === 1 ? "a" : "as"} por você`
                : "nenhuma baixada ainda"}
            </p>
          </div>

          {/* Link para download em pacote */}
          <Link
            href="/dashboard/vitrine/portfolio"
            className="inline-flex items-center gap-2 rounded-xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.03] px-4 py-2.5 text-xs font-medium text-zinc-300 hover:bg-[#f5f5f5]/[0.07] transition"
          >
            <Package className="h-4 w-4" />
            Baixar Portfolio (.zip)
          </Link>
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

        {/* Filtros */}
        <Suspense fallback={null}>
          <div className="mb-6">
            <EAFilters total={eas.length} />
          </div>
        </Suspense>

        {/* Grid */}
        {eas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bot className="h-10 w-10 text-zinc-700 mb-4" />
            <p className="text-sm text-zinc-500">
              Nenhuma estratégia aprovada com esses filtros.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eas.map((ea) => (
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
