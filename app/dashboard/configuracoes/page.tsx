import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { CreditCard, KeyRound, Mail, Shield, User } from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import { cn } from "@/lib/utils";
import { DeleteAccountButton } from "@/components/dashboard/SettingsActions";
import { ManageAccountButton } from "@/components/dashboard/ManageAccountButton";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const user = await getOrCreateUser();
  if (!user) return null;
  const clerkUser = await currentUser();

  const fullName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    "Usuário";
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? user.email;
  const createdAt = clerkUser?.createdAt
    ? new Date(clerkUser.createdAt)
    : user.createdAt;

  const status = user.subscriptionStatus;
  const isActive = status === "active" || status === "trialing";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Minha Conta</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Perfil, assinatura, segurança e zona de risco da conta.
        </p>
      </div>

      <div className="space-y-6">
        <Section icon={<User className="h-3.5 w-3.5" />} title="Perfil">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" value={fullName} />
            <Field label="Email" value={email} icon={<Mail className="h-3 w-3" />} />
            <Field
              label="Cliente desde"
              value={createdAt ? createdAt.toLocaleDateString("pt-BR") : "—"}
            />
            <Field label="ID interno" value={user.id} mono />
          </div>
        </Section>

        <Section
          icon={<CreditCard className="h-3.5 w-3.5" />}
          title="Assinatura"
          right={
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                isActive
                  ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/[0.08] text-rose-300",
              )}
            >
              {isActive ? "Ativa" : "Inativa"}
            </span>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plano" value="ZaionVest Pro" />
            <Field label="Status" value={statusText(status)} />
            <Field
              label="Próxima cobrança"
              value={
                user.currentPeriodEnd
                  ? new Date(user.currentPeriodEnd).toLocaleDateString("pt-BR")
                  : "—"
              }
            />
            <Field label="Pagamento" value="Cartão / Pix (Asaas)" />
          </div>
          <Link
            href="/billing"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.04] px-3 py-2 text-xs text-offwhite hover:bg-[#f5f5f5]/[0.08]"
          >
            Gerenciar assinatura
          </Link>
        </Section>

        <Section icon={<KeyRound className="h-3.5 w-3.5" />} title="Segurança">
          <p className="mb-3 text-xs text-zinc-400 leading-relaxed">
            Troque sua senha e gerencie os dados de login (e-mail, dispositivos) pelo
            painel seguro de conta.
          </p>
          <ManageAccountButton />
        </Section>

        <Section
          icon={<Shield className="h-3.5 w-3.5" />}
          title="Zona de risco"
          tone="rose"
        >
          <p className="mb-4 text-xs text-zinc-400">
            Exclusão da conta apaga permanentemente todos os seus dados do banco
            (análises, trades, sinais, watchlist). Não há como reverter.
          </p>
          <DeleteAccountButton />
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  right,
  tone = "default",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  tone?: "default" | "rose";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border p-5",
        tone === "rose"
          ? "border-rose-500/20 bg-rose-500/[0.02]"
          : "border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.015]",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500">
          {icon}
          {title}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 truncate text-sm text-offwhite",
          mono && "num text-xs text-zinc-300",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function statusText(status: string): string {
  switch (status) {
    case "active":
      return "Ativa";
    case "trialing":
      return "Em teste";
    case "past_due":
      return "Em atraso";
    case "canceled":
      return "Cancelada";
    case "inactive":
    default:
      return "Inativa";
  }
}
