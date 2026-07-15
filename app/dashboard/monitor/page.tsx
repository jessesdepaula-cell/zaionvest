"use client";
import useSWR from "swr";
import { useState } from "react";
import { Activity, Cpu, ShieldAlert, ChevronDown, Copy, Check, Download, AlertCircle, ExternalLink } from "lucide-react";
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

export default function DashboardMonitorPage() {
  const [period, setPeriod] = useState("total");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data, mutate, isLoading } = useSWR(
    `/api/monitor/overview?period=${period}&accountId=${selectedAccountId}`,
    fetcher,
    { refreshInterval: 3000 }
  );

  const handleAccountChange = (id: string) => {
    setSelectedAccountId(id);
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center font-mono text-xs text-zinc-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Carregando telemetria em tempo real...
        </div>
      </div>
    );
  }

  if (data?.empty) {
    const monitorKey = data.userMonitorKey || "seu-id-de-usuario";
    return (
      <div className="mx-auto max-w-4xl py-10 px-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-blue-500">
          monitor_mt5::aguardando_conexao
        </div>
        <h1 className="text-3xl font-extrabold text-[#F5F5F5] tracking-tight mb-4">
          ZaionVest Monitor
        </h1>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          Monitore o saldo, capital líquido, drawdown e lucros acumulados de todas as suas contas reais e demo do MetaTrader 5 em tempo real pelo navegador, celular ou compartilhe o link público com investidores.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Instruções */}
          <div className="rounded-2xl border border-[#f5f5f5]/8 bg-[#0D0D0D] p-6 shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5] mb-4 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-xs text-blue-400">1</span>
              Como Configurar
            </h2>
            <ol className="space-y-4 text-xs text-zinc-400 list-decimal list-inside leading-relaxed">
              <li>
                Baixe o robô coletor de dados abaixo e copie o arquivo <code className="text-[#F5F5F5] bg-[#141414] px-1 py-0.5 rounded font-mono">.mq5</code>.
              </li>
              <li>
                Abra o MT5 → **Arquivo → Pasta de Dados**, e cole o arquivo dentro de <code className="text-[#F5F5F5] bg-[#141414] px-1 py-0.5 rounded font-mono">MQL5/Experts/</code>.
              </li>
              <li>
                No MetaEditor (F4), abra o arquivo e compile (F7).
              </li>
              <li>
                No MT5, vá em **Ferramentas → Opções → Experts**:
                <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                  <li>Marque a opção *Permitir WebRequest para as URLs listadas*</li>
                  <li>Adicione a URL: <code className="text-blue-400 font-mono">https://zaionvest.com.br</code></li>
                </ul>
              </li>
              <li>
                Arraste o robô <code className="text-[#F5F5F5] bg-[#141414] px-1 py-0.5 rounded font-mono">ZaionVest_Monitor</code> para qualquer gráfico e insira a sua **Chave de Monitoramento** no campo *ApiKey*.
              </li>
            </ol>
          </div>

          {/* Credenciais e Downloads */}
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-[#f5f5f5]/8 bg-[#0D0D0D] p-6 shadow-xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5] mb-4">
                Sua Chave de Monitoramento
              </h2>
              <p className="text-[11px] text-zinc-500 mb-3">
                Esta chave identifica a sua conta da ZaionVest de forma exclusiva. Insira ela nas propriedades do robô no MT5.
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-[#070707] p-2 border border-[#f5f5f5]/5">
                <code className="flex-1 font-mono text-[10px] text-blue-400 truncate">{monitorKey}</code>
                <button
                  onClick={() => copyToClipboard(monitorKey, setCopiedKey)}
                  className="rounded bg-[#141414] p-1.5 text-zinc-400 hover:bg-[#1C1C1C] hover:text-[#F5F5F5] transition"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <a
              href="/ZaionVest_Monitor.mq5"
              download
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Baixar ZaionVest_Monitor.mq5
            </a>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-4 flex gap-3 text-xs text-zinc-400 leading-relaxed">
            <AlertCircle className="h-5 w-5 text-blue-400 shrink-0" />
            <div>
              <strong className="text-[#F5F5F5] block mb-0.5">Uso Ilimitado</strong>
              A sua assinatura ZaionVest permite monitorar quantas contas e robôs você quiser simultaneamente sem qualquer custo adicional! Basta utilizar a mesma chave de monitoramento em todos os seus terminais MT5.
            </div>
          </div>

          <div className="rounded-xl bg-zinc-500/5 border border-zinc-500/10 p-4 flex gap-3 text-xs text-zinc-400 leading-relaxed">
            <AlertCircle className="h-5 w-5 text-zinc-500 shrink-0" />
            <div>
              <strong className="text-[#F5F5F5] block mb-0.5">Link Externo de Compartilhamento</strong>
              Como cada usuário tem o seu próprio monitor de contas dedicado, o seu link de visualização externa pública (que você poderá enviar para investidores ou acessar do celular sem login) ficará disponível no topo direito deste painel assim que o seu robô no MT5 se conectar pela primeira vez.
            </div>
          </div>
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

  const isConsolidated = selectedAccountId === "all";
  const publicLink = typeof window !== "undefined" ? `${window.location.origin}/monitor/${acc.id}` : "";

  return (
    <div className="space-y-6">
      {/* Header do Monitor com Seletor e Link de Compartilhamento */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f5f5f5]/5 pb-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-blue-500 flex items-center gap-2 mb-1.5">
            <span>monitor_mt5::telemetria_ao_vivo</span>
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
            Servidor: {acc.server ?? "—"} · Alavancagem: {acc.leverage ? `1:${acc.leverage}` : "—"} · Licença Ativa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Contas */}
          {data?.accounts && data.accounts.length > 1 && (
            <div className="relative inline-flex items-center">
              <select
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="appearance-none rounded-lg border border-[#f5f5f5]/8 bg-[#0D0D0D] pl-3 pr-8 py-1.5 font-mono text-xs text-[#F5F5F5] outline-none cursor-pointer hover:bg-[#141414] focus:border-blue-500/50 transition uppercase tracking-wider"
              >
                <option value="all">Todas as Contas</option>
                {data.accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.broker ? `${a.broker} · ` : ""}{a.login}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 text-zinc-500 pointer-events-none" />
            </div>
          )}

          {/* Link Público */}
          {!isConsolidated && (
            <div className="flex items-center gap-2 rounded-lg border border-[#f5f5f5]/8 bg-[#0D0D0D] p-1.5 pr-3 shadow-inner">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1.5">Link Externo:</span>
              <code className="text-[10px] font-mono text-blue-400 truncate max-w-[150px]">{publicLink}</code>
              <button
                onClick={() => copyToClipboard(publicLink, setCopiedLink)}
                className="rounded bg-[#141414] p-1 text-zinc-400 hover:bg-[#1C1C1C] hover:text-[#F5F5F5] transition"
              >
                {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
              <a
                href={`/monitor/${acc.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-500 hover:text-blue-400 transition"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
      </header>

      {/* Grid de KPIs e Curva de Capital */}
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

      {/* Tabela de Períodos e Estatísticas Avançadas */}
      <section className="grid grid-cols-1 gap-6">
        <TradingPeriodsTable periods={data.periodsTable} currency={currency} />
      </section>

      <section className="grid grid-cols-1 gap-6">
        <AdvancedStatistics stats={data.advancedStats} currency={currency} />
      </section>

      {/* Gráficos Mensais e Por Robô */}
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

      {/* Tabelas de Operações Ativas e Fechadas */}
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
    </div>
  );
}
