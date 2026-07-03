import { getGlobalTrackRecord, type GlobalTrackRecord, type ModeTrackRecord } from "@/lib/trackRecord";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

/**
 * Seção pública de track record: números REAIS do scanner (sinais fechados
 * WIN/LOSS por modo) + últimos resultados. É o que gera confiança em novos
 * assinantes — sem números inventados. Renderizada no servidor com ISR.
 */
export async function TrackRecordSection() {
  let data: GlobalTrackRecord | null = null;
  try {
    data = await getGlobalTrackRecord();
  } catch {
    // banco indisponível → não quebra a landing, apenas omite a seção
    return null;
  }
  if (!data) return null;

  const totalClosed = data.smc.closed + data.classico.closed;
  // Sem amostra mínima ainda: mostra estado honesto de "colecionando histórico"
  const hasSample = totalClosed >= 5;

  return (
    <section id="resultados" className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-white/5">
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-emerald-500">
          Histórico auditável
        </p>
        <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Resultados reais do scanner
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Cada sinal emitido é catalogado e fechado automaticamente como ganho ou perda
          quando o preço toca alvo ou stop. Nenhum número editado à mão — o que você vê
          aqui é o mesmo histórico que os assinantes acompanham dentro da plataforma.
        </p>
      </div>

      {hasSample ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModeCard data={data.smc} label="Modo SMC" sub="Smart Money Concepts · liquidez, ChoCh e Order Blocks" />
            <ModeCard data={data.classico} label="Modo Clássico" sub="Tendência · pullback em médias com confluência" />
          </div>

          {data.recent.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="border-b border-white/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Últimos sinais fechados
                </p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {data.recent.map((r, i) => {
                  const win = r.status === "WIN";
                  const buy = r.direction?.startsWith("COMPRA");
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {buy ? (
                          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                        )}
                        <span className="font-medium text-zinc-200">{r.symbol}</span>
                        <span className="text-zinc-600">· {r.timeframe}</span>
                        <span className="rounded border border-white/10 px-1 py-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
                          {r.mode}
                        </span>
                        {r.closedAt && (
                          <span className="hidden text-zinc-600 sm:inline">
                            {new Date(r.closedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {r.rMultiple !== null && (
                          <span className={win ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
                            {r.rMultiple > 0 ? "+" : ""}
                            {r.rMultiple.toFixed(2)}R
                          </span>
                        )}
                        <span
                          className={
                            win
                              ? "rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300"
                              : "rounded-md border border-rose-500/30 bg-rose-500/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-rose-300"
                          }
                        >
                          {win ? "Ganho" : "Perda"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mx-auto max-w-xl rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
          <BarChart3 className="mx-auto mb-3 h-8 w-8 text-emerald-500/60" />
          <p className="text-sm font-semibold text-zinc-200">
            Histórico em construção — {data.totalSignals} sinais já emitidos
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            O scanner está catalogando cada sinal em tempo real. Assim que houver amostra
            mínima de sinais fechados, a assertividade de cada modo aparece aqui —
            calculada automaticamente, sem edição manual.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-[10px] leading-relaxed text-zinc-600">
        Resultados passados não garantem retornos futuros. Sinais são ferramentas de análise —
        a decisão de operar e a gestão de risco são sempre do trader.
      </p>
    </section>
  );
}

function ModeCard({ data, label, sub }: { data: ModeTrackRecord; label: string; sub: string }) {
  const hasData = data.closed > 0;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>
        </div>
        {hasData && (
          <div className="text-right">
            <p className="text-2xl font-extrabold tracking-tight text-emerald-400">
              {data.winRate.toFixed(1)}%
            </p>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">assertividade</p>
          </div>
        )}
      </div>
      {hasData ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Fechados" value={String(data.closed)} />
          <Stat label="Ganhos" value={String(data.wins)} tone="win" />
          <Stat label="Perdas" value={String(data.losses)} tone="loss" />
        </div>
      ) : (
        <p className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
          Coletando primeiros resultados deste modo…
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "win" | "loss" }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-2">
      <p
        className={
          tone === "win"
            ? "text-lg font-bold text-emerald-400"
            : tone === "loss"
              ? "text-lg font-bold text-rose-400"
              : "text-lg font-bold text-zinc-200"
        }
      >
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-widest text-zinc-600">{label}</p>
    </div>
  );
}
