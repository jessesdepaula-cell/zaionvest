import Link from "next/link";
import { getGlobalTrackRecord, type GlobalTrackRecord, type ModeTrackRecord } from "@/lib/trackRecord";
import { TrendingUp, TrendingDown, Target, Zap, Trophy, ArrowRight, Sparkles } from "lucide-react";

/**
 * Seção pública de PROVA VIVA — números reais do scanner (sinais fechados),
 * apresentados para converter visitantes em assinantes do trial de 3 dias.
 * Renderizada no servidor com ISR (revalida a cada 5 min via revalidate da page).
 */
export async function TrackRecordSection() {
  let data: GlobalTrackRecord | null = null;
  try {
    data = await getGlobalTrackRecord();
  } catch {
    return null;
  }
  if (!data) return null;

  const totalClosed = data.smc.closed + data.classico.closed;
  const totalWins = data.smc.wins + data.classico.wins;
  const totalTP2 = data.smc.tp2 + data.classico.tp2;
  const totalTP3 = data.smc.tp3 + data.classico.tp3;
  const totalR = Math.round((data.smc.rTotal + data.classico.rTotal) * 100) / 100;
  const overallWinRate = totalClosed > 0 ? Math.round((totalWins / totalClosed) * 1000) / 10 : 0;
  const hasSample = totalClosed >= 3;

  return (
    <section id="resultados" className="relative z-10 mx-auto max-w-6xl px-6 py-24 border-t border-white/5">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-500/[0.06] via-emerald-500/[0.02] to-transparent blur-3xl" />

      <div className="relative">
        {/* Cabeçalho ao vivo */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Placar ao vivo — atualizado agora
          </div>
          <h2 className="text-balance text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            A prova está no <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">próprio scanner</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Cada sinal é fechado automaticamente como ganho ou perda quando o preço toca alvo ou stop.
            <span className="text-zinc-300"> Zero número editado à mão.</span> É o mesmo histórico que o assinante acompanha por dentro.
          </p>
        </div>

        {hasSample ? (
          <>
            {/* HERO STATS — 4 números gigantes */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HeroStat
                icon={<Target className="h-4 w-4" />}
                value={`${overallWinRate.toFixed(1)}%`}
                label="Assertividade geral"
                accent="emerald"
              />
              <HeroStat
                icon={<Trophy className="h-4 w-4" />}
                value={String(totalWins)}
                label="Trades vencedores"
                accent="emerald"
              />
              <HeroStat
                icon={<Zap className="h-4 w-4" />}
                value={`${totalR > 0 ? "+" : ""}${totalR.toFixed(1)}R`}
                label="Retorno acumulado"
                accent={totalR >= 0 ? "emerald" : "rose"}
              />
              <HeroStat
                icon={<TrendingUp className="h-4 w-4" />}
                value={String(totalTP2 + totalTP3)}
                label="Trades no TP2/TP3"
                accent="emerald"
              />
            </div>

            {/* Cards por operacional */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ModeCard data={data.smc} label="Operacional SMC" />
              <ModeCard data={data.classico} label="Operacional Clássico" />
            </div>

            {/* Últimos ganhos — feed persuasivo */}
            {data.recent.length > 0 && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.01]">
                <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-300">
                      Últimos {data.recent.length} sinais fechados
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                    dados do banco em tempo real
                  </span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {data.recent.map((r, i) => {
                    const win = r.status === "WIN";
                    const buy = r.direction?.startsWith("COMPRA");
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-xs transition hover:bg-white/[0.02]">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={
                            win
                              ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/[0.10]"
                              : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/[0.10]"
                          }>
                            {buy ? (
                              <TrendingUp className={win ? "h-3.5 w-3.5 text-emerald-400" : "h-3.5 w-3.5 text-rose-400"} />
                            ) : (
                              <TrendingDown className={win ? "h-3.5 w-3.5 text-emerald-400" : "h-3.5 w-3.5 text-rose-400"} />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-zinc-100">{r.symbol}</span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-500">{r.timeframe}</span>
                          <span className="rounded border border-white/10 bg-white/[0.02] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-400">
                            {r.mode === "SMC" ? "SMC" : "Clássico"}
                          </span>
                          {r.closedAt && (
                            <span className="hidden text-[10px] text-zinc-600 sm:inline">
                              {new Date(r.closedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {r.rMultiple !== null && (
                            <span className={win ? "num text-sm font-bold text-emerald-400" : "num text-sm font-bold text-rose-400"}>
                              {r.rMultiple > 0 ? "+" : ""}{r.rMultiple.toFixed(2)}R
                            </span>
                          )}
                          <span className={
                            win
                              ? "rounded-md border border-emerald-500/30 bg-emerald-500/[0.10] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300"
                              : "rounded-md border border-rose-500/30 bg-rose-500/[0.10] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-rose-300"
                          }>
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
          <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.04] to-transparent p-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/[0.08]">
              <Zap className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-white">
              {data.totalSignals} sinais já emitidos pelo scanner
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
              O placar público começa assim que os primeiros trades fecharem — e você acompanha em tempo real,
              sem edição manual. Enquanto isso, os assinantes já operam no painel completo.
            </p>
          </div>
        )}

        {/* CTA — TRIAL DE 3 DIAS */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.10] via-emerald-500/[0.04] to-transparent p-8 text-center sm:p-10">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-black/40 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            Teste 3 dias 100% grátis
          </div>
          <h3 className="text-balance text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Opere com o scanner por 3 dias.<br />
            <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
              Se pagar o trade, você assina.
            </span>
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            Sem cartão obrigatório na entrada. Você acessa os mesmos sinais que geraram o placar acima —
            e decide se vale a assinatura DEPOIS de ver o resultado no seu próprio operacional.
          </p>
          <Link
            href="/sign-up"
            className="group mt-6 inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500 px-6 py-3.5 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
          >
            Começar teste grátis agora
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-4 text-[11px] text-zinc-500">
            Cancele em 1 clique se não quiser continuar. Sem pegadinha.
          </p>
        </div>

        <p className="mt-8 text-center text-[10px] leading-relaxed text-zinc-600">
          Resultados passados não garantem retornos futuros. Sinais são ferramentas de análise —
          a decisão de operar e a gestão de risco são sempre do trader.
        </p>
      </div>
    </section>
  );
}

function HeroStat({
  icon, value, label, accent,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent: "emerald" | "rose";
}) {
  const isEmerald = accent === "emerald";
  return (
    <div className={
      isEmerald
        ? "relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-5"
        : "relative overflow-hidden rounded-2xl border border-rose-500/25 bg-gradient-to-b from-rose-500/[0.08] to-transparent p-5"
    }>
      <div className={isEmerald ? "text-emerald-400" : "text-rose-400"}>{icon}</div>
      <p className={
        isEmerald
          ? "num mt-3 text-3xl font-extrabold tracking-tight text-emerald-300 sm:text-4xl"
          : "num mt-3 text-3xl font-extrabold tracking-tight text-rose-300 sm:text-4xl"
      }>
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
  );
}

function ModeCard({ data, label }: { data: ModeTrackRecord; label: string }) {
  const hasData = data.closed > 0;
  const tp1Pct = data.closed > 0 ? Math.round((data.tp1 / data.closed) * 100) : 0;
  const tp2Pct = data.closed > 0 ? Math.round((data.tp2 / data.closed) * 100) : 0;
  const tp3Pct = data.closed > 0 ? Math.round((data.tp3 / data.closed) * 100) : 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-emerald-500 font-semibold">Operacional</p>
          <p className="mt-0.5 text-xl font-bold tracking-tight text-white">{label}</p>
        </div>
        {hasData && (
          <div className="text-right">
            <p className="num text-3xl font-extrabold tracking-tight text-emerald-300 sm:text-4xl">
              {data.winRate.toFixed(1)}%
            </p>
            <p className="text-[9px] uppercase tracking-widest text-zinc-500">assertividade</p>
          </div>
        )}
      </div>

      {hasData ? (
        <>
          {/* Barra de assertividade */}
          <div className="mb-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-1000"
                style={{ width: `${Math.min(100, data.winRate)}%` }}
              />
            </div>
          </div>

          {/* Trades: fechados / ganhos / perdas */}
          <div className="mb-5 grid grid-cols-3 gap-2">
            <MicroStat value={data.closed} label="Trades" />
            <MicroStat value={data.wins} label="Ganhos" tone="win" />
            <MicroStat value={data.losses} label="Perdas" tone="loss" />
          </div>

          {/* Alvos atingidos */}
          <div>
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
              Alvos conquistados
            </p>
            <div className="space-y-1.5">
              <TargetBar label="TP1" count={data.tp1} pct={tp1Pct} />
              <TargetBar label="TP2" count={data.tp2} pct={tp2Pct} />
              <TargetBar label="TP3" count={data.tp3} pct={tp3Pct} />
            </div>
          </div>

          {/* Rodapé: melhor trade + retorno */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/5 pt-4 text-[11px]">
            <div>
              <p className="text-zinc-500">Retorno acumulado</p>
              <p className={
                data.rTotal >= 0
                  ? "num mt-0.5 text-lg font-bold text-emerald-400"
                  : "num mt-0.5 text-lg font-bold text-rose-400"
              }>
                {data.rTotal > 0 ? "+" : ""}{data.rTotal.toFixed(2)}R
              </p>
            </div>
            {data.bestWin > 0 && (
              <div className="text-right">
                <p className="text-zinc-500">Melhor trade</p>
                <p className="num mt-0.5 text-lg font-bold text-emerald-300">
                  +{data.bestWin.toFixed(2)}R
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <p className="text-xs text-zinc-400">Coletando primeiros resultados deste operacional…</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            O placar atualiza automaticamente conforme os trades fecham
          </p>
        </div>
      )}
    </div>
  );
}

function MicroStat({ value, label, tone }: { value: number; label: string; tone?: "win" | "loss" }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-2.5 text-center">
      <p className={
        tone === "win"
          ? "num text-2xl font-bold leading-none text-emerald-400"
          : tone === "loss"
            ? (value > 0 ? "num text-2xl font-bold leading-none text-rose-400" : "num text-2xl font-bold leading-none text-zinc-500")
            : "num text-2xl font-bold leading-none text-zinc-100"
      }>
        {value}
      </p>
      <p className="mt-1.5 text-[9px] uppercase tracking-widest text-zinc-500 leading-tight">{label}</p>
    </div>
  );
}

function TargetBar({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-8 text-[10px] font-bold text-emerald-400/80">{label}</span>
      <div className="flex-1 h-2 overflow-hidden rounded-full bg-white/[0.03]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/90 transition-all duration-1000"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="num w-16 text-right text-[11px] font-semibold text-zinc-300">
        {count} <span className="text-zinc-600">({pct}%)</span>
      </span>
    </div>
  );
}
