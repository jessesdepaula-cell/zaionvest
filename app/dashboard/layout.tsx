import Link from "next/link";
import Image from "next/image";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { LogOut } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-charcoal text-offwhite">
      {/* Sidebar fixa em desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-[#f5f5f5]/5 bg-charcoal/95 backdrop-blur-md lg:flex lg:flex-col">
        <div className="border-b border-[#f5f5f5]/5 px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo-mark.png"
              alt=""
              width={230}
              height={230}
              priority
              className="h-7 w-7"
              style={{ mixBlendMode: "lighten" }}
            />
            <span className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
              Zaion<span className="text-[#2563EB]">Vest</span>
            </span>
            <span className="ml-auto rounded-md border border-[#2563EB]/50 bg-[#2563EB]/[0.14] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#2563EB] font-semibold">
              Pro
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav owner={owner} />
        </div>

        <div className="border-t border-[#f5f5f5]/5 px-3 py-3">
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
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#2563EB]/20 bg-[#2563EB]/[0.06] px-3 py-2 text-xs font-medium text-[#2563EB] transition hover:border-[#2563EB]/40 hover:bg-[#2563EB]/[0.12] hover:text-white"
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
      <header className="sticky top-0 z-30 border-b border-[#f5f5f5]/5 bg-charcoal/80 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo-mark.png"
              alt=""
              width={230}
              height={230}
              priority
              className="h-7 w-7"
              style={{ mixBlendMode: "lighten" }}
            />
            <span className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
              Zaion<span className="text-[#2563EB]">Vest</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <UserButton afterSignOutUrl="/" />
            <SignOutButton redirectUrl="/">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#2563EB]/30 bg-[#2563EB]/[0.06] px-2.5 py-1.5 text-xs font-medium text-[#2563EB] hover:bg-[#2563EB]/[0.12]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </SignOutButton>
          </div>
        </div>
        <div className="border-t border-[#f5f5f5]/5">
          <SidebarNav owner={owner} />
        </div>
      </header>

      <main className="lg:pl-60">
        {children}
      </main>
    </div>
  );
}
