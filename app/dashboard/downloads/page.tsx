import Link from "next/link";
import { Download, RefreshCw, Bot, CheckCircle2, XCircle, Clock } from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Status de revalidação por EA (EA.status é atualizado pela revalidação mensal
// / kill-switch). APPROVED = ativo; REJECTED = reprovado (robô parado); PENDING
// = ainda em análise.
const STATUS = {
  APPROVED: {
    label: "Ativo na revalidação",
    hint: "Aprovado no último ciclo — pode operar normalmente.",
    icon: CheckCircle2,
    cls: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
  },
  REJECTED: {
    label: "Reprovado — pare o robô",
    hint: "Não passou na última revalidação. O kill-switch instrui o robô a parar de abrir novas ordens.",
    icon: XCircle,
    cls: "border-rose-500/30 bg-rose-500/[0.08] text-rose-300",
  },
  PENDING: {
    label: "Em análise",
    hint: "Aguardando o próximo ciclo de validação.",
    icon: Clock,
    cls: "border-zinc-500/30 bg-zinc-500/[0.08] text-zinc-300",
  },
} as const;

export default async function DownloadsPage() {
  const user = await getOrCreateUser();
  if (!user) return null;

  const downloads = await prisma.eADownload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      ea: {
        select: {
          id: true, name: true, slug: true, symbol: true, timeframe: true,
          status: true, lastValidatedAt: true, maxDrawdown: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Meus Downloads</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Os robôs que você baixou e o status de cada um na revalidação mensal.
          Um robô reprovado é desligado automaticamente pelo kill-switch no seu MetaTrader.
        </p>
      </div>

      {downloads.length === 0 ? (
        <div className="rounded-2xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.015] p-10 text-center">
          <Bot className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-4 text-sm text-zinc-400">
            Você ainda não baixou nenhum robô.
          </p>
          <Link
            href="/dashboard/vitrine"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1D4ED8]"
          >
            Explorar a vitrine <Download className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((d) => {
            const st = STATUS[(d.ea.status as keyof typeof STATUS)] ?? STATUS.PENDING;
            const StatusIcon = st.icon;
            const active = d.ea.status === "APPROVED";
            return (
              <div
                key={d.id}
                className="rounded-xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.015] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-[#2563EB]" />
                      <h2 className="truncate text-sm font-semibold text-offwhite">{d.ea.name}</h2>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 num">
                      {d.ea.symbol} · {d.ea.timeframe}
                      {d.ea.maxDrawdown != null && <> · DD real {d.ea.maxDrawdown.toFixed(1)}%</>}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      Baixado em {d.createdAt.toLocaleDateString("pt-BR")}
                      {d.ea.lastValidatedAt && (
                        <> · Revalidado em {new Date(d.ea.lastValidatedAt).toLocaleDateString("pt-BR")}</>
                      )}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest",
                      st.cls,
                    )}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {st.label}
                  </span>
                </div>

                <p className="mt-3 text-[11px] text-zinc-500 leading-relaxed">{st.hint}</p>

                <div className="mt-4 flex gap-2 border-t border-[#f5f5f5]/[0.04] pt-3">
                  <Link
                    href={`/dashboard/vitrine/${d.ea.slug}`}
                    className="rounded-lg border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.03] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-[#f5f5f5]/[0.07]"
                  >
                    Ver detalhes
                  </Link>
                  {active && (
                    <a
                      href={`/api/ea/${d.ea.id}/download`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1D4ED8]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Baixar novamente
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
