"use client";

import { useState } from "react";
import { Plus, Power, Trash2 } from "lucide-react";
import { addWatch, removeWatch, toggleWatch } from "@/app/actions/watchlist";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  symbol: string;
  timeframe: string;
  mode: string;
  active: boolean;
  lastScanAt: Date | null;
};

export function WatchlistEditor({
  accountId,
  items,
}: {
  accountId: string;
  items: Item[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="glass rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Watchlist</p>
          <p className="mt-0.5 text-sm text-offwhite">
            Símbolos escaneados pelo EA a cada 15 minutos
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-offwhite hover:bg-white/[0.08]"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      {adding && (
        <form
          action={async (fd) => {
            await addWatch(fd);
            setAdding(false);
          }}
          className="mb-3 flex flex-wrap items-end gap-2 rounded-md border border-white/10 bg-white/[0.02] p-3"
        >
          <input type="hidden" name="accountId" value={accountId} />
          <label className="block">
            <span className="mb-0.5 block text-[10px] uppercase tracking-widest text-zinc-500">Símbolo</span>
            <input
              name="symbol"
              placeholder="EURUSD"
              required
              className="num w-28 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-xs outline-none focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] uppercase tracking-widest text-zinc-500">TF</span>
            <select
              name="timeframe"
              defaultValue="M15"
              className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-xs outline-none focus:border-emerald-500/50"
            >
              {["M5", "M15", "M30", "H1", "H4", "D1"].map((t) => (
                <option key={t} value={t} className="bg-charcoal">{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] uppercase tracking-widest text-zinc-500">Modo</span>
            <select
              name="mode"
              defaultValue="SMC"
              className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-xs outline-none focus:border-emerald-500/50"
            >
              <option value="SMC" className="bg-charcoal">SMC</option>
              <option value="CLASSICO" className="bg-charcoal">Clássico</option>
            </select>
          </label>
          <button className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-emerald-400">
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:text-offwhite"
          >
            Cancelar
          </button>
        </form>
      )}

      <div className="grid gap-1.5">
        {items.map((it) => (
          <div
            key={it.id}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2 transition",
              it.active ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01] opacity-50",
            )}
          >
            <div className="flex flex-1 items-center gap-2">
              <span className="num text-sm text-offwhite">{it.symbol}</span>
              <span className="num text-[10px] text-zinc-500">· {it.timeframe}</span>
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest",
                  it.mode === "SMC"
                    ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
                )}
              >
                {it.mode === "SMC" ? "SMC" : "Clássico"}
              </span>
            </div>
            <span className="num text-[10px] text-zinc-500">
              {it.lastScanAt
                ? `Último: ${new Date(it.lastScanAt).toLocaleTimeString("pt-BR")}`
                : "Sem scan ainda"}
            </span>
            <form action={toggleWatch}>
              <input type="hidden" name="id" value={it.id} />
              <button
                title={it.active ? "Pausar" : "Ativar"}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-md",
                  it.active
                    ? "text-emerald-400 hover:bg-white/[0.04]"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200",
                )}
              >
                <Power className="h-3.5 w-3.5" />
              </button>
            </form>
            <form
              action={async (fd) => {
                if (confirm(`Remover ${it.symbol} ${it.timeframe} ${it.mode}?`)) await removeWatch(fd);
              }}
            >
              <input type="hidden" name="id" value={it.id} />
              <button className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-white/[0.04] hover:text-rose-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        ))}
        {items.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-zinc-500">
            Watchlist vazia. Clique em <span className="text-zinc-300">Adicionar</span>.
          </p>
        )}
      </div>
    </div>
  );
}
