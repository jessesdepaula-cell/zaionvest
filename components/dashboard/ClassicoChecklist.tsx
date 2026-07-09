"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Checklist = {
  tendencia_SMA200_alinhada?: boolean;
  alinhamento_perfeito_medias?: boolean;
  preco_na_zona_de_valor?: boolean;
  confluencia_suporte_resistencia?: boolean;
  volume_pullback_decrescente?: boolean;
  candle_gatilho_valido?: boolean;
};

const ITEMS: Array<{ key: keyof Checklist; label: string; hint: string }> = [
  { key: "tendencia_SMA200_alinhada", label: "Tendência MMA 200", hint: "Preço do lado correto da MMA 200 inclinada" },
  { key: "alinhamento_perfeito_medias", label: "Alinhamento das médias", hint: "MME 9 > MMA 21 > MMA 50 (ou inverso)" },
  { key: "preco_na_zona_de_valor", label: "Proximidade", hint: "Preço perto da MMA 21 — não esticado (fator proximidade)" },
  { key: "confluencia_suporte_resistencia", label: "Confluência", hint: "Agulhada (9/21/50 juntas) ou stop protegido por média" },
  { key: "volume_pullback_decrescente", label: "Volume decrescente", hint: "Recuo com volume menor que o impulso (quando disponível)" },
  { key: "candle_gatilho_valido", label: "Candle de gatilho", hint: "Gatilho PC / 9.2 / 9.1 com sombra de rejeição a favor" },
];

export function ClassicoChecklist({
  data,
  tipoSetup,
}: {
  data: Checklist;
  tipoSetup?: string | null;
}) {
  const total = ITEMS.length;
  const passed = ITEMS.filter((it) => data[it.key] === true).length;
  const ok = passed === total;

  return (
    <div className="rounded-xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Checklist Clássico (Price Action + Médias)
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            6 condições do método (tendência + proximidade + gatilho) —{" "}
            <span className={cn("num font-medium", ok ? "text-emerald-300" : "text-amber-300")}>
              {passed}/{total}
            </span>
            {tipoSetup && tipoSetup !== "Nenhum" && (
              <span className="ml-2 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-amber-300">
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
