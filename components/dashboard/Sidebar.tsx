"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Download, LifeBuoy, User, Users, Activity, Video, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard/vitrine", icon: Bot, label: "Vitrine de EAs" },
  { href: "/dashboard/downloads", icon: Download, label: "Meus Downloads" },
  { href: "/dashboard/monitor", icon: Activity, label: "Zaion Monitor" },
  { href: "/dashboard/tutoriais", icon: Video, label: "Tutoriais" },
  { href: "/dashboard/suporte", icon: LifeBuoy, label: "Suporte" },
  { href: "/dashboard/configuracoes", icon: User, label: "Minha Conta" },
];

const ADMIN_NAV = [
  { href: "/dashboard/admin", icon: Users, label: "Painel Admin" },
  { href: "/dashboard/admin/eas", icon: Bot, label: "Admin — EAs" },
  { href: "/dashboard/tutoriais?manager=true", icon: Video, label: "Gestão de Vídeos" },
];

export function SidebarNav({ owner = false }: { owner?: boolean }) {
  const pathname = usePathname();

  const allItems = owner ? [...NAV, ...ADMIN_NAV] : NAV;
  const activeHref = allItems.reduce<string | null>((best, it) => {
    const cleanHref = it.href.split("?")[0];
    const match = pathname === cleanHref || pathname.startsWith(cleanHref + "/");
    return match && cleanHref.length > (best?.length ?? 0) ? cleanHref : best;
  }, null);

  return (
    <nav className="flex flex-col gap-4 p-3">
      {/* Seção Membro */}
      <div>
        <div className="px-3 mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <span>Área do Membro</span>
        </div>
        <div className="flex flex-col gap-1">
          {NAV.map((item) => {
            const isActive = item.href === activeHref;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition font-medium",
                  isActive
                    ? "bg-[#2563EB]/[0.12] text-[#F5F5F5] ring-1 ring-inset ring-[#2563EB]/40 font-semibold"
                    : "text-zinc-400 hover:bg-[#f5f5f5]/[0.04] hover:text-offwhite",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition",
                    isActive ? "text-[#2563EB]" : "text-zinc-500 group-hover:text-zinc-300",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Seção Gestor Exclusivo */}
      {owner && (
        <div className="pt-3 border-t border-white/10">
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-blue-400" />
              Painel do Gestor
            </span>
            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-blue-400 border border-blue-500/30">
              EXCLUSIVO
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-blue-950/20 p-1.5 border border-blue-500/10">
            {ADMIN_NAV.map((item) => {
              const cleanHref = item.href.split("?")[0];
              const isActive = cleanHref === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition font-medium",
                    isActive
                      ? "bg-[#2563EB] text-white shadow-md font-semibold"
                      : "text-blue-200/80 hover:bg-blue-600/20 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition",
                      isActive ? "text-white" : "text-blue-400 group-hover:text-white",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
