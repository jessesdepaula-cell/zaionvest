"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Clock, Minus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type SignalHistoryItem = {
  id: string;
  symbol: string;
  timeframe: string;
  mode: string;
  direction: string | null;
  entryPrice: number | null;
  stopPrice: number | null;
  target1: number | null;
  riskReward: string | null;
  rMultiple: number | null;
  status: string;
  tipoSetup: string | null;
  scannedAt: string;
};

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  WIN: {
    label: "Gain",
    icon: <TrendingUp className="h-3 w-3" />,
    cls: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300",
  },
  LOSS: {
    label: "Loss",
    icon: <TrendingDown className="h-3 w-3" />,
    cls: "border-rose-500/20 bg-rose-500/[0.08] text-rose-300",
  },
  PENDING: {
    label: "Aguardando",
    icon: <Clock className="h-3 w-3" />,
    cls: "border-amber-500/20 bg-amber-500/[0.08] text-amber-300",
  },
  FILLED: {
    label: "Em execução",
    icon: <Clock className="h-3 w-3 animate-pulse" />,
    cls: "border-blue-500/20 bg-blue-500/[0.08] text-blue-300",
  },
  EXPIRED: {
    label: "Expirado",
    icon: <Minus className="h-3 w-3" />,
    cls: "border-zinc-500/20 bg-zinc-500/[0.04] text-zinc-400",
  },
  NO_SETUP: {
    label: "Sem setup",
    icon: <Minus className="h-3 w-3" />,
    cls: "border-zinc-700/20 bg-zinc-800/20 text-zinc-600",
  },
};

const PAGE_SIZE = 15;

export function SignalHistoryTable({ signals }: { signals: SignalHistoryItem[] }) {
  const [page, setPage] = useState(0);
  const [modeFilter, setModeFilter] = useState<"ALL" | "SMC" | "CLASSICO">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "WIN" | "LOSS" | "PENDING" | "FILLED" | "EXPIRED">("ALL");

  const filtered = signals.filter((s) => {
    if (modeFilter !== "ALL" && s.mode !== modeFilter) return false;
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const wins = filtered.filter((s) => s.status === "WIN").length;
  const losses = filtered.filter((s) => s.status === "LOSS").length;
  const denom = wins + losses;
  const winRate = denom > 0 ? ((wins / denom) * 100).toFixed(1) : "—";

  return (
    <div>
      {/* Mini stats bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
        <span className="text-emerald-400 font-semibold">
          {wins} Gains
        </span>
        <span className="text-rose-400 font-semibold">
          {losses} Losses
        </span>
        <span className="text-zinc-300">
          Win Rate: <span className={cn("font-semibold", denom > 0 ? (parseFloat(winRate as string) >= 50 ? "text-emerald-400" : "text-rose-400") : "text-zinc-500")}>{winRate}{denom > 0 ? "%" : ""}</span>
        </span>
        <span className="text-zinc-600">({filtered.length} sinais com setup)</span>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-white/10 overflow-hidden text-[10px]">
          {(["ALL", "SMC", "CLASSICO"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setModeFilter(m); setPage(0); }}
              className={cn(
                "px-3 py-1.5 transition",
                modeFilter === m
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {m === "ALL" ? "Todos os modos" : m}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-white/10 overflow-hidden text-[10px]">
          {(["ALL", "WIN", "LOSS", "PENDING", "FILLED", "EXPIRED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className={cn(
                "px-3 py-1.5 transition",
                statusFilter === s
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {s === "ALL" ? "Todos" : STATUS_META[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      {paginated.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.01] py-10 text-center text-sm text-zinc-500">
          Nenhum sinal encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-[10px] uppercase tracking-widest text-zinc-500">
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Ativo</th>
                <th className="px-4 py-3 text-left">TF</th>
                <th className="px-4 py-3 text-left">Modo</th>
                <th className="px-4 py-3 text-left">Direção</th>
                <th className="px-4 py-3 text-right">Entrada</th>
                <th className="px-4 py-3 text-right">Stop</th>
                <th className="px-4 py-3 text-right">Alvo 1</th>
                <th className="px-4 py-3 text-center">R:R</th>
                <th className="px-4 py-3 text-center">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => {
                const meta = STATUS_META[s.status] ?? STATUS_META.EXPIRED;
                const dirColor =
                  s.direction?.includes("COMPRA") ? "text-emerald-400" :
                  s.direction?.includes("VENDA") ? "text-rose-400" : "text-zinc-500";
                const dirLabel =
                  s.direction === "COMPRA_FORTE" ? "▲ Compra" :
                  s.direction === "COMPRA_FRACA" ? "↑ Compra" :
                  s.direction === "VENDA_FORTE" ? "▼ Venda" :
                  s.direction === "VENDA_FRACA" ? "↓ Venda" : "—";

                const fmt = (v: number | null) =>
                  v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : "—";

                const date = new Date(s.scannedAt).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                });

                return (
                  <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition">
                    <td className="px-4 py-3 text-zinc-500">{date}</td>
                    <td className="px-4 py-3 font-semibold text-white">{s.symbol}</td>
                    <td className="px-4 py-3 text-zinc-400">{s.timeframe}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        s.mode === "SMC"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      )}>
                        {s.mode === "SMC" ? "SMC" : "Clássico"}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 font-medium", dirColor)}>{dirLabel}</td>
                    <td className="px-4 py-3 text-right text-zinc-300 num">{fmt(s.entryPrice)}</td>
                    <td className="px-4 py-3 text-right text-rose-400 num">{fmt(s.stopPrice)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 num">{fmt(s.target1)}</td>
                    <td className="px-4 py-3 text-center text-zinc-400">{s.riskReward ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5", meta.cls)}>
                        {meta.icon}
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span>
            Página {page + 1} de {totalPages} ({filtered.length} sinais)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 transition hover:bg-white/[0.04] disabled:opacity-30"
            >
              <ChevronLeft className="h-3 w-3" /> Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 transition hover:bg-white/[0.04] disabled:opacity-30"
            >
              Próxima <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
