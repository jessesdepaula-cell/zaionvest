"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/InfoTip";
import { ChevronDown, ChevronRight, Clock, Target, TrendingDown, TrendingUp, Radio, AlertCircle } from "lucide-react";
import { SmcChecklist } from "./SmcChecklist";
import { ClassicoChecklist } from "./ClassicoChecklist";
import { SignalChart, type ChartCandle } from "./SignalChart";

export type SignalData = {
  id: string;
  symbol: string;
  timeframe: string;
  mode: string;
  hasSetup: boolean;
  direction: string | null;
  probability: number | null;
  confidence: string | null;
  entryPrice: number | null;
  stopPrice: number | null;
  target1: number | null;
  target2: number | null;
  target3: number | null;
  recommendedTarget: number | null;
  riskReward: string | null;
  structure: string | null;
  justification: string | null;
  status: string;
  exitPrice: number | null;
  rMultiple: number | null;
  scannedAt: string;
  filledAt: string | null;
  closedAt: string | null;
  candleData: ChartCandle[] | null;
  tipoSetup: string | null;
  checklistSmc: Record<string, boolean> | null;
  checklistClassico: Record<string, boolean> | null;
};

export function SignalCard({ signal: s, defaultExpanded }: { signal: SignalData; defaultExpanded?: boolean }) {
  if (!s.hasSetup) return <NoSetupRow signal={s} />;
  return <ActiveCard signal={s} defaultExpanded={defaultExpanded} />;
}

function ActiveCard({ signal: s, defaultExpanded }: { signal: SignalData; defaultExpanded?: boolean }) {

  const isBuy = s.direction?.startsWith("COMPRA");
  const meta = directionMeta(s.direction);
  const statusMeta = statusBadge(s.status);
  const target = pickTarget(s);

  // Estado local de velas para suportar atualização em tempo real
  const [candles, setCandles] = useState<ChartCandle[] | null>(s.candleData);

  useEffect(() => {
    // Apenas faz o fetch de velas novas para sinais ativos (PENDING / FILLED)
    if (s.status !== "PENDING" && s.status !== "FILLED") return;

    let active = true;
    async function loadRealtimeCandles() {
      try {
        const r = await fetch(
          `/api/market/candles?symbol=${encodeURIComponent(s.symbol)}&tf=${s.timeframe}&limit=500`
        );
        if (!r.ok) return;
        const data = await r.json();
        if (active && Array.isArray(data.candles)) {
          setCandles(data.candles);
        }
      } catch (err) {
        console.error("Erro ao carregar candles atualizados:", err);
      }
    }

    loadRealtimeCandles();
    
    // Atualiza a cada 30 segundos
    const interval = setInterval(loadRealtimeCandles, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [s.symbol, s.timeframe, s.status]);

  // Default: expandido para sinais ativos (PENDING/FILLED), colapsado para fechados.
  // Persistimos a escolha do usuário em localStorage por par|tf|modo para que o
  // auto-refresh (router.refresh a cada 30s) e novos sinais entrando no mesmo
  // par NÃO fechem o card. Só recolhe se o usuário clicar.
  // Sinais CONCLUÍDOS (WIN/LOSS/EXPIRED) usam chave própria por id: eles saem
  // do palco e NÃO devem herdar o "expandido" do par de quando estavam ativos.
  const isClosedSignal = s.status === "WIN" || s.status === "LOSS" || s.status === "EXPIRED";
  const storageKey = isClosedSignal
    ? `tv:expanded:closed:${s.id}`
    : `tv:expanded:${s.symbol}|${s.timeframe}|${s.mode}`;
  const defaultInitial =
    defaultExpanded ?? (s.status === "PENDING" || s.status === "FILLED");
  const [expanded, setExpanded] = useState<boolean>(defaultInitial);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "1") setExpanded(true);
    else if (saved === "0") setExpanded(false);
  }, [storageKey]);
  function toggleExpanded() {
    setExpanded((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition",
        s.status === "WIN" && "border-emerald-500/30 bg-emerald-500/[0.04]",
        s.status === "LOSS" && "border-rose-500/30 bg-rose-500/[0.04]",
        s.status === "FILLED" && "border-amber-500/30 bg-amber-500/[0.04]",
        s.status === "PENDING" && "border-white/10 bg-white/[0.02]",
      )}
    >
      {/* Header (clicável para expandir/colapsar) */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
          )}
          <span className="num text-sm font-medium text-offwhite">{s.symbol}</span>
          <span className="num text-[10px] text-zinc-500">· {s.timeframe}</span>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest",
              s.mode === "SMC"
                ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
                : "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
            )}
          >
            {s.mode === "SMC" ? "SMC" : "Clássico"}
          </span>
          {!expanded && (
            <>
              <span className={cn("ml-2 text-xs font-medium", meta.text)}>
                {meta.label}
              </span>
              {s.probability !== null && (
                <span className={cn("num text-xs", meta.text)}>· {s.probability}%</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!expanded && (s.status === "WIN" || s.status === "LOSS") && s.rMultiple !== null && (
            <span
              className={cn(
                "num text-xs font-medium",
                s.rMultiple > 0 ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {s.rMultiple > 0 ? "+" : ""}
              {s.rMultiple.toFixed(2)}R
            </span>
          )}
          <span className={cn("rounded-md border px-2 py-0.5 text-[9px] uppercase tracking-widest", statusMeta.cls)}>
            {statusMeta.label}
          </span>
          {statusMeta.hint && <InfoTip text={statusMeta.hint} align="right" />}
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
            <Clock className="h-3 w-3" />
            {timeAgo(s.scannedAt)}
          </span>
        </div>
      </button>
 
      {!expanded && null}

      {/* Gráfico de candles ao topo — SOMENTE para sinais ativos.
          Sinal concluído (Ganho/Perda/Expirado) NÃO plota mais E/SL/TPs:
          as marcações saem da tela e o gráfico do par fica liberado para a
          próxima detecção (visível no Radar / no próximo sinal ativo). */}
      {expanded && !isClosedSignal && candles && candles.length > 0 && (
        <div className="border-b border-white/5 p-4">
          <SignalChart
            candles={candles}
            symbol={s.symbol}
            isBuy={!!isBuy}
            entry={s.entryPrice}
            stop={s.stopPrice}
            target={target}
            targets={[s.target1, s.target2, s.target3]}
            recommendedTarget={s.recommendedTarget}
            status={s.status}
            exitPrice={s.exitPrice}
            rMultiple={s.rMultiple}
            scannedAt={s.scannedAt}
            timeframe={s.timeframe}
            defaultShowMA={s.mode === "CLASSICO"}
            defaultShowSmc={s.mode === "SMC"}
          />
        </div>
      )}
      {expanded && isClosedSignal && (
        <div className="border-b border-white/5 px-4 py-2.5 text-[11px] text-zinc-500">
          Sinal concluído — as marcações de entrada, stop e alvos foram removidas do
          gráfico. O par voltou ao radar, liberado para a próxima oportunidade.
        </div>
      )}

      {expanded && (
        <div className="p-4 space-y-4">

          {/* ── DIREÇÃO PRINCIPAL ── */}
          <div className={cn(
            "rounded-xl border p-4 flex items-center justify-between gap-4",
            isBuy
              ? "border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.08] to-emerald-500/[0.02]"
              : "border-rose-500/25 bg-gradient-to-r from-rose-500/[0.08] to-rose-500/[0.02]"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-2xl",
                isBuy
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              )}>
                {isBuy ? "▲" : "▼"}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Sinal da IA</p>
                <p className={cn(
                  "text-xl font-extrabold tracking-tight mt-0.5",
                  isBuy ? "text-emerald-300" : "text-rose-300"
                )}>
                  {meta.label}
                </p>
                {s.tipoSetup && (
                  <p className="mt-0.5 text-[10px] text-zinc-500">{s.tipoSetup}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              {s.probability !== null && (
                <div>
                  <p className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-widest text-zinc-500">
                    Probabilidade
                    <InfoTip
                      align="right"
                      text="Calculada pelas confluências técnicas confirmadas no checklist (regras do método, não opinião): 6/6 = ~82% (sinal forte), 5/6 = ~66% (moderado), 4/6 = ~48% (em formação — exige mais cautela e confirmação)."
                    />
                  </p>
                  <p className={cn("num text-2xl font-bold mt-0.5", meta.text)}>{s.probability}%</p>
                </div>
              )}
              {s.confidence && (
                <p className="mt-1 text-[10px] text-zinc-500">Conf: <span className="text-zinc-300">{s.confidence}</span></p>
              )}
            </div>
          </div>

          {/* ── LINHA DO TEMPO DO SINAL (prova de antecipação) ── */}
          <SignalTimeline signal={s} />

          {/* Barra de probabilidade */}
          {s.probability !== null && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={cn("h-full rounded-full transition-all", meta.bar)}
                style={{ width: `${Math.min(s.probability, 100)}%` }}
              />
            </div>
          )}

          {/* ── PLANO DE TRADE COMPLETO ── */}
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">Plano de trade</p>

            {/* Entrada */}
            <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                  <Target className="h-3.5 w-3.5 text-zinc-300" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500">Entrada</p>
                  <p className="text-[11px] text-zinc-400">Ponto de execução</p>
                </div>
              </div>
              <p className="num text-base font-bold text-white">
                {s.entryPrice !== null ? s.entryPrice.toFixed(decimals(s.symbol)) : "—"}
              </p>
            </div>

            {/* Stop Loss */}
            <div className="mb-3 flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-500/[0.04] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/[0.08]">
                  <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-rose-400">Stop Loss</p>
                  <p className="text-[11px] text-zinc-500">Invalidação — sai do trade</p>
                </div>
              </div>
              <p className="num text-base font-bold text-rose-300">
                {s.stopPrice !== null ? s.stopPrice.toFixed(decimals(s.symbol)) : "—"}
              </p>
            </div>

            {/* Divisor */}
            <div className="mb-3 flex items-center gap-2 text-[10px] text-zinc-600">
              <div className="flex-1 border-t border-dashed border-white/[0.05]" />
              <TrendingUp className="h-3 w-3" />
              <span className="uppercase tracking-widest">Alvos de saída</span>
              <div className="flex-1 border-t border-dashed border-white/[0.05]" />
            </div>

            {/* Alvo 1 */}
            <TargetRow
              label="Alvo 1"
              sublabel="Saída conservadora · parcial"
              value={s.target1}
              symbol={s.symbol}
              entry={s.entryPrice}
              stop={s.stopPrice}
              recommended={s.recommendedTarget === 1}
              isBuy={!!isBuy}
            />

            {/* Alvo 2 */}
            <TargetRow
              label="Alvo 2"
              sublabel="Saída principal · recomendada"
              value={s.target2}
              symbol={s.symbol}
              entry={s.entryPrice}
              stop={s.stopPrice}
              recommended={s.recommendedTarget === 2}
              isBuy={!!isBuy}
            />

            {/* Alvo 3 */}
            <TargetRow
              label="Alvo 3"
              sublabel="Saída agressiva · extensão máxima"
              value={s.target3}
              symbol={s.symbol}
              entry={s.entryPrice}
              stop={s.stopPrice}
              recommended={s.recommendedTarget === 3}
              isBuy={!!isBuy}
            />

            {/* R:R geral */}
            {s.riskReward && (
              <div className="mt-3 flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500">
                  Risco : Retorno
                  <InfoTip text="Quanto se ganha em relação ao que se arrisca. 1:2 significa: se o stop custa R$100, o alvo paga R$200. Calculado da entrada ao Alvo 1 — os alvos 2 e 3 pagam múltiplos maiores." />
                </p>
                <p className="num text-sm font-semibold text-zinc-200">{s.riskReward}</p>
              </div>
            )}
          </div>

          {/* ── ANÁLISE DA IA ── */}
          {s.justification && (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
                <Radio className="h-3 w-3 text-emerald-400" />
                Análise da IA
              </p>
              <p className="text-xs leading-relaxed text-zinc-300">{s.justification}</p>
            </div>
          )}

          {/* ── ESTRUTURA ── */}
          {s.structure && (
            <div className="rounded-lg border border-white/5 bg-white/[0.015] px-3 py-2">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">Estrutura do mercado</p>
              <p className="text-xs text-zinc-400 leading-relaxed">{s.structure}</p>
            </div>
          )}

          {/* Checklist por modo */}
          {s.mode === "SMC" && s.checklistSmc && (
            <SmcChecklist data={s.checklistSmc} tipoSetup={s.tipoSetup} />
          )}
          {s.mode === "CLASSICO" && s.checklistClassico && (
            <ClassicoChecklist data={s.checklistClassico} tipoSetup={s.tipoSetup} />
          )}

          {/* Resultado se fechado */}
          {(s.status === "WIN" || s.status === "LOSS") && (
            <div className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3 text-xs",
              s.status === "WIN"
                ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                : "border-rose-500/20 bg-rose-500/[0.04]"
            )}>
              <span className="text-zinc-400">
                Fechado{" "}
                {s.closedAt && (
                  <span className="num text-zinc-300">
                    {new Date(s.closedAt).toLocaleString("pt-BR")}
                  </span>
                )}
                {" · saída "}
                <span className="num text-zinc-300">{s.exitPrice?.toFixed(decimals(s.symbol))}</span>
              </span>
              <span className={cn(
                "num text-base font-bold",
                s.rMultiple !== null && s.rMultiple > 0 ? "text-emerald-400" : "text-rose-400",
              )}>
                {s.rMultiple !== null
                  ? `${s.rMultiple > 0 ? "+" : ""}${s.rMultiple.toFixed(2)}R`
                  : "—"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Linha do tempo do ciclo do sinal: Detectado → Entrada → Resultado.
 * Deixa explícito que o sinal foi criado ANTES do preço tocar a entrada
 * (antecipação), e em que momento cada etapa aconteceu.
 */
function SignalTimeline({ signal: s }: { signal: SignalData }) {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  const detected = fmt(s.scannedAt);
  const filled = fmt(s.filledAt);
  const closed = fmt(s.closedAt);
  const isPending = s.status === "PENDING";
  const isFilled = s.status === "FILLED";
  const isClosed = s.status === "WIN" || s.status === "LOSS";

  const steps: Array<{ label: string; detail: string; state: "done" | "active" | "todo"; tone?: "win" | "loss" }> = [
    {
      label: "Sinal detectado",
      detail: `${detected} — plano criado ANTES da entrada`,
      state: "done",
    },
    {
      label: isPending ? "Aguardando entrada" : "Entrada executada",
      detail: isPending
        ? `ordem Limit em ${s.entryPrice !== null ? s.entryPrice.toFixed(decimals(s.symbol)) : "—"} · o preço ainda não chegou — é AGORA que você posiciona a ordem`
        : filled
          ? `preço tocou a entrada em ${filled}`
          : "preço tocou a entrada",
      state: isPending ? "active" : "done",
    },
    {
      label: isClosed ? (s.status === "WIN" ? "Resultado: GANHO" : "Resultado: PERDA") : "Resultado",
      detail: isClosed
        ? `${closed ?? ""}${s.exitPrice !== null ? ` · saída ${s.exitPrice.toFixed(decimals(s.symbol))}` : ""}`
        : isFilled
          ? "em execução — monitorando alvos e stop"
          : "—",
      state: isClosed ? "done" : isFilled ? "active" : "todo",
      tone: s.status === "WIN" ? "win" : s.status === "LOSS" ? "loss" : undefined,
    },
  ];

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500">
        Ciclo do sinal
        <InfoTip text="A linha do tempo prova a antecipação: o sinal é DETECTADO antes de o preço chegar; a ENTRADA executa quando o preço toca o nível programado; o RESULTADO fecha no alvo ou no stop. Cada etapa registra o horário real." />
      </p>
      <div className="space-y-1.5">
        {steps.map((st, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className={cn(
                "mt-1 flex h-2 w-2 shrink-0 rounded-full",
                st.state === "done" && !st.tone && "bg-emerald-400",
                st.tone === "win" && "bg-emerald-400",
                st.tone === "loss" && "bg-rose-400",
                st.state === "active" && "relative bg-amber-400",
                st.state === "todo" && "bg-zinc-700",
              )}
            >
              {st.state === "active" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[11px] font-semibold leading-tight",
                  st.state === "todo" ? "text-zinc-600" : "text-zinc-200",
                  st.tone === "win" && "text-emerald-300",
                  st.tone === "loss" && "text-rose-300",
                )}
              >
                {st.label}
              </p>
              <p className="num text-[10px] leading-snug text-zinc-500">{st.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetRow({
  label,
  sublabel,
  value,
  symbol,
  entry,
  stop,
  recommended,
  isBuy,
}: {
  label: string;
  sublabel: string;
  value: number | null;
  symbol: string;
  entry: number | null;
  stop: number | null;
  recommended: boolean;
  isBuy: boolean;
}) {
  // Calcula R:R para este alvo
  let rr: string | null = null;
  if (value !== null && entry !== null && stop !== null) {
    const risk = Math.abs(entry - stop);
    const reward = Math.abs(value - entry);
    if (risk > 0) rr = `1:${(reward / risk).toFixed(1)}`;
  }

  if (value === null) return null;

  return (
    <div className={cn(
      "mb-2 flex items-center justify-between rounded-lg border px-4 py-3 transition",
      recommended
        ? "border-emerald-500/25 bg-emerald-500/[0.06]"
        : "border-emerald-500/10 bg-emerald-500/[0.02]"
    )}>
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-bold",
          recommended
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-500"
        )}>
          {label.replace("Alvo ", "")}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-widest text-emerald-400">{label}</p>
            {recommended && (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                ★ Recomendado
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500">{sublabel}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="num text-base font-bold text-emerald-300">
          {value.toFixed(decimals(symbol))}
        </p>
        {rr && <p className="num text-[10px] text-zinc-500">{rr}</p>}
      </div>
    </div>
  );
}



function NoSetupRow({ signal: s }: { signal: SignalData }) {
  const [expanded, setExpanded] = useState(false);
  const [candles, setCandles] = useState<ChartCandle[] | null>(s.candleData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = `tv:expanded:${s.symbol}|${s.timeframe}|${s.mode}`;

  async function fetchCandles(showLoading = true) {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/market/candles?symbol=${encodeURIComponent(s.symbol)}&tf=${s.timeframe}&limit=300`
      );
      if (!r.ok) throw new Error("Erro ao carregar dados do mercado");
      const data = await r.json();
      if (Array.isArray(data.candles)) {
        setCandles(data.candles);
      } else {
        throw new Error("Formato de velas inválido");
      }
    } catch (err) {
      if (showLoading) setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "1") {
      setExpanded(true);
    } else if (saved === "0") {
      setExpanded(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!expanded) return;

    if (!candles || candles.length === 0) {
      fetchCandles(true);
    } else {
      fetchCandles(false);
    }

    let active = true;
    async function loadRealtimeCandles() {
      try {
        const r = await fetch(
          `/api/market/candles?symbol=${encodeURIComponent(s.symbol)}&tf=${s.timeframe}&limit=300`
        );
        if (!r.ok) return;
        const data = await r.json();
        if (active && Array.isArray(data.candles)) {
          setCandles(data.candles);
        }
      } catch (err) {
        console.error("Erro ao carregar candles atualizados:", err);
      }
    }

    const interval = setInterval(loadRealtimeCandles, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.symbol, s.timeframe, expanded]);

  function toggleExpanded() {
    setExpanded((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-md border border-white/5 bg-white/[0.015] transition hover:border-white/10">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
          )}
          <span className="num text-sm font-medium text-zinc-200">{s.symbol}</span>
          <span className="num text-[10px] text-zinc-500">· {s.timeframe}</span>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest",
              s.mode === "SMC"
                ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400/80"
                : "border-amber-500/20 bg-amber-500/[0.04] text-amber-400/80",
            )}
          >
            {s.mode === "SMC" ? "SMC" : "Clássico"}
          </span>
          {/* Badge animado de monitoramento */}
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-widest text-blue-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
            </span>
            IA monitorando
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-zinc-600">
          <Clock className="h-3 w-3" />
          {timeAgo(s.scannedAt)}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/5 p-4 space-y-3">
          {/* Banner de status da IA */}
          <div className="flex items-start gap-3 rounded-md border border-blue-500/15 bg-blue-500/[0.04] px-3 py-2.5">
            <Radio className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-blue-400" />
            <div>
              <p className="text-xs font-semibold text-blue-300">IA buscando oportunidades</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                O scanner analisou {s.symbol} ({s.timeframe}) e <span className="text-zinc-300 font-medium">nenhum setup de alta probabilidade foi identificado no momento.</span> A IA continua monitorando o ativo e alertará quando uma confluência de {s.mode === "SMC" ? "Sweep + CHoCH + Order Block" : "alinhamento de médias + pullback + gatilho"} for detectada.
              </p>
              {s.justification && !s.justification.toLowerCase().startsWith("rejeit") && (
                <p className="mt-1.5 text-[11px] text-zinc-500 italic">{s.justification}</p>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex h-[150px] items-center justify-center text-xs text-zinc-500">
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
              Carregando gráfico...
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-rose-500/20 bg-rose-500/[0.04] p-3 text-xs text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {!loading && !error && candles && candles.length > 0 && (
            <SignalChart
              candles={candles}
              symbol={s.symbol}
              isBuy={false}
              entry={null}
              stop={null}
              target={null}
              targets={[null, null, null]}
              recommendedTarget={null}
              status={s.status}
              exitPrice={null}
              rMultiple={null}
              scannedAt={s.scannedAt}
              timeframe={s.timeframe}
              defaultShowMA={s.mode === "CLASSICO"}
              defaultShowSmc={s.mode === "SMC"}
            />
          )}
        </div>
      )}
    </div>
  );
}

function pickTarget(s: SignalData): number | null {
  const tgts = [s.target1, s.target2, s.target3];
  const idx = (s.recommendedTarget ?? 1) - 1;
  return tgts[idx] ?? tgts.find((x) => x !== null) ?? null;
}

function decimals(symbol: string): number {
  if (symbol.includes("XAU") || symbol.includes("GOLD")) return 2;
  if (symbol.includes("JPY")) return 3;
  return 5;
}

function directionMeta(d: string | null) {
  switch (d) {
    case "COMPRA_FORTE":
      return { label: "Compra forte", text: "text-emerald-300", bar: "bg-emerald-500" };
    case "COMPRA_FRACA":
      return { label: "Compra fraca", text: "text-emerald-400/90", bar: "bg-emerald-500/60" };
    case "VENDA_FORTE":
      return { label: "Venda forte", text: "text-rose-300", bar: "bg-rose-500" };
    case "VENDA_FRACA":
      return { label: "Venda fraca", text: "text-rose-400/90", bar: "bg-rose-500/60" };
    case "NEUTRO":
    default:
      return { label: "—", text: "text-zinc-300", bar: "bg-zinc-500" };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return {
        label: "Aguardando",
        cls: "border-white/10 bg-white/[0.03] text-zinc-300",
        hint: "O sinal foi detectado ANTES de o preço chegar à entrada. É agora que você posiciona a ordem no preço indicado. Quando o preço tocar, o status muda para 'Em execução'.",
      };
    case "FILLED":
      return {
        label: "Em execução",
        cls: "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
        hint: "O preço tocou a entrada programada e o trade está aberto. O sistema monitora automaticamente os alvos (TP1/TP2/TP3) e o stop.",
      };
    case "WIN":
      return {
        label: "Ganho",
        cls: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
        hint: "O trade atingiu alvo. O valor em R mostra o lucro em múltiplos do risco: +2R significa que o lucro foi o dobro do que se arriscou no stop.",
      };
    case "LOSS":
      return {
        label: "Perda",
        cls: "border-rose-500/30 bg-rose-500/[0.08] text-rose-300",
        hint: "O preço atingiu o stop antes dos alvos. Perdas fazem parte de qualquer operacional — o stop limita a perda a 1R (o risco planejado).",
      };
    case "EXPIRED":
      return {
        label: "Expirado",
        cls: "border-white/10 bg-white/[0.03] text-zinc-400",
        hint: "O preço fugiu sem nunca tocar a entrada programada (o movimento aconteceu sem chance real de execução) ou o sinal passou 48h sem executar. NÃO conta como ganho nem como perda — isso mantém a estatística honesta.",
      };
    default:
      return {
        label: status,
        cls: "border-white/10 bg-white/[0.03] text-zinc-400",
        hint: undefined as string | undefined,
      };
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
