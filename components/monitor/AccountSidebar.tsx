"use client";
import React from "react";

interface AccountSidebarProps {
  data: {
    account: {
      initialBalance: number;
      currency: string;
    };
    live: {
      balance: number;
      equity: number;
      ts: string | null;
    };
    kpis: {
      totalReturnPct: number;
      totalProfit: number;
      maxDrawdownPct: number;
      deposits?: number | null;
      withdrawals?: number | null;
      interest?: number;
      daysOperating: number;
      highestEquity?: {
        val: number;
        date: string;
      };
      compoundedDailyReturnPct?: number;
      averageWeeklyReturnPct?: number;
      averageMonthlyReturnPct?: number;
    };
  };
}

export function AccountSidebar({ data }: AccountSidebarProps) {
  if (!data) return null;

  const { account, live, kpis } = data;
  const currency = account.currency ?? "USD";

  // Formatter for currency in Portuguese (pt-BR)
  const formatMoney = (val: number) => {
    const symbol = currency === "BRL" ? "R$" : currency === "USD" ? "$" : currency + " ";
    const absVal = Math.abs(val);
    const formatted = absVal.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${val < 0 ? "-" : ""}${symbol}${formatted}`;
  };

  // Formatter for percentage
  const formatPct = (val: number, showSign = false) => {
    const sign = showSign && val >= 0 ? "+" : "";
    return `${sign}${val.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  };

  // Depósitos/saques REAIS enviados pelo EA (v1.10+). Quando disponíveis,
  // usamos a identidade contábil real: Saldo = Depósitos − Retiradas + Lucro.
  // Caso contrário, caímos no modo estimado antigo (saldo − lucro dos trades).
  const hasRealFlows = kpis.deposits != null;
  const realDeposits = kpis.deposits ?? 0;
  const realWithdrawals = kpis.withdrawals ?? 0;
  const netDeposits = realDeposits - realWithdrawals;

  // Lucro acumulado real (todo o histórico) = saldo atual − aporte líquido.
  const profit = hasRealFlows ? (live.balance - netDeposits) : (kpis.totalProfit ?? 0);
  const deposits = hasRealFlows ? realDeposits : (live.balance - profit);
  const withdrawals = hasRealFlows ? realWithdrawals : 0;

  const initial = hasRealFlows
    ? (netDeposits > 0 ? netDeposits : 1)
    : (deposits > 0 ? deposits : (account.initialBalance ?? 1));
  const absGain = initial > 0 ? (profit / initial) * 100 : 0;

  // Gain (topo): com dados reais, alinha ao retorno absoluto sobre o aporte;
  // senão, mantém o retorno já calculado no backend.
  const gain = hasRealFlows ? absGain : (kpis.totalReturnPct ?? 0);

  // Calculating Daily and Monthly returns
  const days = kpis.daysOperating || 1;
  const dailyCompounded = kpis.compoundedDailyReturnPct ?? 0;
  const weeklyCompounded = kpis.averageWeeklyReturnPct ?? 0;
  const monthlyCompounded = kpis.averageMonthlyReturnPct ?? 0;

  // Drawdown
  const drawdown = kpis.maxDrawdownPct ?? 0;

  // Equity details
  const equityPct = live.balance > 0 ? (live.equity / live.balance) * 100 : 100;

  // Highest (peak) equity
  const highestVal = kpis.highestEquity?.val ?? live.balance;
  const highestDateStr = kpis.highestEquity?.date;
  let formattedHighestDate = "";
  if (highestDateStr) {
    try {
      const d = new Date(highestDateStr);
      formattedHighestDate = d.toLocaleDateString("pt-BR", { month: "short", day: "numeric" }).replace(".", "");
    } catch {
      formattedHighestDate = "";
    }
  }

  // Interest (swap)
  const interest = kpis.interest ?? 0;

  // Updated time text
  const getUpdatedText = (ts: string | null) => {
    if (!ts) return "—";
    const diffMs = Date.now() - new Date(ts).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return "menos de 1 minuto";
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) {
      return diffMins === 1 ? "1 minuto atrás" : `${diffMins} minutos atrás`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return diffHours === 1 ? "1 hora atrás" : `${diffHours} horas atrás`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return diffDays === 1 ? "1 dia atrás" : `${diffDays} dias atrás`;
  };

  const renderRow = (
    label: string,
    value: React.ReactNode,
    tooltip?: string,
    dottedLabel = false
  ) => {
    return (
      <div className="flex justify-between items-center py-2 text-xs font-mono">
        {dottedLabel && tooltip ? (
          <span
            className="text-zinc-500 font-medium border-b border-dashed border-zinc-700 cursor-help hover:text-zinc-300 transition"
            title={tooltip}
          >
            {label}
          </span>
        ) : (
          <span className="text-zinc-500 font-medium">{label}</span>
        )}
        <span className="text-[#F5F5F5] font-semibold text-right">{value}</span>
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-[#0D0D0D] rounded-xl border border-[#f5f5f5]/8 p-4 shadow-lg shadow-black/40 flex flex-col justify-between divide-y divide-[#f5f5f5]/5">
      {/* Section 1: Gains */}
      <div className="pb-3">
        {renderRow(
          "Ganho:",
          <span className={gain >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
            {formatPct(gain, true)}
          </span>,
          "Retorno ponderado pelo tempo (TWR) acumulado da conta.",
          true
        )}
        {renderRow(
          "Ganho Absoluto:",
          <span className={absGain >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
            {formatPct(absGain, true)}
          </span>,
          "Retorno absoluto baseado no lucro total dividido pelo depósito inicial.",
          true
        )}
      </div>

      {/* Section 2: Compounded Rates */}
      <div className="py-3">
        {renderRow(
          "Diário:",
          <span>{formatPct(dailyCompounded)}</span>,
          "Retorno médio diário composto.",
          true
        )}
        {renderRow(
          "Semanal:",
          <span>{formatPct(weeklyCompounded)}</span>,
          "Retorno médio semanal.",
          true
        )}
        {renderRow(
          "Mensal:",
          <span>{formatPct(monthlyCompounded)}</span>,
          "Retorno médio mensal composto.",
          true
        )}
        {renderRow(
          "Rebaixamento Max:",
          <span className="text-rose-400">{formatPct(drawdown)}</span>,
          "Maior queda histórica (Drawdown) medida do pico ao vale.",
          true
        )}
      </div>

      {/* Section 3: Live Values */}
      <div className="py-3">
        {renderRow("Saldo Atual:", <span>{formatMoney(live.balance)}</span>)}
        {renderRow(
          "Capital Líquido:",
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-[10px] text-zinc-500">({formatPct(equityPct)})</span>
            <span>{formatMoney(live.equity)}</span>
          </div>
        )}
        {renderRow(
          "Máximo (Peak):",
          <div className="flex items-center gap-1.5 justify-end">
            {formattedHighestDate && (
              <span className="text-[10px] text-zinc-500 capitalize">({formattedHighestDate})</span>
            )}
            <span>{formatMoney(highestVal)}</span>
          </div>
        )}
        {renderRow(
          "Lucro Acumulado:",
          <span className={profit >= 0 ? "text-emerald-400" : "text-rose-400"}>
            {formatMoney(profit)}
          </span>
        )}
        {renderRow("Tempo Ativo:", <span>{days === 1 ? "1 dia" : `${days} dias`}</span>)}
      </div>

      {/* Section 4: Flows */}
      <div className="py-3">
        {renderRow("Depósitos:", <span>{formatMoney(deposits)}</span>)}
        {renderRow("Retiradas:", <span>{formatMoney(withdrawals)}</span>)}
      </div>

      {/* Section 5: Metadata */}
      <div className="pt-3">
        {renderRow("Telemetria:", <span className="text-zinc-500">{getUpdatedText(live.ts)}</span>)}
      </div>
    </div>
  );
}
