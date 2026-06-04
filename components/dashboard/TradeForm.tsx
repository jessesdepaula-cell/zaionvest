"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createTrade } from "@/app/actions/trades";
import { cn } from "@/lib/utils";

type Prefill = {
  asset?: string;
  timeframe?: string;
  mode?: "CLASSICO" | "SMC";
  direction?: "BUY" | "SELL";
  entryPrice?: string;
  stopPrice?: string;
  targetPrice?: string;
};

export function TradeFormButton({
  prefill,
  label = "Novo trade",
  variant = "primary",
}: {
  prefill?: Prefill;
  label?: string;
  variant?: "primary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition",
          variant === "primary"
            ? "bg-emerald-500 text-charcoal hover:bg-emerald-400"
            : "border border-white/10 bg-white/[0.04] text-offwhite hover:bg-white/[0.08]",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="glass relative w-full max-w-lg rounded-xl p-6">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <h2 className="text-base font-semibold tracking-tight">Registrar trade</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Catalogue o trade para acompanhar performance por modo.
            </p>

            <form
              action={async (fd) => {
                setSubmitting(true);
                try {
                  await createTrade(fd);
                  setOpen(false);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="mt-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ativo *" name="asset" defaultValue={prefill?.asset} placeholder="EURUSD, WIN, BTCUSDT" />
                <Field label="Timeframe" name="timeframe" defaultValue={prefill?.timeframe} placeholder="M15, H1, D1" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Modo *"
                  name="mode"
                  defaultValue={prefill?.mode ?? "SMC"}
                  options={[
                    { value: "SMC", label: "SMC" },
                    { value: "CLASSICO", label: "Clássico" },
                  ]}
                />
                <Select
                  label="Direção *"
                  name="direction"
                  defaultValue={prefill?.direction ?? "BUY"}
                  options={[
                    { value: "BUY", label: "Compra" },
                    { value: "SELL", label: "Venda" },
                  ]}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Entrada *" name="entryPrice" defaultValue={prefill?.entryPrice} mono placeholder="1.0850" />
                <Field label="Stop *" name="stopPrice" defaultValue={prefill?.stopPrice} mono placeholder="1.0820" />
                <Field label="Alvo" name="targetPrice" defaultValue={prefill?.targetPrice} mono placeholder="1.0920" />
              </div>

              <Field label="Anotações" name="notes" textarea placeholder="Setup, contexto, confluências..." />

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-medium text-charcoal transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {submitting ? "Salvando..." : "Registrar trade"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  mono,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  mono?: boolean;
  textarea?: boolean;
}) {
  const cls = cn(
    "w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-offwhite outline-none transition focus:border-emerald-500/50 focus:bg-white/[0.04]",
    mono && "font-mono tabular-nums",
  );
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} placeholder={placeholder} rows={3} className={cls} />
      ) : (
        <input name={name} defaultValue={defaultValue} placeholder={placeholder} className={cls} autoComplete="off" />
      )}
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-offwhite outline-none transition focus:border-emerald-500/50 focus:bg-white/[0.04]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-charcoal">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
