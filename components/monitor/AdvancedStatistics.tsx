"use client";
import React, { useState } from "react";

interface TradeValueDate {
  val: number;
  date: string;
}

interface AdvancedStatsData {
  trades: number;
  winRate: number;
  lossRate: number;
  pips: number;
  avgWinPips: number;
  avgWinMoney: number;
  avgLossPips: number;
  avgLossMoney: number;
  lots: number;
  commissions: number;
  longsWonCount: number;
  longsTotalCount: number;
  longsWinRate: number;
  shortsWonCount: number;
  shortsTotalCount: number;
  shortsWinRate: number;
  bestTradeMoney: TradeValueDate | null;
  worstTradeMoney: TradeValueDate | null;
  bestTradePips: TradeValueDate | null;
  worstTradePips: TradeValueDate | null;
  avgTradeLengthSec: number;
  profitFactor: number;
  stdDev: number;
  sharpeRatio: number;
  zScore: number;
  zProbability: number;
  expectancyMoney: number;
  expectancyPips: number;
  ahpr: number;
  ghpr: number;
}

interface AdvancedStatisticsProps {
  stats: AdvancedStatsData;
  currency: string;
}

export function AdvancedStatistics({ stats, currency }: AdvancedStatisticsProps) {
  const [activeTab, setActiveTab] = useState("Estatísticas");
  const tabs = ["Estatísticas"];

  if (!stats) {
    return (
      <div className="w-full bg-[#0D0D0D] rounded-xl border border-[#f5f5f5]/8 p-6 shadow-lg shadow-black/40 font-mono text-xs text-rose-400">
        Nenhum dado estatístico encontrado para esta conta de monitoramento.
      </div>
    );
  }

  const symbol = currency === "USD" ? "$" : currency + " ";

  const formatMoney = (val: number, showSign = false) => {
    const sign = showSign && val >= 0 ? "+" : val < 0 ? "-" : "";
    const absVal = Math.abs(val);
    return `${sign}${symbol}${absVal.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPips = (val: number) => {
    return val.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("pt-BR", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const formatDuration = (totalSec: number) => {
    if (totalSec <= 0) return "0s";
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const renderStatRow = (label: string, value: React.ReactNode, border = true) => {
    return (
      <div
        className={`flex justify-between items-center py-2 px-4 text-xs font-mono ${
          border ? "border-b border-[#f5f5f5]/5" : ""
        }`}
      >
        <span className="text-zinc-500 font-medium">{label}</span>
        <span className="text-[#F5F5F5] font-semibold text-right">{value}</span>
      </div>
    );
  };

  return (
    <div className="w-full bg-[#0D0D0D] rounded-xl border border-[#f5f5f5]/8 overflow-hidden shadow-lg shadow-black/40">
      {/* Tabs Menu */}
      <div className="flex border-b border-[#f5f5f5]/8 bg-[#090909] overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-xs font-semibold border-r border-[#f5f5f5]/8 whitespace-nowrap transition-all ${
              activeTab === tab
                ? "bg-[#0D0D0D] text-[#F5F5F5] border-b-2 border-b-blue-500"
                : "text-zinc-500 hover:text-[#F5F5F5] hover:bg-[#f5f5f5]/[0.02]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className="p-2">
        {activeTab === "Estatísticas" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#f5f5f5]/5">
            
            {/* Column 1 */}
            <div className="flex flex-col py-2 md:py-0">
              {renderStatRow("Operações:", stats.trades)}
              
              {/* Profitability progress bar */}
              <div className="flex justify-between items-center py-2 px-4 text-xs font-mono border-b border-[#f5f5f5]/5">
                <span className="text-zinc-500 font-medium">Lucratividade:</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-rose-500/20 rounded overflow-hidden flex">
                    <div
                      style={{ width: `${stats.winRate}%` }}
                      className="bg-emerald-500 h-full"
                    />
                  </div>
                  <span className="text-[#F5F5F5] font-semibold">{stats.winRate.toFixed(0)}%</span>
                </div>
              </div>

              {renderStatRow("Pips Ganhas:", formatPips(stats.pips))}
              {renderStatRow(
                "Média de Ganho:",
                `${formatPips(stats.avgWinPips)} pips / ${formatMoney(stats.avgWinMoney)}`
              )}
              {renderStatRow(
                "Média de Perda:",
                `${formatPips(stats.avgLossPips)} pips / ${formatMoney(stats.avgLossMoney)}`
              )}
              {renderStatRow("Volume Total:", `${stats.lots.toFixed(2)} lotes`)}
              {renderStatRow("Comissões:", formatMoney(stats.commissions), false)}
            </div>

            {/* Column 2 */}
            <div className="flex flex-col py-2 md:py-0 md:px-1">
              {renderStatRow(
                "Compras Ganhas:",
                `(${stats.longsWonCount}/${stats.longsTotalCount}) ${stats.longsWinRate.toFixed(0)}%`
              )}
              {renderStatRow(
                "Vendas Ganhas:",
                `(${stats.shortsWonCount}/${stats.shortsTotalCount}) ${stats.shortsWinRate.toFixed(0)}%`
              )}
              
              {renderStatRow(
                "Melhor Operação ($):",
                stats.bestTradeMoney
                  ? `(${formatDate(stats.bestTradeMoney.date)}) ${formatMoney(stats.bestTradeMoney.val)}`
                  : "—"
              )}
              {renderStatRow(
                "Pior Operação ($):",
                stats.worstTradeMoney
                  ? `(${formatDate(stats.worstTradeMoney.date)}) ${formatMoney(stats.worstTradeMoney.val)}`
                  : "—"
              )}
              {renderStatRow(
                "Melhor Operação (Pips):",
                stats.bestTradePips
                  ? `(${formatDate(stats.bestTradePips.date)}) ${formatPips(stats.bestTradePips.val)}`
                  : "—"
              )}
              {renderStatRow(
                "Pior Operação (Pips):",
                stats.worstTradePips
                  ? `(${formatDate(stats.worstTradePips.date)}) ${formatPips(stats.worstTradePips.val)}`
                  : "—"
              )}
              {renderStatRow("Duração Média:", formatDuration(stats.avgTradeLengthSec), false)}
            </div>

            {/* Column 3 */}
            <div className="flex flex-col py-2 md:py-0 md:pl-2">
              {renderStatRow(
                "Fator de Lucro:",
                isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"
              )}
              {renderStatRow("Desvio Padrão:", formatMoney(stats.stdDev))}
              {renderStatRow("Índice de Sharpe:", stats.sharpeRatio.toFixed(2))}
              {renderStatRow(
                "Z-Score (Probabilidade):",
                `${stats.zScore} (${stats.zProbability.toFixed(2)}%)`
              )}
              {renderStatRow(
                "Expectativa Matemática:",
                `${formatPips(stats.expectancyPips)} Pips / ${formatMoney(stats.expectancyMoney)}`
              )}
              {renderStatRow("AHPR:", `${stats.ahpr.toFixed(2)}%`)}
              {renderStatRow("GHPR:", `${stats.ghpr.toFixed(2)}%`, false)}
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
}
