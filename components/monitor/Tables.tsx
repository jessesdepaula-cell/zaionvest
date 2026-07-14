"use client";
import { fmtMoney } from "@/lib/monitorFormat";

interface OpenRow {
  ticket: string;
  symbol: string;
  side: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  openTime: string;
  magic: string;
  comment: string | null;
}

interface ClosedRow {
  ticket: string;
  symbol: string;
  side: string;
  volume: number;
  openPrice: number;
  closePrice: number;
  netProfit: number;
  closeTime: string;
  magic: string;
}

const headCls =
  "px-3 py-2 text-left font-sans text-[9px] font-bold uppercase tracking-widest text-zinc-500 border-b border-[#f5f5f5]/5";
const cellCls = "px-3 py-2 tabular-nums font-mono text-xs text-zinc-400 border-b border-[#f5f5f5]/5";

export function OpenPositionsTable({ rows, currency }: { rows: OpenRow[]; currency: string }) {
  if (!rows.length)
    return <div className="py-8 text-center font-sans text-xs text-zinc-500">Sem posições abertas neste momento</div>;
  return (
    <div className="max-h-[300px] overflow-auto rounded-lg border border-[#f5f5f5]/5 bg-[#070707]">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-[#0D0D0D]">
          <tr>
            <th className={headCls}>Ticket</th>
            <th className={headCls}>Ativo</th>
            <th className={headCls}>Tipo</th>
            <th className={headCls}>Lote</th>
            <th className={headCls}>Abertura</th>
            <th className={headCls}>Atual</th>
            <th className={headCls}>PnL Flutuante</th>
            <th className={headCls}>Robô (Magic)</th>
            <th className={headCls}>Aberto em</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticket} className="hover:bg-[#f5f5f5]/[0.02] transition">
              <td className={cellCls}>{r.ticket}</td>
              <td className={cellCls + " text-[#F5F5F5] font-semibold"}>{r.symbol}</td>
              <td className={cellCls + (r.side === "BUY" ? " text-emerald-400 font-semibold" : " text-rose-400 font-semibold")}>
                {r.side === "BUY" ? "COMPRA" : "VENDA"}
              </td>
              <td className={cellCls}>{r.volume.toFixed(2)}</td>
              <td className={cellCls}>{r.openPrice}</td>
              <td className={cellCls}>{r.currentPrice}</td>
              <td className={cellCls + (r.profit >= 0 ? " text-emerald-400 font-semibold" : " text-rose-400 font-semibold")}>
                {fmtMoney(r.profit, currency)}
              </td>
              <td className={cellCls + " text-zinc-500"}>{r.magic}</td>
              <td className={cellCls + " text-zinc-500"}>
                {new Date(r.openTime).toLocaleString("pt-BR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClosedTradesTable({ rows, currency }: { rows: ClosedRow[]; currency: string }) {
  if (!rows.length)
    return <div className="py-8 text-center font-sans text-xs text-zinc-500">Sem operações fechadas registradas</div>;
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-[#f5f5f5]/5 bg-[#070707]">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-[#0D0D0D]">
          <tr>
            <th className={headCls}>Ticket</th>
            <th className={headCls}>Ativo</th>
            <th className={headCls}>Tipo</th>
            <th className={headCls}>Lote</th>
            <th className={headCls}>Abertura</th>
            <th className={headCls}>Fechamento</th>
            <th className={headCls}>PnL Líquido</th>
            <th className={headCls}>Robô (Magic)</th>
            <th className={headCls}>Encerrado em</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticket} className="hover:bg-[#f5f5f5]/[0.02] transition">
              <td className={cellCls}>{r.ticket}</td>
              <td className={cellCls + " text-[#F5F5F5] font-semibold"}>{r.symbol}</td>
              <td className={cellCls + (r.side === "BUY" ? " text-emerald-400 font-semibold" : " text-rose-400 font-semibold")}>
                {r.side === "BUY" ? "COMPRA" : "VENDA"}
              </td>
              <td className={cellCls}>{r.volume.toFixed(2)}</td>
              <td className={cellCls}>{r.openPrice}</td>
              <td className={cellCls}>{r.closePrice}</td>
              <td className={cellCls + (r.netProfit >= 0 ? " text-emerald-400 font-semibold" : " text-rose-400 font-semibold")}>
                {fmtMoney(r.netProfit, currency)}
              </td>
              <td className={cellCls + " text-zinc-500"}>{r.magic}</td>
              <td className={cellCls + " text-zinc-500"}>
                {new Date(r.closeTime).toLocaleString("pt-BR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
