"use client";
import React, { useState } from "react";
import { Info } from "lucide-react";

interface PeriodRow {
  gain: number;
  diffGain: number;
  profit: number;
  diffProfit: number;
  pips: number;
  diffPips: number;
  winRate: number;
  diffWinRate: number;
  trades: number;
  diffTrades: number;
  lots: number;
  diffLots: number;
}

interface TradingPeriodsTableProps {
  periods: {
    today: PeriodRow;
    week: PeriodRow;
    month: PeriodRow;
    year: PeriodRow;
  };
  currency: string;
}

export function TradingPeriodsTable({ periods, currency }: TradingPeriodsTableProps) {
  const [activeTab, setActiveTab] = useState("Operações");
  const tabs = ["Operações"];

  if (!periods) {
    return (
      <div className="w-full bg-[#0D0D0D] rounded-xl border border-[#f5f5f5]/8 p-6 shadow-lg shadow-black/40 font-mono text-xs text-rose-400">
        Nenhum dado de período encontrado para esta conta de monitoramento.
      </div>
    );
  }

  const formatGain = (val: number) => {
    const safeVal = val || 0;
    const sign = safeVal >= 0 ? "+" : "";
    return `${sign}${safeVal.toFixed(2)}%`;
  };

  const formatProfit = (val: number) => {
    const safeVal = val || 0;
    const sign = safeVal >= 0 ? "+" : "-";
    const absVal = Math.abs(safeVal);
    const symbol = currency === "USD" ? "$" : currency + " ";
    return `${sign}${symbol}${absVal.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDiffProfit = (val: number) => {
    const safeVal = val || 0;
    const sign = safeVal >= 0 ? "+" : "-";
    const absVal = Math.abs(safeVal);
    const symbol = currency === "USD" ? "$" : currency + " ";
    return `${sign}${symbol}${absVal.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPips = (val: number) => {
    const safeVal = val || 0;
    const sign = safeVal >= 0 ? "+" : "";
    return `${sign}${safeVal.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}`;
  };

  const renderValueAndDiff = (
    valueStr: string,
    diffStr: string,
    isPositiveValue: boolean,
    isZeroValue: boolean,
    isPositiveDiff: boolean,
    isZeroDiff: boolean,
    colorValue: boolean = true
  ) => {
    const valueColor = isZeroValue
      ? "text-[#F5F5F5]"
      : isPositiveValue
      ? "text-emerald-400 font-semibold"
      : "text-rose-400 font-semibold";

    const diffColor = isZeroDiff
      ? "text-zinc-600"
      : isPositiveDiff
      ? "text-emerald-500/80"
      : "text-rose-500/80";

    return (
      <div className="flex flex-col items-center justify-center font-mono">
        <span className={colorValue ? valueColor : "text-[#F5F5F5] font-semibold"}>{valueStr}</span>
        <span className={`text-[10px] ${diffColor}`}>({diffStr})</span>
      </div>
    );
  };

  const renderRow = (label: string, rowData?: PeriodRow) => {
    if (!rowData) {
      return (
        <tr key={label} className="border-b border-[#f5f5f5]/5">
          <td className="px-4 py-3 font-semibold text-zinc-400 text-xs text-left">{label}</td>
          <td colSpan={6} className="px-4 py-3 text-center text-xs text-zinc-500">Sem dados</td>
        </tr>
      );
    }

    return (
      <tr key={label} className="border-b border-[#f5f5f5]/5 hover:bg-[#f5f5f5]/[0.01] transition-colors">
        <td className="px-4 py-3 font-semibold text-[#F5F5F5] text-xs text-left">{label}</td>
        
        {/* Gain */}
        <td className="px-4 py-3 text-center text-xs">
          {renderValueAndDiff(
            formatGain(rowData.gain),
            formatGain(rowData.diffGain),
            rowData.gain >= 0,
            rowData.gain === 0,
            rowData.diffGain >= 0,
            rowData.diffGain === 0
          )}
        </td>

        {/* Profit */}
        <td className="px-4 py-3 text-center text-xs">
          {renderValueAndDiff(
            formatProfit(rowData.profit),
            formatDiffProfit(rowData.diffProfit),
            rowData.profit >= 0,
            rowData.profit === 0,
            rowData.diffProfit >= 0,
            rowData.diffProfit === 0
          )}
        </td>

        {/* Pips */}
        <td className="px-4 py-3 text-center text-xs">
          {renderValueAndDiff(
            formatPips(rowData.pips),
            formatPips(rowData.diffPips),
            rowData.pips >= 0,
            rowData.pips === 0,
            rowData.diffPips >= 0,
            rowData.diffPips === 0
          )}
        </td>

        {/* Win% */}
        <td className="px-4 py-3 text-center text-xs">
          {renderValueAndDiff(
            `${(rowData.winRate || 0).toFixed(0)}%`,
            `${rowData.diffWinRate >= 0 ? "+" : ""}${(rowData.diffWinRate || 0).toFixed(0)}%`,
            rowData.winRate >= 50,
            rowData.winRate === 0,
            rowData.diffWinRate >= 0,
            rowData.diffWinRate === 0,
            false
          )}
        </td>

        {/* Trades */}
        <td className="px-4 py-3 text-center text-xs">
          {renderValueAndDiff(
            (rowData.trades || 0).toString(),
            `${rowData.diffTrades >= 0 ? "+" : ""}${rowData.diffTrades || 0}`,
            rowData.trades > 0,
            rowData.trades === 0,
            rowData.diffTrades >= 0,
            rowData.diffTrades === 0,
            false
          )}
        </td>

        {/* Lots */}
        <td className="px-4 py-3 text-center text-xs">
          {renderValueAndDiff(
            (rowData.lots || 0).toFixed(2),
            `${rowData.diffLots >= 0 ? "+" : ""}${(rowData.diffLots || 0).toFixed(2)}`,
            rowData.lots > 0,
            rowData.lots === 0,
            rowData.diffLots >= 0,
            rowData.diffLots === 0,
            false
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="w-full bg-[#0D0D0D] rounded-xl border border-[#f5f5f5]/8 overflow-hidden shadow-lg shadow-black/40">
      {/* Tabs Menu */}
      <div className="flex border-b border-[#f5f5f5]/8 bg-[#090909]">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-xs font-semibold border-r border-[#f5f5f5]/8 transition-all ${
              activeTab === tab
                ? "bg-[#0D0D0D] text-[#F5F5F5] border-b-2 border-b-blue-500"
                : "text-zinc-500 hover:text-[#F5F5F5] hover:bg-[#f5f5f5]/[0.02]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#090909] border-b border-[#f5f5f5]/8">
              <th className="px-4 py-2.5 text-zinc-500 text-left text-[10px] w-[12%]">
                <Info size={13} className="text-zinc-500 inline-block" />
              </th>
              <th className="px-4 py-2.5 text-zinc-500 text-center text-[9px] font-bold uppercase tracking-wider">
                Ganho (Diferença)
              </th>
              <th className="px-4 py-2.5 text-zinc-500 text-center text-[9px] font-bold uppercase tracking-wider">
                Lucro (Diferença)
              </th>
              <th className="px-4 py-2.5 text-zinc-500 text-center text-[9px] font-bold uppercase tracking-wider">
                Pips (Diferença)
              </th>
              <th className="px-4 py-2.5 text-zinc-500 text-center text-[9px] font-bold uppercase tracking-wider">
                Vitórias % (Diferença)
              </th>
              <th className="px-4 py-2.5 text-zinc-500 text-center text-[9px] font-bold uppercase tracking-wider">
                Operações (Diferença)
              </th>
              <th className="px-4 py-2.5 text-zinc-500 text-center text-[9px] font-bold uppercase tracking-wider">
                Lotes (Diferença)
              </th>
            </tr>
          </thead>
          <tbody>
            {renderRow("Hoje", periods.today)}
            {renderRow("Esta Semana", periods.week)}
            {renderRow("Este Mês", periods.month)}
            {renderRow("Este Ano", periods.year)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
