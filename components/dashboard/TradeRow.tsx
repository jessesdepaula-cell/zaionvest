"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Trash2, XCircle, Minus } from "lucide-react";
import { closeTrade, deleteTrade } from "@/app/actions/trades";
import { cn } from "@/lib/utils";

type Trade = {
  id: string;
  asset: string;
  timeframe: string | null;
  mode: string;
  direction: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number | null;
  exitPrice: number | null;
  outcome: string;
  pnlAmount: number | null;
  rMultiple: number | null;
  openedAt: Date;
  closedAt: Date | null;
  notes: string | null;
};

export function TradeRow({ trade }: { trade: Trade }) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState<null | "WIN" | "LOSS" | "BREAKEVEN">(null);

  const outcome = trade.outcome as "OPEN" | "WIN" | "LOSS" | "BREAKEVEN";
  const isOpen = outcome === "OPEN";

  return (
    <div className="glass rounded-xl">
      <div
        className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="num text-sm font-medium text-offwhite">
              {trade.asset}
            </span>
            {trade.timeframe && (
              <span className="num text-xs text-zinc-500">· {trade.timeframe}</span>
            )}
            <DirectionPill direction={trade.direction} />
            <ModePill mode={trade.mode} />
          </div>
          <div className="num mt-0.5 text-[11px] text-zinc-500">
            {new Date(trade.openedAt).toLocaleDateString("pt-BR")} · Entrada {formatPrice(trade.entryPrice)} · Stop {formatPrice(trade.stopPrice)}
          </div>
        </div>

        <div className="hidden sm:block">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Resultado</div>
          <OutcomePill outcome={outcome} />
        </div>

        <div className="hidden sm:block">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">R</div>
          <div className={cn("num text-sm", rColor(trade.rMultiple))}>
            {trade.rMultiple === null ? "—" : `${trade.rMultiple > 0 ? "+" : ""}${trade.rMultiple.toFixed(2)}R`}
          </div>
        </div>

        <div className="hidden sm:block">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">P&L</div>
          <div className={cn("num text-sm", trade.pnlAmount && trade.pnlAmount > 0 ? "text-emerald-400" : trade.pnlAmount && trade.pnlAmount < 0 ? "text-rose-400" : "text-zinc-400")}>
            {trade.pnlAmount === null ? "—" : formatPnl(trade.pnlAmount)}
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto grid h-8 w-8 place-items-center rounded-md text-zinc-400 hover:bg-[#f0ddb0]/[0.04] hover:text-offwhite"
        >
          <ChevronRight className={cn("h-4 w-4 transition", expanded && "rotate-90")} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[#f0ddb0]/5 px-4 py-3">
          {trade.notes && (
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Anotações</div>
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-300">{trade.notes}</p>
            </div>
          )}

          {isOpen ? (
            <div className="flex flex-wrap items-end gap-3">
              <form
                action={async (fd) => {
                  setClosing("WIN");
                  await closeTrade(fd);
                  setClosing(null);
                }}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={trade.id} />
                <input type="hidden" name="outcome" value="WIN" />
                <MiniField label="Saída" name="exitPrice" placeholder="ex: 1.0900" />
                <MiniField label="P&L (R$)" name="pnlAmount" placeholder="ex: 250" />
                <button
                  type="submit"
                  disabled={!!closing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/[0.12] px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/[0.18] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ganho
                </button>
              </form>

              <form
                action={async (fd) => {
                  setClosing("LOSS");
                  await closeTrade(fd);
                  setClosing(null);
                }}
              >
                <input type="hidden" name="id" value={trade.id} />
                <input type="hidden" name="outcome" value="LOSS" />
                <button
                  type="submit"
                  disabled={!!closing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/[0.12] px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/[0.18] disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Perda
                </button>
              </form>

              <form
                action={async (fd) => {
                  setClosing("BREAKEVEN");
                  await closeTrade(fd);
                  setClosing(null);
                }}
              >
                <input type="hidden" name="id" value={trade.id} />
                <input type="hidden" name="outcome" value="BREAKEVEN" />
                <button
                  type="submit"
                  disabled={!!closing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#f0ddb0]/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-[#f0ddb0]/[0.08] disabled:opacity-50"
                >
                  <Minus className="h-3.5 w-3.5" />
                  Empate
                </button>
              </form>

              <form
                action={async (fd) => {
                  if (confirm("Deletar este trade?")) await deleteTrade(fd);
                }}
                className="ml-auto"
              >
                <input type="hidden" name="id" value={trade.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500">
                Fechado em {trade.closedAt ? new Date(trade.closedAt).toLocaleDateString("pt-BR") : "—"}
                {trade.exitPrice !== null && (
                  <span className="num"> · Saída {formatPrice(trade.exitPrice)}</span>
                )}
              </div>
              <form
                action={async (fd) => {
                  if (confirm("Deletar este trade?")) await deleteTrade(fd);
                }}
              >
                <input type="hidden" name="id" value={trade.id} />
                <button className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-rose-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniField({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        className="num w-28 rounded-md border border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.02] px-2 py-1.5 text-xs outline-none focus:border-emerald-500/50"
        autoComplete="off"
      />
    </label>
  );
}

function DirectionPill({ direction }: { direction: string }) {
  const isBuy = direction === "BUY";
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest",
        isBuy
          ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
          : "border-rose-500/30 bg-rose-500/[0.08] text-rose-300",
      )}
    >
      {isBuy ? "Compra" : "Venda"}
    </span>
  );
}

function ModePill({ mode }: { mode: string }) {
  return (
    <span className="rounded-md border border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.03] px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-zinc-300">
      {mode === "SMC" ? "SMC" : "Clássico"}
    </span>
  );
}

function OutcomePill({ outcome }: { outcome: "OPEN" | "WIN" | "LOSS" | "BREAKEVEN" }) {
  const meta = {
    OPEN: { label: "Aberto", cls: "text-amber-400" },
    WIN: { label: "Ganho", cls: "text-emerald-400" },
    LOSS: { label: "Perda", cls: "text-rose-400" },
    BREAKEVEN: { label: "Empate", cls: "text-zinc-400" },
  }[outcome];
  return <div className={cn("text-sm font-medium", meta.cls)}>{meta.label}</div>;
}

function rColor(r: number | null) {
  if (r === null) return "text-zinc-400";
  if (r > 0) return "text-emerald-400";
  if (r < 0) return "text-rose-400";
  return "text-zinc-400";
}

function formatPrice(n: number): string {
  const abs = Math.abs(n);
  const digits = abs < 1 ? 5 : abs < 100 ? 4 : abs < 10000 ? 2 : 0;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPnl(n: number): string {
  const sign = n > 0 ? "+" : "";
  return sign + n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
