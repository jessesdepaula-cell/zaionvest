interface WFAWindow {
  window: number;
  isProfit: number;
  oosProfit: number;
  wfe: number;
  approved?: boolean;
  params?: Record<string, unknown>;
}

interface WFATableProps {
  windows: WFAWindow[];
  wfeAvg: number;
  oosWins: number;
  oosTotalWindows: number;
  validatedAt?: Date | string;
}

export function WFATable({
  windows,
  wfeAvg,
  oosWins,
  oosTotalWindows,
  validatedAt,
}: WFATableProps) {
  const oosNegPct =
    oosTotalWindows > 0
      ? (((oosTotalWindows - oosWins) / oosTotalWindows) * 100).toFixed(1)
      : "—";

  const wfePass = wfeAvg > 50;
  const oosPass = parseFloat(oosNegPct) < 50;
  const approved = wfePass && oosPass;

  return (
    <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0A0A0A] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#f5f5f5]/[0.05] flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider">
            Walk Forward Analysis
          </h4>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Validação em {windows.length} janelas Out-of-Sample
          </p>
        </div>
        {validatedAt && (
          <span className="text-[10px] text-zinc-600">
            {new Date(validatedAt).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#f5f5f5]/[0.04] text-zinc-500 text-[10px] uppercase tracking-wider">
              <th className="px-4 py-2.5 text-left font-medium">Janela</th>
              <th className="px-4 py-2.5 text-right font-medium">Lucro IS ($)</th>
              <th className="px-4 py-2.5 text-right font-medium">Lucro OOS ($)</th>
              <th className="px-4 py-2.5 text-right font-medium">WFE %</th>
              <th className="px-4 py-2.5 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w, i) => {
              const oosPositive = w.oosProfit >= 0;
              return (
                <tr
                  key={i}
                  className={`border-b border-[#f5f5f5]/[0.03] transition-colors hover:bg-[#f5f5f5]/[0.01] ${
                    i === windows.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-zinc-400">W{w.window}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      w.isProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {w.isProfit >= 0 ? "+" : ""}
                    {w.isProfit.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-semibold ${
                      oosPositive ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {w.oosProfit >= 0 ? "+" : ""}
                    {w.oosProfit.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      w.wfe > 50
                        ? "text-emerald-400"
                        : w.wfe > 0
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {w.wfe.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    {oosPositive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">
                        ✓ Pass
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[9px] text-rose-400 font-semibold uppercase tracking-wider">
                        ✗ Fail
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Consolidação */}
      <div className="px-4 py-4 border-t border-[#f5f5f5]/[0.05] grid grid-cols-3 gap-4">
        <ConsolidatedMetric
          label="WFE Médio"
          value={`${wfeAvg.toFixed(2)}%`}
          threshold="Critério: > 50%"
          pass={wfePass}
        />
        <ConsolidatedMetric
          label="Janelas OOS Negativas"
          value={`${oosTotalWindows - oosWins} de ${oosTotalWindows} (${oosNegPct}%)`}
          threshold="Critério: < 50%"
          pass={oosPass}
        />
        <div className="flex flex-col items-center justify-center">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
            Veredito Final
          </span>
          <span
            className={`text-sm font-bold ${
              approved ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {approved ? "✅ APROVADO" : "❌ REPROVADO"}
          </span>
          <span className="text-[9px] text-zinc-600 mt-0.5">
            {approved ? "Critérios de robustez atendidos" : "Não passou na esteira"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ConsolidatedMetric({
  label,
  value,
  threshold,
  pass,
}: {
  label: string;
  value: string;
  threshold: string;
  pass: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`text-sm font-mono font-semibold ${
          pass ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {value}
      </span>
      <span className="text-[10px] text-zinc-700">{threshold}</span>
      <span
        className={`text-[10px] font-semibold ${
          pass ? "text-emerald-500" : "text-rose-500"
        }`}
      >
        {pass ? "✅ PASS" : "❌ FAIL"}
      </span>
    </div>
  );
}
