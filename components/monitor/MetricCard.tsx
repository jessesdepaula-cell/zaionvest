import { classForDelta } from "@/lib/monitorFormat";
import { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  delta,
  hint,
  accent = false,
  big = false,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  hint?: ReactNode;
  accent?: boolean;
  big?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0D0D0D] px-4 py-3.5 shadow-lg shadow-black/40 transition duration-300 hover:border-blue-500/20 hover:bg-[#141414]">
      <div className="text-[10px] font-bold font-sans uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-1 font-mono tracking-tight leading-none ${big ? "text-2xl" : "text-lg"} ${
          accent ? "text-blue-400 font-bold" : "text-[#F5F5F5]"
        }`}
      >
        {value}
      </div>
      {delta != null && (
        <div className={`mt-1 text-[11px] tabular-nums ${classForDelta(delta)}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}%
        </div>
      )}
      {hint && <div className="mt-1 text-[10px] text-zinc-500 leading-snug">{hint}</div>}
    </div>
  );
}
