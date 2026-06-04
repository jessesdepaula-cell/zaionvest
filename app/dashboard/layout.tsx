import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Crosshair } from "lucide-react";
import { requireActiveSubscription } from "@/lib/subscription";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sub = await requireActiveSubscription();

  if (!sub.ok) {
    if (sub.reason === "unauthenticated") redirect("/sign-in");
    if (sub.reason === "inactive") redirect("/billing");
  }

  return (
    <div className="min-h-screen bg-charcoal text-offwhite">
      {/* Sidebar fixa em desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-white/5 bg-charcoal/95 backdrop-blur-md lg:flex lg:flex-col">
        <div className="border-b border-white/5 px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/[0.03]">
              <Crosshair className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <span className="text-sm font-medium tracking-tight">
              Trade Vision<span className="text-zinc-500">.ai</span>
            </span>
            <span className="ml-auto rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-400">
              Pro
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>

        <div className="border-t border-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <span className="text-xs text-zinc-500">Sua conta</span>
          </div>
        </div>
      </aside>

      {/* Top bar mobile */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-charcoal/80 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/[0.03]">
              <Crosshair className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <span className="text-sm font-medium tracking-tight">
              Trade Vision<span className="text-zinc-500">.ai</span>
            </span>
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
        <div className="border-t border-white/5">
          <SidebarNav />
        </div>
      </header>

      <main className="lg:pl-60">{children}</main>
    </div>
  );
}
