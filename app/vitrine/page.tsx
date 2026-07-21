import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { EACard } from "@/components/vitrine/EACard";
import { EAFilters } from "@/components/vitrine/EAFilters";
import { PortfolioSection } from "@/components/vitrine/PortfolioSection";
import {
  greedyDiversified,
  buildPortfolios,
  type CorrelatableEA,
  type EquityPoint,
} from "@/lib/correlation";
import { Suspense } from "react";
import { Bot, ArrowRight } from "lucide-react";

export const revalidate = 300;

export const metadata = {
  title: "Vitrine de EAs — ZaionVest | Expert Advisors Validados",
  description:
    "Vitrine de Expert Advisors validados para MetaTrader 5. Cada robô é revalidado todo mês, com kill-switch remoto e drawdown real e transparente.",
};

interface SearchParams {
  symbol?: string;
  timeframe?: string;
  style?: string;
  sort?: string;
  top?: string;   // "25" → só o TOP 25% pela métrica de ordenação
  corr?: string;  // correlação máxima (0..1); < 1 aplica filtro de diversificação
}

const EA_SELECT = {
  id: true,
  slug: true,
  name: true,
  symbol: true,
  timeframe: true,
  style: true,
  exitMode: true,
  status: true,
  wfe: true,
  profitFactor: true,
  maxDrawdown: true,
  totalTrades: true,
  oosWins: true,
  oosTotalWindows: true,
  equityCurveOos: true,
  strategyDef: true,
} as const;

/** Normaliza o campo Json equityCurveOos pro tipo usado na correlação. */
function withCurve<T extends { equityCurveOos: unknown }>(e: T) {
  return { ...e, equityCurveOos: e.equityCurveOos as EquityPoint[] | null };
}

async function getEAs(params: SearchParams) {
  const where: Record<string, unknown> = { status: "APPROVED" };
  if (params.symbol) where.symbol = params.symbol;
  if (params.timeframe) where.timeframe = params.timeframe;
  if (params.style) where.style = params.style;

  const orderBy: Record<string, string>[] = [];
  switch (params.sort ?? "wfe_desc") {
    case "pf_desc":
      orderBy.push({ profitFactor: "desc" });
      break;
    case "dd_asc":
      orderBy.push({ maxDrawdown: "asc" });
      break;
    case "newest":
      orderBy.push({ createdAt: "desc" });
      break;
    default:
      orderBy.push({ wfe: "desc" });
  }

  let eas = (await prisma.eA.findMany({ where, orderBy, select: EA_SELECT })).map(withCurve);

  // TOP 25% pela métrica de ordenação (a lista já vem ordenada).
  if (params.top === "25" && eas.length > 0) {
    eas = eas.slice(0, Math.max(1, Math.ceil(eas.length * 0.25)));
  }

  // Filtro de correlação: esconde EAs muito parecidos (mantém os melhores).
  const corr = params.corr ? parseFloat(params.corr) : 1;
  if (corr < 1) {
    eas = greedyDiversified(eas as unknown as (typeof eas[number] & CorrelatableEA)[], corr);
  }

  return eas;
}

/** Portfólios prontos a partir de TODOS os EAs aprovados (ignora filtros da grade). */
async function getPortfolios() {
  const all = (await prisma.eA.findMany({
    where: { status: "APPROVED" },
    select: EA_SELECT,
  })).map(withCurve);
  return buildPortfolios(all as unknown as (typeof all[number] & CorrelatableEA)[]);
}

export default async function VitrinePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [eas, portfolios] = await Promise.all([getEAs(params), getPortfolios()]);

  return (
    <main className="min-h-screen bg-[#000000] text-zinc-300">
      {/* Header */}
      <header className="border-b border-[#f5f5f5]/5 bg-[#000]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="ZaionVest"
              width={785}
              height={145}
              priority
              className="h-7 w-auto"
              style={{ mixBlendMode: "lighten" }}
            />
          </Link>
          <nav className="flex items-center gap-3 text-xs">
            <Link
              href="/sign-in"
              className="text-zinc-400 hover:text-zinc-200 transition"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white transition hover:bg-[#1D4ED8]"
            >
              Área de Membros
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Hero da vitrine */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2563EB]/30 bg-[#2563EB]/[0.06] px-3.5 py-1.5 text-xs text-[#2563EB] font-medium mb-4">
            <Bot className="h-3.5 w-3.5" />
            Robôs validados e revalidados
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#F5F5F5] mb-3">
            Vitrine de Expert Advisors
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl">
            Cada robô passa por uma validação de robustez antes de entrar na
            vitrine e é <strong className="text-zinc-200">revalidado todo mês</strong>{" "}
            com dados novos de mercado. O que degrada é retirado e desligado pelo
            kill-switch. Só os aprovados aparecem aqui — com o{" "}
            <strong className="text-zinc-200">drawdown real</strong>, sem maquiagem.
          </p>

          {/* CTA para assinar */}
          <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/[0.04] px-5 py-3">
            <span className="text-xs text-zinc-400">
              Faça download dos .ex5 com uma assinatura ativa
            </span>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D4ED8] transition"
            >
              Assinar agora <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Portfólios prontos */}
        <PortfolioSection portfolios={portfolios} />

        {/* Filtros */}
        <Suspense fallback={null}>
          <div className="mb-6">
            <EAFilters total={eas.length} />
          </div>
        </Suspense>

        {/* Grid de EAs */}
        {eas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Bot className="h-12 w-12 text-zinc-700 mb-4" />
            <p className="text-zinc-500 text-sm">
              Nenhuma estratégia aprovada{" "}
              {params.symbol || params.timeframe || params.style
                ? "com esses filtros"
                : "no momento"}
              .
            </p>
            <p className="text-zinc-700 text-xs mt-2">
              O motor de revalidação roda continuamente — novas estratégias são
              publicadas regularmente.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eas.map((ea) => (
              <EACard
                key={ea.id}
                {...ea}
                status={ea.status as "APPROVED" | "REJECTED" | "PENDING"}
                equityCurveOos={
                  ea.equityCurveOos as
                    | Array<{ date: string; value: number }>
                    | null
                }
                canDownload={false} // página pública: sempre false
                detailHref={`/vitrine/${ea.slug}`}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
