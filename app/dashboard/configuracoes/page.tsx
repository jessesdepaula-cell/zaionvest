import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { Activity, CreditCard, Database, Eye, Mail, Shield, User, Key } from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import {
  DeleteAccountButton,
  ExportButton,
} from "@/components/dashboard/SettingsActions";
import { APIKeysForm } from "@/components/dashboard/APIKeysForm";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const user = await getOrCreateUser();
  if (!user) return null;
  const clerkUser = await currentUser();

  const [tradeCount, signalCount, analysisCount, watchlistCount] = await Promise.all([
    prisma.trade.count({ where: { userId: user.id } }),
    prisma.signal.count({ where: { userId: user.id } }),
    prisma.analysis.count({ where: { userId: user.id } }),
    prisma.watchlist.count({ where: { userId: user.id } }),
  ]);

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

        <Section icon={<Key className="h-3.5 w-3.5" />} title="Configuração de IA (Chaves de API)">
          <APIKeysForm
            initialGeminiKey={user.geminiApiKey ?? ""}
            initialOpenAIKey={user.openaiApiKey ?? ""}
          />
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

        <Section icon={<Database className="h-3.5 w-3.5" />} title="Seus dados">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DataCount label="Análises" value={analysisCount} />
            <DataCount label="Trades" value={tradeCount} />
            <DataCount label="Sinais" value={signalCount} />
            <DataCount label="Watchlist" value={watchlistCount} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <ExportButton href="/api/export/trades" label="Exportar diário de trades" />
            <ExportButton href="/api/export/signals" label="Exportar histórico de sinais" />
          </div>
          <p className="mt-2 text-[10px] text-zinc-500">
            CSV em UTF-8 (com BOM). Abra direto no Excel ou Google Sheets.
          </p>
        </Section>

        <Section icon={<Eye className="h-3.5 w-3.5" />} title="Fonte de dados">
          <p className="text-xs text-zinc-400">
            Os candles vêm direto do mercado — Binance para cripto e Twelve Data para forex.
            Nenhum robô precisa ser instalado.
          </p>
          <Link
            href="/dashboard/watchlist"
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-offwhite hover:bg-white/[0.08]"
          >
            Gerenciar watchlist
          </Link>
        </Section>

        <Section icon={<Activity className="h-3.5 w-3.5" />} title="Notificações de sinal">
          <p className="text-xs text-zinc-400">
            As preferências de notificação ficam na página{" "}
            <Link
              href="/dashboard/sinais"
              className="text-emerald-400 underline-offset-2 hover:underline"
            >
              Sinais ao vivo
            </Link>{" "}
            (filtro de probabilidade mínima, mute, som). São salvas no seu navegador.
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

function DataCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="num mt-1 text-xl font-medium text-offwhite">{value}</div>
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
