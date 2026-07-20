"use client";

import React, { useState, useMemo } from "react";
import { Network, ShieldAlert, ShieldCheck, HelpCircle, Layers } from "lucide-react";
import { correlationBetween, EquityPoint } from "@/lib/correlation";

export interface DownloadedEAItem {
  id: string;
  name: string;
  slug: string;
  symbol: string;
  timeframe: string;
  status: string; // APPROVED | REJECTED | PENDING
  maxDrawdown: number | null;
  equityCurveOos: EquityPoint[] | null;
  isOperatingInMT5?: boolean;
}

interface Props {
  eas: DownloadedEAItem[];
}

export type FilterMode = "APPROVED" | "MT5_LIVE" | "ALL";

export function RobotCorrelationSection({ eas }: Props) {
  const mt5LiveCount = useMemo(() => eas.filter((e) => e.isOperatingInMT5).length, [eas]);
  const [filterMode, setFilterMode] = useState<FilterMode>(() =>
    mt5LiveCount > 0 ? "MT5_LIVE" : "APPROVED"
  );
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Filtragem dos EAs elegíveis
  const filteredEAs = useMemo(() => {
    if (filterMode === "APPROVED") {
      return eas.filter((item) => item.status === "APPROVED");
    }
    if (filterMode === "MT5_LIVE") {
      return eas.filter((item) => item.isOperatingInMT5);
    }
    return eas;
  }, [eas, filterMode]);

  // Cálculo da matriz de correlação NxN
  const matrixData = useMemo(() => {
    const n = filteredEAs.length;
    if (n < 2) return null;

    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const pairs: { ea1: DownloadedEAItem; ea2: DownloadedEAItem; corr: number }[] = [];
    let sumCorr = 0;
    let count = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else if (i < j) {
          const c = correlationBetween(
            {
              id: filteredEAs[i].id,
              wfe: null,
              profitFactor: null,
              maxDrawdown: filteredEAs[i].maxDrawdown,
              equityCurveOos: filteredEAs[i].equityCurveOos,
            },
            {
              id: filteredEAs[j].id,
              wfe: null,
              profitFactor: null,
              maxDrawdown: filteredEAs[j].maxDrawdown,
              equityCurveOos: filteredEAs[j].equityCurveOos,
            }
          );
          matrix[i][j] = c;
          matrix[j][i] = c;
          pairs.push({ ea1: filteredEAs[i], ea2: filteredEAs[j], corr: c });
          sumCorr += Math.abs(c);
          count++;
        }
      }
    }

    const avgCorr = count > 0 ? sumCorr / count : 0;

    // Encontrar par de maior correlação
    pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
    const highestPair = pairs.length > 0 ? pairs[0] : null;

    // Encontrar robô com menor correlação média (mais diversificado)
    let bestDiversifiedEA: DownloadedEAItem | null = null;
    let minAvgCorr = Infinity;

    for (let i = 0; i < n; i++) {
      let total = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) total += Math.abs(matrix[i][j]);
      }
      const avg = total / (n - 1);
      if (avg < minAvgCorr) {
        minAvgCorr = avg;
        bestDiversifiedEA = filteredEAs[i];
      }
    }

    return {
      matrix,
      avgCorr,
      highestPair,
      bestDiversifiedEA,
      minAvgCorr: isFinite(minAvgCorr) ? minAvgCorr : 0,
    };
  }, [filteredEAs]);

  if (eas.length < 2) {
    return (
      <div className="mb-8 rounded-xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.01] p-5 text-center">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-zinc-400">
          <Network className="h-4 w-4 text-[#2563EB]" />
          Análise de Correlação do Portfólio
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Baixe pelo menos 2 robôs para visualizar a matriz de correlação e o índice de diversificação das suas estratégias.
        </p>
      </div>
    );
  }

  const getCellStyle = (corr: number, isDiagonal: boolean) => {
    if (isDiagonal) {
      return "bg-[#141414] text-zinc-600 font-mono";
    }
    const abs = Math.abs(corr);
    if (abs > 0.7) {
      return "bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold";
    }
    if (abs > 0.3) {
      return "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold";
    }
    return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold";
  };

  const formatCorr = (val: number) => {
    const prefix = val > 0 ? "+" : "";
    return `${prefix}${val.toFixed(2)}`;
  };

  return (
    <div className="mb-8 rounded-2xl border border-[#f5f5f5]/10 bg-[#0D0D0D] p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f5f5f5]/5 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-offwhite">
            <Network className="h-4 w-4 text-[#2563EB]" />
            Análise de Correlação entre Robôs Ativos
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Mede se os robôs costumam ganhar ou perder nos mesmos momentos (Pearson nas curvas OOS). Quanto menor a correlação, mais seguro e diversificado é o portfólio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#f5f5f5]/10 bg-[#141414] p-1">
          <button
            onClick={() => setFilterMode("APPROVED")}
            className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
              filterMode === "APPROVED"
                ? "bg-[#2563EB] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Apenas Revalidação Aprovada ({eas.filter((e) => e.status === "APPROVED").length})
          </button>

          {mt5LiveCount > 0 && (
            <button
              onClick={() => setFilterMode("MT5_LIVE")}
              className={`rounded-md px-3 py-1 text-[11px] font-semibold transition flex items-center gap-1 ${
                filterMode === "MT5_LIVE"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-emerald-400 hover:text-emerald-300"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Operando na Conta MT5 ({mt5LiveCount})
            </button>
          )}

          <button
            onClick={() => setFilterMode("ALL")}
            className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
              filterMode === "ALL"
                ? "bg-[#2563EB] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Todos Baixados ({eas.length})
          </button>
        </div>
      </div>

      {!matrixData || filteredEAs.length < 2 ? (
        <div className="py-8 text-center text-xs text-zinc-500">
          {filterMode !== "ALL"
            ? "Você não possui pelo menos 2 robôs nesta categoria no momento. Mude o filtro para 'Todos Baixados' para comparar todas as estratégias."
            : "Número insuficiente de robôs para gerar a matriz."}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Métricas Principais */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Card 1: Média Global */}
            <div className="rounded-xl border border-[#f5f5f5]/5 bg-[#141414] p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Correlação Média do Portfólio
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-[#F5F5F5] font-mono">
                  {formatCorr(matrixData.avgCorr)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    matrixData.avgCorr <= 0.3
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : matrixData.avgCorr <= 0.6
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {matrixData.avgCorr <= 0.3 ? (
                    <>
                      <ShieldCheck className="h-3 w-3" /> Alta Diversificação
                    </>
                  ) : matrixData.avgCorr <= 0.6 ? (
                    <>
                      <Layers className="h-3 w-3" /> Diversificação Moderada
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3 w-3" /> Alta Sobreposição
                    </>
                  )}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                Média entre todos os pares de robôs selecionados.
              </p>
            </div>

            {/* Card 2: Par de Maior Correlação */}
            <div className="rounded-xl border border-[#f5f5f5]/5 bg-[#141414] p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Maior Correlação no Portfólio
              </span>
              {matrixData.highestPair ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 truncate max-w-[170px]">
                      {matrixData.highestPair.ea1.name} × {matrixData.highestPair.ea2.name}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        Math.abs(matrixData.highestPair.corr) > 0.7
                          ? "text-rose-400"
                          : Math.abs(matrixData.highestPair.corr) > 0.3
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {formatCorr(matrixData.highestPair.corr)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    {Math.abs(matrixData.highestPair.corr) > 0.7
                      ? "⚠️ Atenção: Estes dois robôs tendem a operar de forma muito parecida."
                      : "Comportamento bem independente."}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">—</p>
              )}
            </div>

            {/* Card 3: Robô mais descorrelacionado */}
            <div className="rounded-xl border border-[#f5f5f5]/5 bg-[#141414] p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Destaque em Diversificação
              </span>
              {matrixData.bestDiversifiedEA ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 truncate max-w-[170px]">
                      {matrixData.bestDiversifiedEA.name}
                    </span>
                    <span className="font-mono text-xs text-zinc-400">
                      {formatCorr(matrixData.minAvgCorr)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    Robô com menor correlação média em relação a todos os outros.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">—</p>
              )}
            </div>
          </div>

          {/* Matriz Heatmap NxN */}
          <div className="overflow-x-auto rounded-xl border border-[#f5f5f5]/5 bg-[#070707] p-4">
            <h3 className="mb-3 text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              Matriz de Correlação Cruzada (Pearson)
            </h3>
            <table className="w-full min-w-[500px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="p-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-[#f5f5f5]/5">
                    Robô
                  </th>
                  {filteredEAs.map((ea, idx) => (
                    <th
                      key={ea.id}
                      className="p-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#f5f5f5]/5 truncate max-w-[100px]"
                      title={`${ea.name} (${ea.symbol} ${ea.timeframe})`}
                    >
                      EA #{idx + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEAs.map((rowEA, rowIdx) => (
                  <tr key={rowEA.id} className="hover:bg-[#141414]/50 transition">
                    <td className="p-2 text-xs font-medium text-zinc-300 border-b border-[#f5f5f5]/5">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded bg-[#2563EB]/20 text-[9px] font-bold text-[#2563EB]">
                          #{rowIdx + 1}
                        </span>
                        <span className="font-semibold text-offwhite truncate max-w-[160px]">
                          {rowEA.name}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          ({rowEA.symbol})
                        </span>
                      </div>
                    </td>
                    {filteredEAs.map((colEA, colIdx) => {
                      const corr = matrixData.matrix[rowIdx][colIdx];
                      const isDiagonal = rowIdx === colIdx;
                      const isHovered =
                        hoveredCell?.row === rowIdx || hoveredCell?.col === colIdx;

                      return (
                        <td
                          key={colEA.id}
                          onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`p-2 text-center text-xs border-b border-[#f5f5f5]/5 transition ${
                            isHovered ? "brightness-125" : ""
                          }`}
                        >
                          <span
                            className={`inline-block w-14 rounded-md py-1 font-mono text-[11px] transition-transform ${getCellStyle(
                              corr,
                              isDiagonal
                            )}`}
                          >
                            {formatCorr(corr)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legenda Explicativa */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-400 border-t border-[#f5f5f5]/5 pt-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block" />
                <strong className="text-zinc-200">≤ 0.30:</strong> Baixa Correlação (Excelente)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
                <strong className="text-zinc-200">0.31 – 0.70:</strong> Correlação Moderada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400 inline-block" />
                <strong className="text-zinc-200">&gt; 0.70:</strong> Alta Correlação (Evitar rodar juntos)
              </span>
            </div>

            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <HelpCircle className="h-3 w-3" /> Pearson medido nas janelas OOS da ZaionVest
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
