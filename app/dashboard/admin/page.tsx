import { notFound } from "next/navigation";
import { Users, UserCheck, Clock, XCircle } from "lucide-react";
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
      return { label: "Em atraso", tone: "rose" };
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
    },
  });

  const total = users.length;
  const active = users.filter((u) => u.subscriptionStatus === "active").length;
  const trialing = users.filter((u) => u.subscriptionStatus === "trialing").length;
  const inactive = users.filter((u) =>
    ["inactive", "canceled", "past_due"].includes(u.subscriptionStatus),
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Assinantes</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Gestão de todas as assinaturas — cadastro, status e renovação. Visível só para o administrador.
        </p>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={<Users className="h-3.5 w-3.5" />} label="Total" value={total} tone="zinc" />
        <Kpi icon={<UserCheck className="h-3.5 w-3.5" />} label="Ativos" value={active} tone="emerald" />
        <Kpi icon={<Clock className="h-3.5 w-3.5" />} label="Em teste" value={trialing} tone="amber" />
        <Kpi icon={<XCircle className="h-3.5 w-3.5" />} label="Inativos" value={inactive} tone="rose" />
      </section>

      <div className="overflow-hidden rounded-xl border border-[#f0ddb0]/10">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.02] text-left text-[10px] uppercase tracking-widest text-zinc-500">
                <th className="px-4 py-3 font-medium">Assinante</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Cadastro</th>
                <th className="px-4 py-3 font-medium">Renovação / próxima cobrança</th>
                <th className="px-4 py-3 font-medium">Asaas</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const s = statusMeta(u.subscriptionStatus);
                return (
                  <tr key={u.id} className="border-b border-[#f0ddb0]/5 last:border-0 hover:bg-[#f0ddb0]/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-offwhite">{u.name || "—"}</div>
                      <div className="text-[11px] text-zinc-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                          s.tone === "emerald" && "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
                          s.tone === "amber" && "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
                          s.tone === "rose" && "border-rose-500/30 bg-rose-500/[0.08] text-rose-300",
                          s.tone === "zinc" && "border-[#f0ddb0]/15 bg-[#f0ddb0]/[0.04] text-zinc-400",
                        )}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 num text-zinc-300">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 num text-zinc-300">{fmtDate(u.currentPeriodEnd)}</td>
                    <td className="px-4 py-3">
                      {u.stripeCustomerId ? (
                        <span className="num text-[11px] text-zinc-400">{u.stripeCustomerId}</span>
                      ) : (
                        <span className="text-[11px] text-zinc-600">não gerado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-500">
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "zinc";
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "num mt-2 text-2xl font-medium",
          tone === "emerald" && "text-emerald-400",
          tone === "amber" && "text-amber-400",
          tone === "rose" && "text-rose-400",
          tone === "zinc" && "text-offwhite",
        )}
      >
        {value}
      </div>
    </div>
  );
}
