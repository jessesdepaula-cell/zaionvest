"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const SYMBOLS = [
  "EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDCAD",
  "NZDUSD", "USDCHF", "EURGBP", "EURJPY", "GBPJPY",
  "BTCUSD", "ETHUSD",
];

const TIMEFRAMES = ["M15", "M30", "H1", "H4", "D1"];

const STYLES = [
  { value: "", label: "Todos os estilos" },
  { value: "trend", label: "Tendência" },
  { value: "reversal", label: "Reversão" },
  { value: "breakout", label: "Rompimento" },
  { value: "grid", label: "Grid" },
  { value: "range", label: "Range" },
];

const SORT_OPTIONS = [
  { value: "wfe_desc", label: "Maior WFE" },
  { value: "pf_desc", label: "Maior Profit Factor" },
  { value: "dd_asc", label: "Menor Drawdown" },
  { value: "newest", label: "Mais recentes" },
];

interface EAFiltersProps {
  total?: number;
}

export function EAFilters({ total }: EAFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const symbol = searchParams.get("symbol") ?? "";
  const timeframe = searchParams.get("timeframe") ?? "";
  const style = searchParams.get("style") ?? "";
  const sort = searchParams.get("sort") ?? "wfe_desc";
  const top25 = searchParams.get("top") === "25";
  const corr = parseFloat(searchParams.get("corr") ?? "1");

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // reset paginação ao filtrar
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const hasFilters = !!symbol || !!timeframe || !!style;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Símbolo */}
        <select
          value={symbol}
          onChange={(e) => setParam("symbol", e.target.value)}
          className="rounded-lg border border-[#f5f5f5]/10 bg-[#0A0A0A] px-3 py-2 text-xs text-zinc-300 focus:border-[#DC1F2E]/50 focus:outline-none transition"
        >
          <option value="">Todos os pares</option>
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Timeframe */}
        <select
          value={timeframe}
          onChange={(e) => setParam("timeframe", e.target.value)}
          className="rounded-lg border border-[#f5f5f5]/10 bg-[#0A0A0A] px-3 py-2 text-xs text-zinc-300 focus:border-[#DC1F2E]/50 focus:outline-none transition"
        >
          <option value="">Todos os TFs</option>
          {TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
        </select>

        {/* Estilo */}
        <select
          value={style}
          onChange={(e) => setParam("style", e.target.value)}
          className="rounded-lg border border-[#f5f5f5]/10 bg-[#0A0A0A] px-3 py-2 text-xs text-zinc-300 focus:border-[#DC1F2E]/50 focus:outline-none transition"
        >
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Ordenação */}
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="rounded-lg border border-[#f5f5f5]/10 bg-[#0A0A0A] px-3 py-2 text-xs text-zinc-300 focus:border-[#DC1F2E]/50 focus:outline-none transition ml-auto"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Limpar filtros */}
        {hasFilters && (
          <button
            onClick={() => {
              const params = new URLSearchParams();
              params.set("sort", sort);
              router.push(`${pathname}?${params.toString()}`);
            }}
            className="rounded-lg border border-[#f5f5f5]/10 px-3 py-2 text-xs text-zinc-500 transition hover:text-zinc-300 hover:border-[#f5f5f5]/20"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Segunda linha: TOP 25% + correlação máxima */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => setParam("top", top25 ? "" : "25")}
          aria-pressed={top25}
          className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
            top25
              ? "border-[#DC1F2E]/50 bg-[#DC1F2E]/[0.08] text-[#DC1F2E]"
              : "border-[#f5f5f5]/10 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          TOP 25%
        </button>

        <div className="flex items-center gap-2">
          <label htmlFor="corr" className="text-[11px] text-zinc-500 whitespace-nowrap">
            Correlação máx
          </label>
          <input
            id="corr"
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={corr}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setParam("corr", v >= 1 ? "" : v.toFixed(1));
            }}
            className="h-1 w-40 cursor-pointer accent-[#DC1F2E]"
          />
          <span className="w-8 text-[11px] tabular-nums text-zinc-400">
            {corr >= 1 ? "off" : corr.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Contador */}
      {total != null && (
        <p className="text-[11px] text-zinc-600">
          {total} {total === 1 ? "estratégia encontrada" : "estratégias encontradas"}
          {hasFilters && " com os filtros aplicados"}
        </p>
      )}
    </div>
  );
}
