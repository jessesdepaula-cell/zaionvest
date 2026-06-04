"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", icon: Crosshair, label: "Análise" },
  { href: "/dashboard/diario", icon: BookOpen, label: "Diário" },
  { href: "/dashboard/estatisticas", icon: BarChart3, label: "Estatísticas" },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
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
                ? "bg-emerald-500/[0.10] text-emerald-300"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-offwhite",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 transition",
                isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
