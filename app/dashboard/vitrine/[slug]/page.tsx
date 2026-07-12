import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { EACard } from "@/components/vitrine/EACard";
import { ChevronLeft, History, ShieldCheck, RefreshCw, Power } from "lucide-react";
import Link from "next/link";

export const revalidate = 300;

export default async function EADetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, subscriptionStatus: true },
  });
  if (!user) redirect("/sign-in");

  const canDownload =
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "trialing";

  const ea = await prisma.eA.findUnique({
    where: { slug },
    include: {
      validations: {
        orderBy: { validatedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!ea) notFound();

  const latestValidation = ea.validations[0] ?? null;

  // Capital mínimo recomendado por perfil de risco. O robô é calibrado para
  // uma base de US$ 10.000 (lote padrão embutido). Como a perda máxima em $ é
  // fixa para esse lote, o capital que mantém o drawdown dentro da tolerância
  // de cada perfil é: capital = perdaMax$ / tolerância. Arredondado p/ cima.
  const ddPct = ea.maxDrawdown ?? 0;
  const roundUp = (v: number) => Math.ceil(v / 100) * 100;
  const capital =
    ddPct > 0
      ? {
          conservador: roundUp(ddPct * 500), // tolera DD até ~20%
          moderado: roundUp(ddPct * 250), //    ~40%
          agressivo: roundUp((ddPct * 10000) / 60), // ~60%
        }
      : null;
  const brl = (v: number) => v.toLocaleString("pt-BR");

  return (
    <div className="min-h-screen bg-[#000] text-zinc-300">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Breadcrumb */}
        <Link
          href="/dashboard/vitrine"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition mb-6"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar à vitrine
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Coluna principal */}
          <div className="flex flex-col gap-6">
            {/* Header do EA */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-zinc-600 uppercase tracking-wider">
                  {ea.symbol} · {ea.timeframe}
                </span>
                <span className="text-xs text-zinc-700">·</span>
                <span className="text-xs text-zinc-600 capitalize">{ea.style}</span>
              </div>
              <h1 className="text-2xl font-bold text-[#F5F5F5]">{ea.name}</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Modo de saída:{" "}
                {ea.exitMode === "reversal"
                  ? "Stop & Reversão (Modo A)"
                  : "SL/TP Fixos (Modo B)"}
              </p>
            </div>

            {/* Validação (resumo — sem expor a metodologia) */}
            <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0A0A0A] p-6">
              <h3 className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider mb-4">
                Validação
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Aprovado na nossa validação de robustez antes de entrar na vitrine.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <RefreshCw className="h-4 w-4 shrink-0 mt-0.5 text-[#2563EB]" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Revalidado todo mês com dados novos de mercado.
                    {latestValidation && (
                      <>
                        {" "}Última revalidação em{" "}
                        <strong className="text-zinc-200">
                          {new Date(latestValidation.validatedAt).toLocaleDateString("pt-BR")}
                        </strong>
                        {" "}—{" "}
                        <span className={latestValidation.approved ? "text-emerald-400" : "text-rose-400"}>
                          {latestValidation.approved ? "aprovado" : "reprovado"}
                        </span>.
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Power className="h-4 w-4 shrink-0 mt-0.5 text-zinc-400" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Se deixar de cumprir os critérios, o kill-switch o desativa
                    automaticamente no seu MetaTrader.
                  </p>
                </div>
              </div>
            </div>

            {/* Histórico de revalidações */}
            {ea.validations.length > 0 && (
              <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0A0A0A] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f5f5f5]/[0.05] flex items-center gap-2">
                  <History className="h-4 w-4 text-zinc-600" />
                  <h3 className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider">
                    Histórico de Revalidações
                  </h3>
                </div>
                <div className="divide-y divide-[#f5f5f5]/[0.03]">
                  {ea.validations.map((v, i) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            v.approved ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                        />
                        <div>
                          <p className="text-xs text-zinc-300">
                            {v.approved ? "Aprovado" : "Reprovado"}
                          </p>
                          <p className="text-[10px] text-zinc-600">
                            {new Date(v.validatedAt).toLocaleDateString(
                              "pt-BR",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                      {i === 0 && (
                        <span className="ml-auto rounded-full bg-[#f5f5f5]/5 border border-[#f5f5f5]/10 px-2 py-0.5 text-[9px] text-zinc-500">
                          Mais recente
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar com card e download */}
          <div className="flex flex-col gap-4">
            <EACard
              id={ea.id}
              slug={ea.slug}
              name={ea.name}
              symbol={ea.symbol}
              timeframe={ea.timeframe}
              style={ea.style}
              exitMode={ea.exitMode}
              status={ea.status as "APPROVED" | "REJECTED" | "PENDING"}
              wfe={ea.wfe}
              profitFactor={ea.profitFactor}
              maxDrawdown={ea.maxDrawdown}
              totalTrades={ea.totalTrades}
              oosWins={ea.oosWins}
              oosTotalWindows={ea.oosTotalWindows}
              equityCurveOos={
                ea.equityCurveOos as
                  | Array<{ date: string; value: number }>
                  | null
              }
              canDownload={canDownload}
            />

            {/* Capital recomendado */}
            {capital && (
              <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0A0A0A] p-4">
                <h4 className="text-xs font-semibold text-[#F5F5F5] mb-1">
                  Capital recomendado
                </h4>
                <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">
                  Para o lote padrão do robô, por perfil de risco — quanto mais
                  capital, menor o drawdown relativo na sua conta.
                </p>
                <div className="space-y-1.5">
                  {[
                    { k: "Conservador", v: capital.conservador, t: "DD ~20%" },
                    { k: "Moderado", v: capital.moderado, t: "DD ~40%" },
                    { k: "Agressivo", v: capital.agressivo, t: "DD ~60%" },
                  ].map((r) => (
                    <div
                      key={r.k}
                      className="flex items-center justify-between rounded-lg border border-[#f5f5f5]/[0.06] bg-[#f5f5f5]/[0.02] px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-300">{r.k}</span>
                        <span className="text-[9px] text-zinc-600">{r.t}</span>
                      </div>
                      <span className="num text-sm font-semibold text-[#F5F5F5]">
                        US$ {brl(r.v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instrução de uso */}
            {ea.status === "APPROVED" && (
              <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0A0A0A] p-4">
                <h4 className="text-xs font-semibold text-[#F5F5F5] mb-3">
                  Como usar este EA
                </h4>
                <ol className="space-y-2 text-[11px] text-zinc-500">
                  <li className="flex gap-2">
                    <span className="font-mono text-[#2563EB]">01.</span>
                    Baixe o arquivo <code className="text-zinc-300">.ex5</code>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-[#2563EB]">02.</span>
                    Copie para{" "}
                    <code className="text-zinc-300">
                      MQL5/Experts/
                    </code>{" "}
                    no MT5
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-[#2563EB]">03.</span>
                    Abra o gráfico <strong className="text-zinc-300">{ea.symbol}</strong>{" "}
                    no timeframe <strong className="text-zinc-300">{ea.timeframe}</strong>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-[#2563EB]">04.</span>
                    Arraste o EA para o chart e configure o lote
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-[#2563EB]">05.</span>
                    O EA verifica revalidação automaticamente a cada 30 min
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
