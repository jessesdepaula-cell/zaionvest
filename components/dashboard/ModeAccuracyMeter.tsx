import { type ModeStats } from "@/lib/modeStats";
import { InfoTip } from "@/components/ui/InfoTip";
import { cn } from "@/lib/utils";

/**
 * Desempenho por modo — direto ao ponto, como o operador quer ler:
 * total de trades, quantos ganhos, quantas perdas e quantos atingiram
 * TP1 / TP2 / TP3, com um veredito claro (GANHADOR / PERDEDOR).
 */
export function ModeAccuracyMeter({
  smc,
  classico,
  show = "both",
}: {
  smc: ModeStats;
  classico: ModeStats;
  show?: "both" | "smc" | "classico";
}) {
  if (show === "smc") {
    return (
      <div className="grid gap-3">
        <PerformanceCard stats={smc} accent="emerald" />
      </div>
    );
  }
  if (show === "classico") {
    return (
      <div className="grid gap-3">
        <PerformanceCard stats={classico} accent="amber" />
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <PerformanceCard stats={smc} accent="emerald" />
      <PerformanceCard stats={classico} accent="amber" />
    </div>
  );
}

function verdict(wins: number, losses: number) {
  const decided = wins + losses;
  if (decided === 0)
    return { label: "Sem trades fechados", cls: "border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.03] text-zinc-400" };
  if (wins > losses)
    return { label: "✓ Operacional GANHADOR", cls: "border-emerald-500/40 bg-emerald-500/[0.10] text-emerald-300" };
  if (losses > wins)
    return { label: "✗ Operacional PERDEDOR", cls: "border-rose-500/40 bg-rose-500/[0.10] text-rose-300" };
  return { label: "Empatado", cls: "border-amber-500/40 bg-amber-500/[0.10] text-amber-300" };
}

function PerformanceCard({
  stats,
  accent,
}: {
  stats: ModeStats;
  accent: "emerald" | "amber";
}) {
  const label = stats.mode === "SMC" ? "SMC" : "Clássico";
  const accentClass = accent === "emerald" ? "text-emerald-300" : "text-amber-300";
  const accentBorder = accent === "emerald" ? "border-emerald-500/30" : "border-amber-500/30";
  const accentBg = accent === "emerald" ? "bg-emerald-500/[0.06]" : "bg-amber-500/[0.06]";
  const v = verdict(stats.wins, stats.losses);
  const decided = stats.wins + stats.losses;

  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-5", accentBorder, accentBg)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Desempenho</p>
          <p className={cn("mt-0.5 text-lg font-semibold tracking-tight", accentClass)}>{label}</p>
        </div>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest", v.cls)}>
            {v.label}
          </span>
          <InfoTip
            align="right"
            text="Veredito direto do operacional: GANHADOR quando há mais trades fechados no lucro do que no prejuízo; PERDEDOR no inverso. Sinais expirados (sem execução possível) não entram na conta — só resultado real."
          />
        </span>
      </div>

      {/* Resultado geral */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <BigStat label="Trades fechados" value={decided} />
        <BigStat label="Ganhos" value={stats.wins} tone="win" />
        <BigStat label="Perdas" value={stats.losses} tone="loss" />
      </div>

      {/* Alvos atingidos */}
      <p className="mt-4 mb-1.5 flex items-center gap-1 text-[9px] uppercase tracking-widest text-zinc-500 font-medium">
        Alvos atingidos (pelo menos)
        <InfoTip text="Cada trade tem 3 alvos: TP1 (conservador), TP2 (principal) e TP3 (extensão). Aqui você vê quantos trades chegaram a cada nível — se muitos batem TP1 mas poucos chegam ao TP3, o alvo mais eficiente da estratégia é o mais curto. Contagem cumulativa: quem bateu TP3 também conta em TP1 e TP2." />
      </p>
      <div className="grid grid-cols-3 gap-2">
        <BigStat label="Bateram TP1" value={stats.tp1} tone={stats.tp1 > 0 ? "win" : undefined} />
        <BigStat label="Bateram TP2" value={stats.tp2} tone={stats.tp2 > 0 ? "win" : undefined} />
        <BigStat label="Bateram TP3" value={stats.tp3} tone={stats.tp3 > 0 ? "win" : undefined} />
      </div>

      {stats.open > 0 && (
        <p className="mt-3 text-[10px] text-zinc-500">
          + {stats.open} {stats.open === 1 ? "sinal aberto" : "sinais abertos"} em andamento (não contam até fechar)
        </p>
      )}

      {stats.symbols && stats.symbols.length > 0 && (
        <div className="mt-4 border-t border-[#f0ddb0]/5 pt-3">
          <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5 font-medium">
            Ativos operados ({stats.symbols.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {stats.symbols.map((item) => (
              <span
                key={item.symbol}
                className="num inline-flex items-center gap-1 rounded bg-[#f0ddb0]/[0.03] border border-[#f0ddb0]/5 px-2 py-0.5 text-[10px] text-zinc-300 font-medium"
              >
                <span>{item.symbol}</span>
                <span className="text-zinc-500 text-[9px]">({item.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "win" | "loss";
}) {
  return (
    <div className="rounded-lg border border-[#f0ddb0]/5 bg-[#f0ddb0]/[0.02] px-2 py-2.5 text-center">
      <p
        className={cn(
          "num text-2xl font-bold leading-none",
          tone === "win" && "text-emerald-400",
          tone === "loss" && (value > 0 ? "text-rose-400" : "text-zinc-400"),
          !tone && "text-zinc-200",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[9px] uppercase tracking-widest text-zinc-500 leading-tight">{label}</p>
    </div>
  );
}
