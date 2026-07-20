import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "jessesdepaula@gmail.com";
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
    select: { id: true, subscriptionStatus: true, email: true },
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

  const isOwner = user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

  // Staging: EAs que não estão APPROVED (STAGED/REJECTED/PENDING) não são
  // públicos. Só o dono os vê — pra revisar antes de promover no admin.
  if (ea.status !== "APPROVED") {
    if (!isOwner) notFound();
  }

  const latestValidation = ea.validations[0] ?? null;

  // Capital recomendado (Perfil Bem Conservador).
  // Calibrado de forma bem conservadora para manter o drawdown máximo estimado
  // em cerca de 5% a 8% do saldo total da conta.
  const ddPct = ea.maxDrawdown ?? 0;
  const TARGET_CONSERVATIVE_DD = 5; // 5% de drawdown máx no perfil conservador
  const capitalRec =
    ddPct > 0
      ? Math.max(500, Math.ceil(((ddPct / TARGET_CONSERVATIVE_DD) * 1000) / 250) * 250)
      : 1000;
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
                Métricas calculadas sobre histórico de testes Out-of-Sample de{" "}
                <strong className="text-zinc-300">6 anos</strong> de mercado.
              </p>
            </div>

            {/* Validação (resumo — sem expor a metodologia) */}
            <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0A0A0A] p-6">
              <h3 className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider mb-4">
                Validação de Robustez
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Aprovado na nossa esteira rigorosa de robustez antes de entrar na vitrine. Este robô passou nos testes de holdout <strong>Out-of-Sample (OOS) cego</strong>, análise de avanço recursivo (WFA) e estresse estatístico de Monte Carlo.
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
                        <span className={latestValidation.approved ? "text-blue-400 font-bold" : "text-zinc-500"}>
                          {latestValidation.approved ? "aprovado na robustez" : "reprovado"}
                        </span>.
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Power className="h-4 w-4 shrink-0 mt-0.5 text-zinc-400" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Se deixar de cumprir os critérios de robustez em dados novos de mercado, o kill-switch o desativa automaticamente no MetaTrader do cliente para proteção de capital.
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
                    Histórico de Revalidações Mensais
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
            {capitalRec && (
              <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0A0A0A] p-4">
                <h4 className="text-xs font-semibold text-[#F5F5F5] mb-1">
                  Capital Recomendado (Perfil Conservador)
                </h4>
                <div className="flex items-baseline gap-1.5 mt-2 mb-2">
                  <span className="num text-2xl font-extrabold text-[#F5F5F5]">
                    US$ {brl(capitalRec)}
                  </span>
                  <span className="text-[10px] text-zinc-500">mínimo recomendado</span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Calculado para um perfil <strong className="text-zinc-300">bem conservador</strong> de gestão de risco, visando limitar o drawdown máximo estimado a aproximadamente <strong className="text-zinc-300">5% da conta</strong> (drawdown máximo histórico do robô: <strong className="text-zinc-300">{ddPct.toFixed(1)}%</strong>).
                </p>
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

// ─── Parser Manual de Markdown para Exibição Técnica ──────────────────────────

function parseMarkdown(md: string) {
  return md
    .split("\n")
    .map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;

      // Cabeçalho Principal (##)
      if (trimmed.startsWith("## ")) {
        return (
          <h4 key={idx} className="text-xs font-bold text-[#F5F5F5] mt-6 mb-3 border-b border-[#f5f5f5]/10 pb-2 uppercase tracking-wide">
            {trimmed.replace("## ", "")}
          </h4>
        );
      }

      // Sub-cabeçalho (###)
      if (trimmed.startsWith("### ")) {
        return (
          <h5 key={idx} className="text-xs font-semibold text-[#2563EB] mt-4 mb-2">
            {trimmed.replace("### ", "")}
          </h5>
        );
      }

      // Linha de Tabela Markdown (| ... |)
      if (trimmed.startsWith("|")) {
        // Ignora separadores de tabela como | :--- | ---: |
        if (trimmed.includes("---")) return null;

        const cols = trimmed
          .split("|")
          .map(c => c.trim())
          .filter((_, i, arr) => i > 0 && i < arr.length - 1); // remove bordas vazias

        return (
          <div key={idx} className="grid grid-cols-4 gap-2 text-[10px] font-mono py-1.5 px-3 bg-zinc-950/30 border-b border-[#f5f5f5]/5 items-center">
            {cols.map((col, cIdx) => (
              <span key={cIdx} className={`${cIdx === 0 ? "text-zinc-400 font-sans text-left" : "text-zinc-200 text-center"} ${col.includes("✅") ? "text-emerald-400 font-bold" : ""} ${col.includes("❌") ? "text-rose-400 font-bold" : ""}`}>
                {col}
              </span>
            ))}
          </div>
        );
      }

      // Marcadores (- ou *)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const text = trimmed.replace(/^[-*]\s+/, "");
        
        // Verifica se é uma linha de checklist com ícone ✅ ou ❌
        const isCheck = text.includes("✅") || text.includes("❌");

        return (
          <div key={idx} className="flex items-start gap-2 text-xs text-zinc-400 py-1 pl-2">
            {!isCheck && <span className="text-[#2563EB] mt-0.5">•</span>}
            <span className="leading-relaxed">{text}</span>
          </div>
        );
      }

      // Parágrafo Normal
      return (
        <p key={idx} className="text-xs text-zinc-400 leading-relaxed mb-2">
          {trimmed}
        </p>
      );
    })
    .filter(Boolean); // remove itens nulos
}

