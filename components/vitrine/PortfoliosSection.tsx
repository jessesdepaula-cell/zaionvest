"use client";

import { useState } from "react";
import { ShieldCheck, Zap, Scale, CheckCircle2, ChevronRight, Layers, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface PortfolioItem {
  id: string;
  name: string;
  category: "conservador" | "moderado" | "agressivo";
  tagline: string;
  retDd: string;
  profitFactor: string;
  maxDrawdown: string;
  description: string;
  robots: Array<{
    symbol: string;
    timeframe: string;
    style: string;
    reason: string;
  }>;
}

const PORTFOLIOS: PortfolioItem[] = [
  {
    id: "cons-1",
    name: "Conservador #1 — Blindagem & Baixa Volatilidade",
    category: "conservador",
    tagline: "Foco em menor rebaixamento (DD < 13%) e alta estabilidade de curva.",
    retDd: "3.8x",
    profitFactor: "1.34",
    maxDrawdown: "12.4%",
    description: "Combina ativos de baixa volatilidade em timeframes maiores (H4), protegendo o patrimônio contra oscilações abruptas.",
    robots: [
      { symbol: "XAUUSD", timeframe: "H4", style: "Tendência", reason: "Seguidor de tendência longo com filtro ATR" },
      { symbol: "XAGUSD", timeframe: "H4", style: "Reversão", reason: "Entradas extremas RSI com Stop Fixo" },
      { symbol: "USDJPY", timeframe: "H1", style: "Rompimento", reason: "Rompimento de volatilidade Bollinger" },
    ],
  },
  {
    id: "cons-2",
    name: "Conservador #2 — Estabilidade Multi-Ativos H4",
    category: "conservador",
    tagline: "Diversificação global em H4 para crescimento consistente e seguro.",
    retDd: "4.1x",
    profitFactor: "1.38",
    maxDrawdown: "14.1%",
    description: "Opera 3 frentes descorrelacionadas (Euro-Ouro, Dólar Australiano e Bitcoin em H4) mantendo controle total de risco.",
    robots: [
      { symbol: "XAUEUR", timeframe: "H4", style: "Tendência", reason: "Filtro T3 Velocity + Leque de EMAs" },
      { symbol: "AUDUSD", timeframe: "H2", style: "Reversão", reason: "Extremo RSI + WPR Floating" },
      { symbol: "BTCUSD", timeframe: "H4", style: "Tendência", reason: "Tendência macro de Cripto em H4" },
    ],
  },
  {
    id: "mod-1",
    name: "Moderado #1 — Equilíbrio Dinâmico Ouro & Cripto",
    category: "moderado",
    tagline: "Excelente relação Retorno/Drawdown com diversificação Ouro + Bitcoin.",
    retDd: "5.2x",
    profitFactor: "1.42",
    maxDrawdown: "18.5%",
    description: "Captura movimentações fortes do mercado de metais e criptoativos equilibrando com a estabilidade do AUDUSD em H1.",
    robots: [
      { symbol: "XAUUSD", timeframe: "H1", style: "Tendência", reason: "SuperTrend + Histograma MACD" },
      { symbol: "BTCUSD", timeframe: "H1", style: "Rompimento", reason: "Cruzamento MACD + Momentum" },
      { symbol: "AUDUSD", timeframe: "H1", style: "Reversão", reason: "Reversão à média com filtro de volatilidade" },
    ],
  },
  {
    id: "mod-2",
    name: "Moderado #2 — Multi-Estilo Tendência & Reversão",
    category: "moderado",
    tagline: "Descorrelação perfeita combinando estratégias de tendência e reversão.",
    retDd: "4.8x",
    profitFactor: "1.40",
    maxDrawdown: "17.2%",
    description: "Utiliza diferentes estilos operacionais para que quando um estilo esteja em consolidação, o outro compense os ganhos.",
    robots: [
      { symbol: "XAGUSD", timeframe: "H2", style: "Tendência", reason: "Canal Donchian + Momentum" },
      { symbol: "EURUSD", timeframe: "H4", style: "Rompimento", reason: "Rompimento de canais institucionais" },
      { symbol: "XAUUSD", timeframe: "H2", style: "Reversão", reason: "Retorno à média com Stop Fixo ATR" },
    ],
  },
  {
    id: "agr-1",
    name: "Agressivo #1 — Alta Performance & Rápida Recuperação",
    category: "agressivo",
    tagline: "Foco em aceleração de capital com Fator de Recuperação elevado (7.4x).",
    retDd: "7.4x",
    profitFactor: "1.48",
    maxDrawdown: "23.8%",
    description: "Maximiza os ganhos aproveitando a alta frequência e volatilidade de H1 em Ouro, Bitcoin e EURNZD.",
    robots: [
      { symbol: "XAUUSD", timeframe: "H1", style: "Tendência", reason: "SuperTrend rápida com Gain expansivo" },
      { symbol: "BTCUSD", timeframe: "H1", style: "Tendência", reason: "Seguidor de tendência de alta volatilidade" },
      { symbol: "EURNZD", timeframe: "H1", style: "Reversão", reason: "Extremos de canal com Stop Curto" },
    ],
  },
  {
    id: "agr-2",
    name: "Agressivo #2 — Máximo Retorno OOS (Holdout)",
    category: "agressivo",
    tagline: "Máximo aproveitamento do holdout para gerar maior lucro absoluto.",
    retDd: "8.1x",
    profitFactor: "1.54",
    maxDrawdown: "24.9%",
    description: "Configuração de alta frequência ideal para contas que buscam maximizar o crescimento no médio e longo prazo.",
    robots: [
      { symbol: "XAUUSD", timeframe: "H1", style: "Rompimento", reason: "Rompimento de máxima/mínima histórico" },
      { symbol: "XAGUSD", timeframe: "H1", style: "Tendência", reason: "Leque de Médias + Momentum" },
      { symbol: "BTCUSD", timeframe: "H1", style: "Breakout", reason: "Breakout de consolidação com Stop ATR" },
    ],
  },
];

export function PortfoliosSection() {
  const [activeTab, setActiveTab] = useState<"todos" | "conservador" | "moderado" | "agressivo">("todos");

  const filteredPortfolios = activeTab === "todos"
    ? PORTFOLIOS
    : PORTFOLIOS.filter((p) => p.category === activeTab);

  return (
    <div className="mb-10 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-zinc-800/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-5 w-5 text-[#2563EB]" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Portfólios Prontos ZaionVest
            </h2>
            <span className="rounded-full bg-[#2563EB]/10 border border-[#2563EB]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#2563EB]">
              RECOMENDADOS
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Combinações pré-testadas e descorrelacionadas para dar clareza de montagem de carteira segundo seu perfil de risco.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl bg-zinc-900/90 p-1 border border-zinc-800/80 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("todos")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "todos"
                ? "bg-[#2563EB] text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Todos (6)
          </button>
          <button
            onClick={() => setActiveTab("conservador")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === "conservador"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-zinc-400 hover:text-emerald-400"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Conservador
          </button>
          <button
            onClick={() => setActiveTab("moderado")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === "moderado"
                ? "bg-cyan-600 text-white shadow-md"
                : "text-zinc-400 hover:text-cyan-400"
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
            Moderado
          </button>
          <button
            onClick={() => setActiveTab("agressivo")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === "agressivo"
                ? "bg-amber-600 text-white shadow-md"
                : "text-zinc-400 hover:text-amber-400"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Agressivo
          </button>
        </div>
      </div>

      {/* Grid de Portfólios */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredPortfolios.map((portfolio) => {
          const isCons = portfolio.category === "conservador";
          const isMod = portfolio.category === "moderado";
          const isAgr = portfolio.category === "agressivo";

          const badgeBg = isCons
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : isMod
            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
            : "bg-amber-500/10 border-amber-500/30 text-amber-400";

          const IconComp = isCons ? ShieldCheck : isMod ? Scale : Zap;

          return (
            <div
              key={portfolio.id}
              className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#09090b] p-5 transition hover:border-zinc-700 hover:shadow-lg hover:shadow-[#2563EB]/[0.02]"
            >
              <div>
                {/* Header do Card */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${badgeBg}`}>
                    <IconComp className="h-3 w-3" />
                    {portfolio.category}
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-500">
                    3 EAs Recomendados
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">
                  {portfolio.name}
                </h3>
                <p className="text-xs text-zinc-400 mb-4 line-clamp-2 leading-relaxed">
                  {portfolio.tagline}
                </p>

                {/* Métricas Combinadas */}
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-900/80 p-3 mb-4 border border-zinc-800/60 text-center">
                  <div>
                    <div className="text-[10px] font-medium text-zinc-500 uppercase">Ret/DD Est.</div>
                    <div className="text-xs font-black text-emerald-400 mt-0.5">{portfolio.retDd}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-zinc-500 uppercase">Profit Factor</div>
                    <div className="text-xs font-black text-cyan-400 mt-0.5">{portfolio.profitFactor}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-zinc-500 uppercase">Drawdown Máx</div>
                    <div className="text-xs font-black text-amber-400 mt-0.5">{portfolio.maxDrawdown}</div>
                  </div>
                </div>

                {/* Robôs Integrantes */}
                <div className="space-y-2 mb-4">
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Composição da Carteira:
                  </div>
                  {portfolio.robots.map((r, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-zinc-950 px-2.5 py-1.5 rounded border border-zinc-800/40"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                        <span className="font-bold text-zinc-200">{r.symbol}</span>
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">{r.timeframe}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">{r.style}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botão de Seleção/Filtro */}
              <Link
                href={`/dashboard/vitrine?symbol=${portfolio.robots[0].symbol}`}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-[#2563EB]/40 bg-[#2563EB]/10 px-3 py-2 text-xs font-bold text-[#2563EB] transition hover:bg-[#2563EB] hover:text-white"
              >
                Ver Robôs desta Carteira
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
