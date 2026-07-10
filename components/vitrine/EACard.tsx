"use client";

import Link from "next/link";
import { Download, TrendingUp, TrendingDown, Activity } from "lucide-react";

export type EAStatus = "APPROVED" | "REJECTED" | "PENDING";

export interface EACardProps {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  timeframe: string;
  style: string;
  exitMode: string;
  status: EAStatus;
  wfe?: number | null;
  profitFactor?: number | null;
  maxDrawdown?: number | null;
  totalTrades?: number | null;
  oosWins?: number | null;
  oosTotalWindows?: number | null;
  equityCurveOos?: Array<{ date: string; value: number }> | null;
  canDownload?: boolean; // true se usuário tem assinatura ativa
  detailHref?: string;
}

const STATUS_CONFIG: Record<
  EAStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  APPROVED: {
    label: "Aprovado",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  REJECTED: {
    label: "Reprovado",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    dot: "bg-rose-400",
  },
  PENDING: {
    label: "Pendente",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
};

const STYLE_LABELS: Record<string, string> = {
  trend: "Tendência",
  reversal: "Reversão",
  breakout: "Rompimento",
  range: "Range",
};

// Mini sparkline SVG da curva de capital OOS
function SparkLine({
  data,
  approved,
}: {
  data: Array<{ value: number }>;
  approved: boolean;
}) {
  if (!data || data.length < 2) {
    return (
      <div className="h-12 flex items-center justify-center text-[10px] text-zinc-600">
        Sem dados
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 200;
  const H = 48;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x},${y}`;
    })
    .join(" ");

  const color = approved ? "#10b981" : "#f43f5e";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-12"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`grad-${approved}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${H} ${points} ${W},${H}`}
        fill={`url(#grad-${approved})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EACard({
  id,
  slug,
  name,
  symbol,
  timeframe,
  style,
  exitMode,
  status,
  wfe,
  profitFactor,
  maxDrawdown,
  totalTrades,
  oosWins,
  oosTotalWindows,
  equityCurveOos,
  canDownload = false,
  detailHref,
}: EACardProps) {
  const cfg = STATUS_CONFIG[status];
  const approved = status === "APPROVED";

  const oosRate =
    oosWins != null && oosTotalWindows != null && oosTotalWindows > 0
      ? Math.round((oosWins / oosTotalWindows) * 100)
      : null;

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border bg-[#0A0A0A] overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${
        approved
          ? "border-[#f5f5f5]/8 hover:border-emerald-500/25 hover:shadow-[0_0_30px_-8px_rgba(16,185,129,0.2)]"
          : status === "REJECTED"
          ? "border-rose-500/10 opacity-70"
          : "border-[#f5f5f5]/5"
      }`}
    >
      {/* Glow de fundo sutil */}
      {approved && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-transparent" />
      )}

      <div className="p-5 flex flex-col gap-4 relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] text-zinc-600 tracking-wider uppercase">
                {symbol} · {timeframe}
              </span>
              <span className="text-[10px] text-zinc-700 uppercase tracking-wider">
                {STYLE_LABELS[style] ?? style}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-[#F5F5F5] leading-tight">
              {name}
            </h3>
          </div>

          {/* Badge de status */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider border ${cfg.bg} ${cfg.border} ${cfg.color} flex-shrink-0`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${
                approved ? "animate-pulse" : ""
              }`}
            />
            {cfg.label}
          </span>
        </div>

        {/* Sparkline da curva OOS */}
        <div className="rounded-lg overflow-hidden bg-[#050505] border border-[#f5f5f5]/[0.04]">
          <SparkLine data={equityCurveOos ?? []} approved={approved} />
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2">
          <Metric
            label="WFE"
            value={wfe != null ? `${wfe.toFixed(1)}%` : "—"}
            good={wfe != null && wfe > 50}
            icon={<Activity className="h-3 w-3" />}
          />
          <Metric
            label="Profit Factor"
            value={profitFactor != null ? profitFactor.toFixed(2) : "—"}
            good={profitFactor != null && profitFactor > 1.35}
            icon={<TrendingUp className="h-3 w-3" />}
          />
          <Metric
            label="Drawdown Máx."
            value={maxDrawdown != null ? `${maxDrawdown.toFixed(1)}%` : "—"}
            good={maxDrawdown != null && maxDrawdown < 30}
            invert
            icon={<TrendingDown className="h-3 w-3" />}
          />
          <Metric
            label="OOS Pass Rate"
            value={oosRate != null ? `${oosRate}%` : "—"}
            good={oosRate != null && oosRate >= 50}
            icon={<Activity className="h-3 w-3" />}
          />
        </div>

        {totalTrades != null && (
          <p className="text-[10px] text-zinc-600 text-center">
            {totalTrades} trades · Modo:{" "}
            {exitMode === "reversal" ? "Stop & Reversão" : "SL/TP Fixos"}
          </p>
        )}

        {/* Ações */}
        <div className="flex gap-2 mt-auto pt-2 border-t border-[#f5f5f5]/[0.04]">
          {detailHref && (
            <Link
              href={detailHref}
              className="flex-1 rounded-lg border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.03] px-3 py-2 text-center text-xs font-medium text-zinc-300 transition hover:bg-[#f5f5f5]/[0.07] hover:text-[#F5F5F5]"
            >
              Ver detalhes
            </Link>
          )}

          {approved && (
            <a
              href={canDownload ? `/api/ea/${id}/download` : "/billing"}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                canDownload
                  ? "bg-[#DC1F2E] text-white hover:bg-[#B01623] shadow-[0_4px_16px_-4px_rgba(220,31,46,0.4)]"
                  : "border border-[#DC1F2E]/30 text-[#DC1F2E] hover:bg-[#DC1F2E]/10"
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              {canDownload ? "Baixar .ex5" : "Assinar"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  good,
  invert = false,
  icon,
}: {
  label: string;
  value: string;
  good: boolean;
  invert?: boolean;
  icon: React.ReactNode;
}) {
  const color =
    value === "—"
      ? "text-zinc-600"
      : (good && !invert) || (!good && invert)
      ? "text-emerald-400"
      : "text-rose-400";

  return (
    <div className="rounded-lg bg-[#050505] border border-[#f5f5f5]/[0.04] px-3 py-2">
      <div className="flex items-center gap-1 text-zinc-600 mb-1">
        {icon}
        <span className="text-[9px] uppercase tracking-widest">{label}</span>
      </div>
      <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}
