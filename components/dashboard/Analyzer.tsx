"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnnotatedChart, buildAnnotationData } from "./AnnotatedChart";
import { TradeFormButton } from "./TradeForm";

type Mode = "CLASSICO" | "SMC";

type Direcao =
  | "COMPRA_FORTE"
  | "COMPRA_FRACA"
  | "VENDA_FORTE"
  | "VENDA_FRACA"
  | "NEUTRO";

type Alvo = { nivel?: number; preco?: string; rr?: string };

type Analysis = {
  status: "VALIDO" | "INVALIDO";
  modo_aplicado?: Mode;
  validacao?: {
    ativo_identificado?: string;
    timeframe_identificado?: string;
    qualidade_imagem?: "ALTA" | "MEDIA" | "BAIXA";
  };
  mensagem_erro?: string;
  analise?: {
    direcao?: Direcao;
    probabilidade?: string;
    confianca_ia?: string;
    estrutura_ou_tendencia?: string;
    entrada?: { preco?: string; zona?: string; tipo?: string };
    stop_loss?: { preco?: string; justificativa_estrutural?: string };
    alvos?: Alvo[];
    alvo_recomendado?: number;
    razao_alvo_recomendado?: string;
    risco_retorno_estimado?: string;
    justificativa?: string;
  };
  escala_visivel?: { preco_topo?: string; preco_base?: string };
};

const LOADING_STAGES = [
  "Carregando imagem…",
  "Verificando qualidade do gráfico…",
  "Mapeando estrutura de mercado…",
  "Identificando POIs e liquidez…",
  "Calculando alvos e R:R…",
  "Montando plano de trade…",
];

export function Analyzer() {
  const [mode, setMode] = useState<Mode>("SMC");
  const [imageData, setImageData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const readFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Arquivo precisa ser uma imagem (PNG, JPG ou WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Imagem grande demais (máx 8 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result as string);
      setFileName(file.name);
      setError(null);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) readFile(file);
    },
    [readFile],
  );

  async function analyze() {
    if (!imageData || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStage(0);

    const ticker = setInterval(() => {
      setStage((s) => (s + 1) % LOADING_STAGES.length);
    }, 1400);

    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, mode }),
      });
      const data = (await r.json()) as Analysis & { error?: string };
      if (!r.ok && data?.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na requisição.");
    } finally {
      clearInterval(ticker);
      setLoading(false);
    }
  }

  const checklist = useMemo(() => {
    const v = result?.validacao;
    return [
      { label: "Nome do ativo visível", ok: !!v?.ativo_identificado },
      { label: "Timeframe legível", ok: !!v?.timeframe_identificado },
      {
        label: "Qualidade adequada",
        ok: v?.qualidade_imagem === "ALTA" || v?.qualidade_imagem === "MEDIA",
      },
    ];
  }, [result]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <Checklist items={checklist} hasResult={!!result} />

        <div className="glass rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-zinc-500">
              Modo de análise
            </span>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={cn(
            "relative grid min-h-[280px] place-items-center overflow-hidden rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 transition",
            dragActive && "border-emerald-500/50 bg-emerald-500/[0.04]",
          )}
        >
          {imageData ? (
            <div className="relative w-full">
              {result?.status === "VALIDO" && showAnnotations ? (
                <AnnotatedChart
                  src={imageData}
                  data={buildAnnotationData(result)}
                  alt={fileName ?? "gráfico anotado"}
                />
              ) : (
                <Image
                  src={imageData}
                  alt={fileName ?? "gráfico"}
                  width={1200}
                  height={700}
                  className="mx-auto max-h-[420px] w-auto rounded-md border border-white/10 object-contain"
                  unoptimized
                />
              )}
              <button
                onClick={() => {
                  setImageData(null);
                  setFileName(null);
                  setResult(null);
                }}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-charcoal/70 text-zinc-300 hover:bg-charcoal"
                aria-label="Remover imagem"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {result?.status === "VALIDO" && (
                <button
                  onClick={() => setShowAnnotations((s) => !s)}
                  className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-charcoal/70 px-2 py-1 text-[10px] uppercase tracking-widest text-zinc-300 hover:bg-charcoal"
                >
                  {showAnnotations ? (
                    <>
                      <EyeOff className="h-3 w-3" />
                      Original
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" />
                      Anotada
                    </>
                  )}
                </button>
              )}
              {fileName && (
                <p className="num mt-3 truncate text-center text-xs text-zinc-500">
                  {fileName}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-white/10 bg-white/[0.03]">
                <ImageIcon className="h-4 w-4 text-zinc-400" />
              </div>
              <p className="mt-4 text-sm text-zinc-300">
                Arraste o print do gráfico aqui
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                ou clique para selecionar — PNG, JPG, WEBP (máx 8 MB)
              </p>
              <button
                onClick={() => inputRef.current?.click()}
                className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-offwhite hover:bg-white/[0.08]"
              >
                <Upload className="h-3.5 w-3.5" />
                Selecionar arquivo
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f);
                }}
              />
            </div>
          )}
        </div>

        <button
          onClick={analyze}
          disabled={!imageData || loading}
          className={cn(
            "group inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition",
            !imageData || loading
              ? "cursor-not-allowed bg-white/[0.04] text-zinc-500"
              : "bg-emerald-500 text-charcoal hover:bg-emerald-400",
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="shimmer-text">{LOADING_STAGES[stage]}</span>
            </>
          ) : (
            <>
              <Crosshair className="h-4 w-4" />
              Analisar com IA
            </>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div>
        <ResultPanel result={result} loading={loading} mode={mode} />
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
      {(["CLASSICO", "SMC"] as Mode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={cn(
              "rounded-md px-3 py-2 text-xs font-medium uppercase tracking-widest transition",
              active
                ? "bg-emerald-500/[0.12] text-emerald-300 shadow-terminal"
                : "text-zinc-400 hover:text-offwhite",
            )}
          >
            {m === "CLASSICO" ? "Clássico" : "SMC"}
          </button>
        );
      })}
    </div>
  );
}

function Checklist({
  items,
  hasResult,
}: {
  items: { label: string; ok: boolean }[];
  hasResult: boolean;
}) {
  return (
    <div className="glass flex flex-wrap items-center gap-3 rounded-xl p-3 text-xs">
      {items.map((it) => (
        <div
          key={it.label}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2 py-1",
            hasResult && it.ok
              ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300"
              : hasResult
                ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-300"
                : "border-white/10 text-zinc-400",
          )}
        >
          <CheckCircle2 className="h-3 w-3" />
          {it.label}
        </div>
      ))}
    </div>
  );
}

function ResultPanel({
  result,
  loading,
  mode,
}: {
  result: Analysis | null;
  loading: boolean;
  mode: Mode;
}) {
  if (loading) {
    return (
      <div className="glass grid min-h-[420px] place-items-center rounded-xl p-6 text-center">
        <div>
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-500" />
          <p className="mt-4 text-sm shimmer-text">Processando análise institucional…</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass grid min-h-[420px] place-items-center rounded-xl p-6 text-center text-sm text-zinc-500">
        <div>
          <Crosshair className="mx-auto h-5 w-5 text-zinc-600" />
          <p className="mt-3">Envie um gráfico e clique em <span className="text-zinc-300">Analisar com IA</span>.</p>
          <p className="mt-1 text-xs">O resultado aparece aqui.</p>
        </div>
      </div>
    );
  }

  if (result.status === "INVALIDO") {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-6">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs uppercase tracking-widest">Imagem inválida</span>
        </div>
        <p className="mt-3 text-sm text-amber-100">
          {result.mensagem_erro ?? "Não foi possível ler o gráfico."}
        </p>
        <p className="mt-4 text-xs text-amber-300/80">
          Reenvie um print incluindo nome do ativo, timeframe, escala de preços e ~30 velas.
        </p>
      </div>
    );
  }

  const a = result.analise ?? {};
  const v = result.validacao ?? {};
  const alvos = (a.alvos ?? []).slice(0, 3);
  const recomendado = a.alvo_recomendado;

  return (
    <div className="space-y-3.5">
      {/* Header: Ativo + pills */}
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Ativo</p>
          <p className="num text-base text-offwhite">
            {v.ativo_identificado ?? "—"}{" "}
            <span className="text-zinc-500">· {v.timeframe_identificado ?? "—"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill>{result.modo_aplicado === "SMC" ? "SMC" : "Clássico"}</Pill>
          {v.qualidade_imagem && <Pill tone="muted">Qualidade · {v.qualidade_imagem}</Pill>}
          {a.confianca_ia && (
            <Pill tone="emerald">Confiança · {a.confianca_ia}</Pill>
          )}
        </div>
      </header>

      {/* Direção + probabilidade — sinal principal */}
      <DirectionSignal
        direcao={a.direcao}
        probabilidade={a.probabilidade}
      />

      {/* Estrutura */}
      <div className="glass rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">
          {result.modo_aplicado === "SMC" ? "Estrutura de mercado" : "Tendência"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-offwhite">
          {a.estrutura_ou_tendencia ?? "—"}
        </p>
      </div>

      {/* Entrada */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-400">
          <Target className="h-3.5 w-3.5" />
          Onde entrar
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="num text-2xl font-medium text-offwhite">
            {a.entrada?.preco ?? "—"}
          </span>
          {a.entrada?.zona && (
            <span className="num text-xs text-zinc-500">Zona: {a.entrada.zona}</span>
          )}
        </div>
        {a.entrada?.tipo && (
          <p className="mt-1.5 text-xs text-zinc-400">{a.entrada.tipo}</p>
        )}
      </div>

      {/* Stop + R:R recomendado */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-rose-400">
            <TrendingDown className="h-3.5 w-3.5" />
            Stop loss
          </div>
          <p className="num mt-2 text-2xl font-medium text-offwhite">
            {a.stop_loss?.preco ?? "—"}
          </p>
          {a.stop_loss?.justificativa_estrutural && (
            <p className="mt-1.5 text-xs text-zinc-400">
              {a.stop_loss.justificativa_estrutural}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-400">
            <Crosshair className="h-3.5 w-3.5" />
            Risco / Retorno
          </div>
          <p className="num mt-2 text-2xl font-medium text-offwhite">
            {a.risco_retorno_estimado ?? "—"}
          </p>
          {typeof recomendado === "number" && (
            <p className="mt-1.5 text-xs text-zinc-400">
              Baseado no Alvo {recomendado}
            </p>
          )}
        </div>
      </div>

      {/* Alvos */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Alvos · Onde realizar
          </p>
          {typeof recomendado === "number" && (
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-400">
              <Star className="h-3 w-3 fill-emerald-400" />
              Ideal: Alvo {recomendado}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3].map((n) => {
            const alvo = alvos.find((x) => x.nivel === n) ?? alvos[n - 1];
            const isRec = recomendado === n;
            return (
              <div
                key={n}
                className={cn(
                  "rounded-xl border p-3 transition",
                  isRec
                    ? "border-emerald-500/40 bg-emerald-500/[0.07] shadow-glow"
                    : "border-white/10 bg-white/[0.02]",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between text-[10px] uppercase tracking-widest",
                    isRec ? "text-emerald-400" : "text-zinc-500",
                  )}
                >
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Alvo {n}
                  </span>
                  {isRec && <Star className="h-3 w-3 fill-emerald-400" />}
                </div>
                <p className="num mt-1.5 text-base font-medium text-offwhite">
                  {alvo?.preco ?? "—"}
                </p>
                {alvo?.rr && (
                  <p className="num mt-0.5 text-[11px] text-zinc-500">
                    R:R {alvo.rr}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {a.razao_alvo_recomendado && (
          <p className="mt-2.5 text-xs text-zinc-400">
            <span className="text-emerald-400">Por quê:</span>{" "}
            {a.razao_alvo_recomendado}
          </p>
        )}
      </div>

      {/* Justificativa */}
      <div className="glass rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">
          Justificativa
        </p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-200">
          {a.justificativa ?? "—"}
        </p>
      </div>

      {/* Registrar trade */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-emerald-400">
            Catalogar
          </p>
          <p className="mt-0.5 text-sm text-offwhite">
            Registre este setup no seu diário e acompanhe o resultado.
          </p>
        </div>
        <TradeFormButton
          label="Registrar como trade"
          prefill={{
            asset: v.ativo_identificado,
            timeframe: v.timeframe_identificado,
            mode,
            direction: a.direcao?.startsWith("COMPRA") ? "BUY" : a.direcao?.startsWith("VENDA") ? "SELL" : "BUY",
            entryPrice: a.entrada?.preco,
            stopPrice: a.stop_loss?.preco,
            targetPrice: alvos.find((al) => al.nivel === recomendado)?.preco ?? alvos[0]?.preco,
          }}
        />
      </div>

      <p className="text-center text-[10px] text-zinc-600">
        Conteúdo educacional. Não constitui recomendação de investimento.
      </p>
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "emerald" | "muted";
}) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest",
        tone === "emerald" &&
          "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
        tone === "muted" && "border-white/10 bg-white/[0.03] text-zinc-400",
        tone === "default" && "border-white/10 bg-white/[0.04] text-zinc-200",
      )}
    >
      {children}
    </span>
  );
}

function DirectionSignal({
  direcao,
  probabilidade,
}: {
  direcao?: Direcao;
  probabilidade?: string;
}) {
  const meta = directionMeta(direcao);
  const prob = parseInt((probabilidade ?? "").replace(/\D/g, ""), 10);
  const probShow = isFinite(prob) && prob > 0 ? prob : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-4",
        meta.border,
        meta.bg,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Sinal
          </p>
          <p className={cn("mt-1 text-xl font-semibold tracking-tight", meta.text)}>
            {meta.label}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Probabilidade
          </p>
          <p className={cn("num mt-1 text-2xl font-medium", meta.text)}>
            {probabilidade ?? "—"}
          </p>
        </div>
      </div>
      {probShow !== null && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className={cn("h-full rounded-full transition-all", meta.bar)}
            style={{ width: `${Math.min(probShow, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function directionMeta(d?: Direcao) {
  switch (d) {
    case "COMPRA_FORTE":
      return {
        label: "Compra forte",
        text: "text-emerald-300",
        border: "border-emerald-500/40",
        bg: "bg-emerald-500/[0.08]",
        bar: "bg-emerald-500",
      };
    case "COMPRA_FRACA":
      return {
        label: "Compra fraca",
        text: "text-emerald-400/90",
        border: "border-emerald-500/20",
        bg: "bg-emerald-500/[0.04]",
        bar: "bg-emerald-500/60",
      };
    case "VENDA_FORTE":
      return {
        label: "Venda forte",
        text: "text-rose-300",
        border: "border-rose-500/40",
        bg: "bg-rose-500/[0.08]",
        bar: "bg-rose-500",
      };
    case "VENDA_FRACA":
      return {
        label: "Venda fraca",
        text: "text-rose-400/90",
        border: "border-rose-500/20",
        bg: "bg-rose-500/[0.04]",
        bar: "bg-rose-500/60",
      };
    case "NEUTRO":
    default:
      return {
        label: d === "NEUTRO" ? "Neutro · Sem setup" : "—",
        text: "text-zinc-300",
        border: "border-white/10",
        bg: "bg-white/[0.02]",
        bar: "bg-zinc-500",
      };
  }
}
