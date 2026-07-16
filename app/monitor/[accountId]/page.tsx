"use client";
import useSWR from "swr";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, Cpu, ShieldAlert, Copy, Check, AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MetricCard } from "@/components/monitor/MetricCard";
import { PeriodFilter } from "@/components/monitor/PeriodFilter";
import { Panel } from "@/components/monitor/Panel";
import {
  CapitalCurveChart,
  DrawdownChart,
  ProfitBarChart,
  ReturnChart,
  RobotPerformanceChart,
} from "@/components/monitor/Charts";
import { OpenPositionsTable, ClosedTradesTable } from "@/components/monitor/Tables";
import { fmtInt, fmtMoney, fmtPct, classForDelta } from "@/lib/monitorFormat";
import { TradingPeriodsTable } from "@/components/monitor/TradingPeriodsTable";
import { AdvancedStatistics } from "@/components/monitor/AdvancedStatistics";
import { AccountSidebar } from "@/components/monitor/AccountSidebar";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const formatMonthTick = (tick: string) => {
  try {
    const [year, month] = tick.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    const monthName = date.toLocaleDateString("pt-BR", { month: "long" });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  } catch {
    return tick;
  }
};

const AXIS = { fontSize: 9, fill: "#71717a", fontFamily: "monospace" };

export default function PublicMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;

  const [period, setPeriod] = useState("total");
  const [copiedLink, setCopiedLink] = useState(false);

  const { data, mutate, isLoading } = useSWR(
    `/api/monitor/overview?period=${period}&publicAccountId=${accountId}`,
    fetcher,
    { refreshInterval: 4000 }
  );

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading && !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-charcoal text-offwhite font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Conectando ao terminal MT5...
        </div>
      </div>
    );
  }

  if (!data || !data.account) {
    return (
      <div className="flex h-screen items-center justify-center bg-charcoal text-offwhite p-6">
        <div className="max-w-md rounded-2xl border border-[#f5f5f5]/8 bg-[#0D0D0D] p-6 shadow-xl text-center">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-[#F5F5F5] mb-1">Conta Inativa ou Não Encontrada</h1>
          <p className="text-xs text-zinc-500 mb-4">
            Não recebemos dados de monitoramento para este ID de conta ainda.
          </p>
          <Link href="/" className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white">
            Ir para ZaionVest
          </Link>
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const live = data.live;
  const acc = data.account;
  const currency: string = acc.currency ?? "USD";
  
  const robotsForChart = (data.robots ?? []).map((r: any) => ({
    label: r.label ?? `Magic ${r.magic}`,
    netProfit: Number(r.netProfit),
  }));

  const isDemo =
    (acc.server ?? "").toLowerCase().includes("demo") ||
    (acc.broker ?? "").toLowerCase().includes("demo") ||
    (acc.login ?? "").toLowerCase().includes("demo");

  const publicLink = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen bg-charcoal text-offwhite flex flex-col">
      {/* Topbar Pública com Marca */}
      <header className="sticky top-0 z-30 border-b border-[#f5f5f5]/5 bg-charcoal/85 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/logo-mark.png"
            alt=""
            width={32}
            height={32}
            className="h-6 w-6"
            style={{ mixBlendMode: "lighten" }}
          />
          <span className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
            ZaionVest Monitor
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => mutate()}
            className="rounded-full p-1.5 text-zinc-500 hover:text-[#F5F5F5] transition"
            title="Atualizar agora"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-[#f5f5f5]/8 bg-[#0D0D0D] p-1 pr-2">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider pl-1">Partilhar:</span>
            <button
              onClick={() => copyToClipboard(publicLink, setCopiedLink)}
              className="rounded bg-[#141414] p-1 text-zinc-500 hover:bg-[#1C1C1C] hover:text-[#F5F5F5] transition"
            >
              {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-6 md:p-8 max-w-[1500px] mx-auto w-full space-y-6">
        {/* Info da Conta */}
        <section className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f5f5f5]/5 pb-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-blue-500 flex items-center gap-2 mb-1">
              <span>monitor_mt5::public_view</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-normal ${
                isDemo
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}>
                {isDemo ? "Demo" : "Conta Real"}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">
              Conta {acc.login} · <span className="text-zinc-500 text-lg font-normal">{acc.broker ?? "Corretora"}</span>
            </h1>
            <p className="text-[11px] text-zinc-500 mt-1">
              Servidor: {acc.server ?? "—"} · Alavancagem: {acc.leverage ? `1:${acc.leverage}` : "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Contas (mesma experiência da área de membros) */}
            {data?.accounts && data.accounts.length > 1 && (
              <div className="relative inline-flex items-center">
                <select
                  value={accountId}
                  onChange={(e) => router.push(`/monitor/${e.target.value}`)}
                  className="appearance-none rounded-lg border border-[#f5f5f5]/8 bg-[#0D0D0D] pl-3 pr-8 py-1.5 font-mono text-xs text-[#F5F5F5] outline-none cursor-pointer hover:bg-[#141414] focus:border-blue-500/50 transition uppercase tracking-wider"
                >
                  {data.accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.broker ? `${a.broker} · ` : ""}{a.login}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 text-zinc-500 pointer-events-none" />
              </div>
            )}
            <PeriodFilter value={period} onChange={setPeriod} />
          </div>
        </section>

        {/* KPIs e Gráficos */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 h-full">
            <AccountSidebar data={data} />
          </div>
          <div className="lg:col-span-3 h-full">
            <Panel
              title="Curva de Capital (Saldo vs Capital Líquido)"
              className="h-full min-h-[350px]"
              right={
                <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-blue-500 inline-block" /> Saldo</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-cyan-500 inline-block" /> Capital</span>
                </div>
              }
            >
              <div className="w-full h-[320px]">
                <CapitalCurveChart data={data.series.capital} />
              </div>
            </Panel>
          </div>
        </section>

        {/* Cartões Rápidos */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Saldo Atual" value={fmtMoney(live.balance, currency)} big />
          <MetricCard label="Capital Líquido" value={fmtMoney(live.equity, currency)} accent big />
          <MetricCard
            label="PnL Flutuante"
            value={fmtMoney(live.floatingPnL, currency)}
            big
            hint={live.floatingPnL >= 0 ? "Resultados flutuando no positivo" : "Resultados flutuando no negativo"}
          />
          <MetricCard label="Margem Usada" value={fmtMoney(live.margin, currency)} />
          <MetricCard label="Posições Abertas" value={fmtInt(live.openPositions)} />
          <MetricCard label="Capital em Risco" value={fmtMoney(k.openValue, currency)} />
        </section>

        {/* Períodos e Avançados */}
        <section className="grid grid-cols-1 gap-6">
          <TradingPeriodsTable periods={data.periodsTable} currency={currency} />
        </section>

        <section className="grid grid-cols-1 gap-6">
          <AdvancedStatistics stats={data.advancedStats} currency={currency} />
        </section>

        {/* Gráficos Mensais e por Robô */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel title="Lucro Diário">
            <ProfitBarChart data={data.series.daily} />
          </Panel>
          <Panel title="Lucro Semanal">
            <ProfitBarChart data={data.series.weekly} />
          </Panel>
          <Panel title="Lucro Mensal">
            <ProfitBarChart data={data.series.monthly} tickFormatter={formatMonthTick} />
          </Panel>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Curva de Retorno %">
            <ReturnChart data={data.series.returnPct} />
          </Panel>
          <Panel
            title="Performance por Robô (Magic Number)"
            right={<Cpu size={14} className="text-zinc-500" />}
          >
            {robotsForChart.length ? (
              <RobotPerformanceChart data={robotsForChart} />
            ) : (
              <div className="py-12 text-center font-mono text-xs text-zinc-500">
                Sem dados de Magic Number fechados ainda
              </div>
            )}
          </Panel>
        </section>

        {/* Tabelas de Operações */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel
            title={`Posições Abertas no MT5 (${data.positions.length})`}
            right={<Activity size={14} className="text-blue-400" />}
          >
            <OpenPositionsTable rows={data.positions} currency={currency} />
          </Panel>
          <Panel
            title="Últimas 100 Operações Fechadas"
            right={<ShieldAlert size={14} className="text-zinc-500" />}
          >
            <ClosedTradesTable rows={data.trades} currency={currency} />
          </Panel>
        </section>
      </main>

      {/* Footer Público */}
      <footer className="border-t border-[#f5f5f5]/5 py-6 text-center font-mono text-[9px] uppercase tracking-widest text-zinc-600">
        modo leitura · nenhuma ordem é enviada · zaionvest v1.0
      </footer>
    </div>
  );
}
