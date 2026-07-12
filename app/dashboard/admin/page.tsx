import { notFound } from "next/navigation";
import { Users, UserCheck, Clock, ShieldAlert, Download, DollarSign, Activity } from "lucide-react";
import { getOrCreateUser, isOwner } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statusMeta(status: string): { label: string; tone: "emerald" | "amber" | "rose" | "zinc" } {
  switch (status) {
    case "active":
      return { label: "Ativa", tone: "emerald" };
    case "trialing":
      return { label: "Em teste", tone: "amber" };
    case "past_due":
      return { label: "Atrasada", tone: "rose" };
    case "canceled":
      return { label: "Cancelada", tone: "rose" };
    default:
      return { label: "Inativa", tone: "zinc" };
  }
}

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export default async function AdminPage() {
  const me = await getOrCreateUser();
  if (!me || !isOwner(me)) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      createdAt: true,
      stripeCustomerId: true,
      eaDownloads: {
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      },
    },
  });

  const total = users.length;
  const active = users.filter((u) => u.subscriptionStatus === "active").length;
  const trialing = users.filter((u) => u.subscriptionStatus === "trialing").length;
  const canceled = users.filter((u) => u.subscriptionStatus === "canceled").length;
  const inactive = users.filter((u) =>
    ["inactive", "canceled", "past_due"].includes(u.subscriptionStatus),
  ).length;

  // KPIs SaaS
  const TICKET_MEDIO = 149.90; // ticket mensal padrão da ZaionVest
  const mrr = active * TICKET_MEDIO;
  
  // Taxa de Churn baseada em usuários ativos + cancelados históricos
  const totalSubscribersEver = active + canceled;
  const churnRate = totalSubscribersEver > 0 ? (canceled / totalSubscribersEver) * 100 : 0.0;
  
  // LTV Estimado = Ticket / Churn (usamos Churn mínimo de 8.5% se for zero para evitar divisão por 0)
  const effectiveChurn = churnRate > 0 ? churnRate / 100 : 0.085;
  const ltv = TICKET_MEDIO / effectiveChurn;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-zinc-300">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          Admin — Painel de Assinaturas
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          KPIs financeiras, engajamento dos clientes e gestão de acessos. Visível apenas para administradores.
        </p>
      </div>

      {/* Grid de KPIs SaaS */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi 
          icon={<DollarSign className="h-4 w-4 text-[#DC1F2E]" />} 
          label="MRR (Assinaturas Ativas)" 
          value={`R$ ${mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          tone="emerald" 
          detail={`Ticket: R$ ${TICKET_MEDIO.toFixed(2)}`}
        />
        <Kpi 
          icon={<Activity className="h-4 w-4 text-emerald-400" />} 
          label="LTV Estimado" 
          value={`R$ ${ltv.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          tone="zinc"
          detail={churnRate > 0 ? `Com base no Churn de ${churnRate.toFixed(1)}%` : "Com base no Churn padrão (8.5%)"}
        />
        <Kpi 
          icon={<ShieldAlert className="h-4 w-4 text-rose-400" />} 
          label="Taxa de Churn" 
          value={`${churnRate.toFixed(1)}%`} 
          tone="rose"
          detail={`${canceled} cancelamentos históricos`}
        />
        <Kpi 
          icon={<Clock className="h-4 w-4 text-amber-400" />} 
          label="Trial Ativos" 
          value={trialing} 
          tone="amber"
          detail={`${inactive} assinaturas expiradas`}
        />
      </section>

      {/* Grid de Stats de Clientes */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiMini label="Total de Contas" value={total} />
        <KpiMini label="Assinantes Ativos" value={active} />
        <KpiMini label="Em Período de Teste" value={trialing} />
        <KpiMini label="Cancelados/Inativos" value={inactive} />
      </section>

      {/* Tabela Principal */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0A0A0A]">
        <div className="px-4 py-3 border-b border-white/5 bg-white/[0.01]">
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
            Histórico e Engajamento dos Assinantes
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-left text-[10px] uppercase tracking-widest text-zinc-500">
                <th className="px-4 py-3 font-medium">Assinante</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-center">Cadastro</th>
                <th className="px-4 py-3 font-medium text-center">Próxima Cobrança</th>
                <th className="px-4 py-3 font-medium text-center">Downloads (EAs)</th>
                <th className="px-4 py-3 font-medium text-right">Último Download</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const s = statusMeta(u.subscriptionStatus);
                const totalDownloads = u.eaDownloads.length;
                const lastDownload = totalDownloads > 0 ? u.eaDownloads[0].createdAt : null;

                return (
                  <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{u.name || "—"}</div>
                      <div className="text-[10px] text-zinc-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold",
                          s.tone === "emerald" && "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
                          s.tone === "amber" && "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
                          s.tone === "rose" && "border-rose-500/30 bg-rose-500/[0.08] text-rose-300",
                          s.tone === "zinc" && "border-white/15 bg-white/[0.04] text-zinc-400",
                        )}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-400 font-mono">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-center text-zinc-400 font-mono">{fmtDate(u.currentPeriodEnd)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-zinc-300 font-bold font-mono">
                        <Download className="h-3 w-3 text-zinc-500" />
                        {totalDownloads}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 font-mono text-[10px]">
                      {lastDownload ? fmtDate(lastDownload) : "nunca baixou"}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-zinc-500">
                    Nenhum assinante cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "emerald" | "amber" | "rose" | "zinc";
  detail?: string;
}) {
  return (
    <div className="glass rounded-xl p-4 border border-white/5 bg-[#050505] flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-zinc-500">
          {icon}
          {label}
        </div>
        <div
          className={cn(
            "mt-2 text-2xl font-bold font-mono",
            tone === "emerald" && "text-emerald-400",
            tone === "amber" && "text-amber-400",
            tone === "rose" && "text-rose-400",
            tone === "zinc" && "text-white",
          )}
        >
          {value}
        </div>
      </div>
      {detail && <div className="mt-3 text-[10px] text-zinc-600 font-medium">{detail}</div>}
    </div>
  );
}

function KpiMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-[#0A0A0A] px-4 py-3">
      <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-xl font-bold font-mono text-white mt-1">{value}</p>
    </div>
  );
}
