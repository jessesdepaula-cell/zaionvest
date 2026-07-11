"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bot, Download, GraduationCap, LifeBuoy, Map, User, Users } from "lucide-react";

import { cn } from "@/lib/utils";

// Produto = vitrine de EAs. As features de sinais ao vivo e análise de prints
// foram descontinuadas (decisão Jessé 2026-07-11).
const NAV = [
  { href: "/dashboard/vitrine", icon: Bot, label: "Vitrine de EAs" },
  { href: "/dashboard/downloads", icon: Download, label: "Meus Downloads" },
  { href: "/dashboard/academia", icon: GraduationCap, label: "Academia" },
  { href: "/dashboard/notificacoes", icon: Bell, label: "Notificações" },
  { href: "/dashboard/roadmap", icon: Map, label: "Roadmap" },
  { href: "/dashboard/suporte", icon: LifeBuoy, label: "Suporte" },
  { href: "/dashboard/configuracoes", icon: User, label: "Minha Conta" },
];

// Itens exclusivos do administrador (dono): gestão de assinantes e dos EAs.
const ADMIN_NAV = [
  { href: "/dashboard/admin", icon: Users, label: "Assinantes" },
  { href: "/dashboard/admin/eas", icon: Bot, label: "Admin — EAs" },
];

export function SidebarNav({ owner = false }: { owner?: boolean }) {
  const pathname = usePathname();
  const items = owner ? [...NAV, ...ADMIN_NAV] : NAV;
  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
              isActive
                ? "bg-[#2563EB]/[0.12] text-[#F5F5F5] ring-1 ring-inset ring-[#2563EB]/40"
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
    </nav>
  );
}
