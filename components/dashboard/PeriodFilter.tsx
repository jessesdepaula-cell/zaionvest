"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "Tudo" },
];

export function PeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("periodo") ?? "all";

  function set(p: string) {
    const sp = new URLSearchParams(params.toString());
    if (p === "all") sp.delete("periodo");
    else sp.set("periodo", p);
    const qs = sp.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
      {PERIODS.map((p) => {
        const isActive = active === p.value;
        return (
          <button
            key={p.value}
            onClick={() => set(p.value)}
            className={cn(
              "rounded-md px-3 py-1 text-[10px] font-medium uppercase tracking-widest transition",
              isActive
                ? "bg-emerald-500/[0.14] text-emerald-300"
                : "text-zinc-400 hover:text-offwhite",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
