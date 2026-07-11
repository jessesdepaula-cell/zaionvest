import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ValidateButton } from "@/components/vitrine/ValidateButton";
import { Bot, Plus, Download, Users } from "lucide-react";
import Link from "next/link";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "jessesdepaula@gmail.com";

const STATUS_COLORS = {
  APPROVED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  REJECTED: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  PENDING: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export const metadata = { title: "Admin — EAs | ZaionVest" };

export default async function AdminEAsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (email !== OWNER_EMAIL) redirect("/dashboard");

  const eas = await prisma.eA.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { downloads: true, validations: true } },
      validations: { orderBy: { validatedAt: "desc" }, take: 1 },
    },
  });

  const stats = {
    total: eas.length,
    approved: eas.filter((e) => e.status === "APPROVED").length,
    rejected: eas.filter((e) => e.status === "REJECTED").length,
    pending: eas.filter((e) => e.status === "PENDING").length,
    totalDownloads: eas.reduce((acc, e) => acc + e._count.downloads, 0),
  };

  return (
    <div className="min-h-screen bg-[#000] text-zinc-300">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-5 w-5 text-[#2563EB]" />
              <h1 className="text-xl font-bold text-[#F5F5F5]">
                Admin — Vitrine de EAs
              </h1>
            </div>
            <p className="text-xs text-zinc-500">
              Gerencie, cadastre e revalide Expert Advisors
            </p>
          </div>
          <Link
            href="/dashboard/admin/eas/novo"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8] transition"
          >
            <Plus className="h-4 w-4" />
            Cadastrar EA
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Total", value: stats.total, color: "text-zinc-300" },
            { label: "Aprovados", value: stats.approved, color: "text-emerald-400" },
            { label: "Reprovados", value: stats.rejected, color: "text-rose-400" },
            { label: "Pendentes", value: stats.pending, color: "text-amber-400" },
            { label: "Downloads", value: stats.totalDownloads, color: "text-[#2563EB]" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[#f5f5f5]/8 bg-[#0A0A0A] px-4 py-3"
            >
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                {s.label}
              </p>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Tabela de EAs */}
        <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0A0A0A] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f5f5f5]/[0.05]">
            <h2 className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider">
              Expert Advisors
            </h2>
          </div>

          {eas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="h-10 w-10 text-zinc-700 mb-4" />
              <p className="text-sm text-zinc-500">Nenhum EA cadastrado ainda.</p>
              <Link
                href="/dashboard/admin/eas/novo"
                className="mt-4 text-xs text-[#2563EB] hover:underline"
              >
                Cadastrar o primeiro EA →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#f5f5f5]/[0.04] text-zinc-500 text-[10px] uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left">EA</th>
                    <th className="px-4 py-2.5 text-left">Par / TF</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">WFE</th>
                    <th className="px-4 py-2.5 text-right">Downloads</th>
                    <th className="px-4 py-2.5 text-right">Última Validação</th>
                    <th className="px-4 py-2.5 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {eas.map((ea) => {
                    const statusColor =
                      STATUS_COLORS[ea.status as keyof typeof STATUS_COLORS] ??
                      STATUS_COLORS.PENDING;
                    const lastVal = ea.validations[0];

                    return (
                      <tr
                        key={ea.id}
                        className="border-b border-[#f5f5f5]/[0.03] hover:bg-[#f5f5f5]/[0.01] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/vitrine/${ea.slug}`}
                            className="font-medium text-zinc-200 hover:text-[#F5F5F5] transition"
                          >
                            {ea.name}
                          </Link>
                          <p className="text-[10px] text-zinc-600 font-mono capitalize">
                            {ea.style} · {ea.exitMode === "reversal" ? "Modo A" : "Modo B"}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400">
                          {ea.symbol} / {ea.timeframe}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusColor}`}
                          >
                            {ea.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {ea.wfe != null ? (
                            <span
                              className={
                                ea.wfe > 50 ? "text-emerald-400" : "text-rose-400"
                              }
                            >
                              {ea.wfe.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 text-zinc-400">
                            <Download className="h-3 w-3" />
                            {ea._count.downloads}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600 text-[10px]">
                          {lastVal
                            ? new Date(lastVal.validatedAt).toLocaleDateString(
                                "pt-BR"
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ValidateButton eaId={ea.id} eaName={ea.name} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
