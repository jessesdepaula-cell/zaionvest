import Link from "next/link";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Crosshair, LogOut } from "lucide-react";
import { requireActiveSubscription, isOwner } from "@/lib/subscription";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/dashboard/Sidebar";

const BUILD_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  new Date().toISOString().slice(0, 16).replace("T", " ");

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sub = await requireActiveSubscription();

  // O dono nunca é barrado pela checagem de assinatura (precisa acessar o admin
  // e o painel mesmo com status inativo).
  const subUser = ("user" in sub ? sub.user : null) ?? null;
  const owner = isOwner(subUser);
  if (!sub.ok && !owner) {
    if (sub.reason === "unauthenticated") redirect("/sign-in");
    if (sub.reason === "inactive") redirect("/billing");
  }

  const user = await currentUser();
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.emailAddresses[0]?.emailAddress ||
    "Usuário";

  // Dias restantes do teste grátis (só para assinantes em trial, não para o dono).
  const trialDaysLeft =
    !owner && subUser?.subscriptionStatus === "trialing" && subUser.currentPeriodEnd
      ? Math.max(
          0,
          Math.ceil((new Date(subUser.currentPeriodEnd).getTime() - Date.now()) / 86_400_000),
        )
      : null;

  return (
    <div className="min-h-screen bg-charcoal text-offwhite">
      {/* Sidebar fixa em desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-[#f0ddb0]/5 bg-charcoal/95 backdrop-blur-md lg:flex lg:flex-col">
        <div className="border-b border-[#f0ddb0]/5 px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md border border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.03]">
              <Crosshair className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <span className="text-sm font-medium tracking-tight">
              Zaion<span className="text-zinc-500">Vest</span>
            </span>
            <span className="ml-auto rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-400">
              Pro
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav owner={owner} />
        </div>

        <div className="border-t border-[#f0ddb0]/5 px-3 py-3">
          <div className="flex items-center gap-2 px-1">
            <UserButton afterSignOutUrl="/" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-offwhite">{userName}</p>
              <p className="truncate text-[10px] text-zinc-500">Plano Pro</p>
            </div>
          </div>
          <SignOutButton redirectUrl="/">
            <button
              type="button"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-rose-500/20 bg-rose-500/[0.04] px-3 py-2 text-xs font-medium text-rose-300 transition hover:border-rose-500/40 hover:bg-rose-500/[0.10] hover:text-rose-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </SignOutButton>
          <p className="num mt-2 text-center text-[9px] tracking-widest text-zinc-700">
            v {BUILD_VERSION}
          </p>
        </div>
      </aside>

      {/* Top bar mobile */}
      <header className="sticky top-0 z-30 border-b border-[#f0ddb0]/5 bg-charcoal/80 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md border border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.03]">
              <Crosshair className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <span className="text-sm font-medium tracking-tight">
              Zaion<span className="text-zinc-500">Vest</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <UserButton afterSignOutUrl="/" />
            <SignOutButton redirectUrl="/">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/[0.12]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </SignOutButton>
          </div>
        </div>
        <div className="border-t border-[#f0ddb0]/5">
          <SidebarNav owner={owner} />
        </div>
      </header>

      <main className="lg:pl-60">
        {trialDaysLeft !== null && (
          <div className="border-b border-amber-500/20 bg-amber-500/[0.06] px-6 py-2.5 text-center text-xs text-amber-200">
            <span className="font-medium">Teste grátis</span> —{" "}
            {trialDaysLeft === 0
              ? "último dia"
              : `${trialDaysLeft} ${trialDaysLeft === 1 ? "dia restante" : "dias restantes"}`}
            .{" "}
            <Link
              href="/billing"
              className="font-semibold underline underline-offset-2 hover:text-amber-100"
            >
              Ativar assinatura
            </Link>{" "}
            para não perder acesso aos sinais.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
