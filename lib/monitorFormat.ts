export function fmtMoney(v: number | null | undefined, currency = "USD") {
  if (v == null || Number.isNaN(v)) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}${currency === "BRL" ? "R$" : currency === "USD" ? "$" : currency + " "}${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(v: number | null | undefined, digits = 2) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function fmtInt(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR");
}

export function classForDelta(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "text-zinc-500";
  if (v > 0) return "text-emerald-400 font-semibold";
  if (v < 0) return "text-rose-400 font-semibold";
  return "text-[#F5F5F5]";
}
