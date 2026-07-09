"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Checklist = {
  vies_HTF_a_favor?: boolean;
  liquidez_identificada?: boolean;
  sweep_corpo_fecha_dentro?: boolean;
  displacement_com_FVG?: boolean;
  ChoCh_confirmado_fechamento?: boolean;
  OB_em_zona_correta?: boolean;
};

const ITEMS: Array<{ key: keyof Checklist; label: string; hint: string }> = [
  { key: "vies_HTF_a_favor", label: "Viés HTF a favor", hint: "1H/4H alinhado ou lateral" },
  { key: "liquidez_identificada", label: "Liquidez identificada", hint: "BSL ou SSL clara antes do Sweep" },
  { key: "sweep_corpo_fecha_dentro", label: "Sweep válido", hint: "Pavio rompe, corpo fecha dentro" },
  { key: "displacement_com_FVG", label: "Displacement com FVG", hint: "Movimento impulsivo deixando vácuo" },
  { key: "ChoCh_confirmado_fechamento", label: "ChoCh confirmado", hint: "Corpo fecha além do último swing" },
  { key: "OB_em_zona_correta", label: "OB na zona correta", hint: "Discount p/ compra ou Premium p/ venda" },
];

export function SmcChecklist({ data, tipoSetup }: { data: Checklist; tipoSetup?: string | null }) {
  const total = ITEMS.length;
  const passed = ITEMS.filter((it) => data[it.key] === true).length;
  const ok = passed === total;

  return (
    <div className="rounded-xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Checklist SMC</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            6 condições do manual institucional —{" "}
            <span className={cn("num font-medium", ok ? "text-emerald-300" : "text-amber-300")}>
              {passed}/{total}
            </span>
            {tipoSetup && tipoSetup !== "Nenhum" && (
              <span className="ml-2 rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
                {tipoSetup}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ITEMS.map((it) => {
          const v = data[it.key];
          const pass = v === true;
          return (
            <div
              key={it.key}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                pass
                  ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                  : "border-rose-500/15 bg-rose-500/[0.03]",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 grid h-4 w-4 place-items-center rounded-sm",
                  pass ? "bg-emerald-500 text-charcoal" : "bg-rose-500/70 text-offwhite",
                )}
              >
                {pass ? <Check className="h-3 w-3" /> : <X className="h-2.5 w-2.5" />}
              </div>
              <div className="flex-1">
                <div className={cn("font-medium", pass ? "text-emerald-200" : "text-rose-200")}>
                  {it.label}
                </div>
                <div className="text-[10px] text-zinc-500">{it.hint}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
