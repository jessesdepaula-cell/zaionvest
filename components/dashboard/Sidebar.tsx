"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Crosshair, Eye, Radar, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", icon: Crosshair, label: "Análise" },
  { href: "/dashboard/sinais", icon: Radar, label: "Sinais ao vivo" },
  { href: "/dashboard/estatisticas", icon: BarChart3, label: "Estatísticas" },
  { href: "/dashboard/configuracoes", icon: Settings, label: "Configurações" },
];

// Itens exclusivos do administrador (dono): gestão de assinantes e a watchlist
// mestra (define os pares escaneados que geram os sinais globais). Assinantes
// comuns não veem nenhum dos dois.
const ADMIN_NAV = [
  { href: "/dashboard/admin", icon: Users, label: "Assinantes" },
  { href: "/dashboard/watchlist", icon: Eye, label: "Watchlist (mestra)" },
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
