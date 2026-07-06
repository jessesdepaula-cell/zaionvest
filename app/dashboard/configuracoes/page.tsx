import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { Activity, CreditCard, Mail, Shield, User } from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import { cn } from "@/lib/utils";
import { DeleteAccountButton } from "@/components/dashboard/SettingsActions";

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
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Perfil, assinatura, exportações e zona de risco da conta.
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
            <Field label="Plano" value="Trade Vision Pro" />
            <Field label="Status" value={statusText(status)} />
            <Field
              label="Próxima cobrança"
              value={
                user.currentPeriodEnd
                  ? new Date(user.currentPeriodEnd).toLocaleDateString("pt-BR")
                  : "—"
              }
            />
            <Field
              label="Modo"
              value={process.env.STRIPE_MOCK === "true" ? "MVP (mock)" : "Stripe"}
            />
          </div>
          {process.env.STRIPE_MOCK !== "true" && (
            <Link
              href="/billing"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-offwhite hover:bg-white/[0.08]"
            >
              Gerenciar assinatura
            </Link>
          )}
        </Section>

        <Section icon={<Activity className="h-3.5 w-3.5" />} title="Notificações de sinal">
          {/* E-mail de alertas */}
          <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.03] p-3 mb-3">
            <div className="flex items-start gap-2.5">
              <Mail className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-emerald-300">Alertas por e-mail ativados</p>
                <p className="mt-0.5 text-[11px] text-zinc-400 leading-relaxed">
                  Quando a IA detectar um setup de alta probabilidade, você receberá automaticamente um e-mail com{" "}
                  <span className="text-zinc-300">Entrada, Stop Loss, Alvos e análise estrutural</span> para:
                </p>
                <p className="mt-1.5 rounded bg-white/[0.04] border border-white/10 px-2 py-1 text-xs font-mono text-offwhite">
                  {email}
                </p>
                <p className="mt-1.5 text-[10px] text-zinc-500">
                  Este é o e-mail cadastrado na sua conta. Para alterar, atualize pelo perfil do Clerk.
                </p>
              </div>
            </div>
          </div>
          {/* Notificações do navegador */}
          <p className="text-xs text-zinc-400">
            As preferências de notificação do navegador (som, alerta visual) ficam na página{" "}
            <Link
              href="/dashboard/sinais"
              className="text-emerald-400 underline-offset-2 hover:underline"
            >
              Sinais ao vivo
            </Link>
            .
          </p>
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
          : "border-white/10 bg-white/[0.015]",
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
    <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
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
