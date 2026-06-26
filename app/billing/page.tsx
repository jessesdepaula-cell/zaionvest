import Link from "next/link";
import { ArrowRight, ShieldCheck, Check, Sparkles, AlertCircle } from "lucide-react";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-charcoal p-6 text-zinc-300">
      <div className="glass mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f12] p-8 shadow-2xl relative overflow-hidden">
        {/* Efeito decorativo de fundo */}
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        {/* Status atual do trial */}
        <div className="flex items-center gap-2 text-amber-400 border border-amber-500/20 bg-amber-500/[0.04] px-3 py-1 rounded-full w-max text-[10px] font-semibold tracking-wider uppercase">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Assinatura Requerida</span>
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-offwhite flex items-center gap-2">
          Acesso à Mesa de Análise
          <Sparkles className="h-5 w-5 text-amber-400" />
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Desbloqueie todo o poder do Trade Vision AI com análises institucionais avançadas.
        </p>

        {/* Exibição do Plano Único */}
        <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.015] p-5">
          <div className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
            Plano Único Profissional
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="num text-4xl font-extrabold text-offwhite">R$ 47,90</span>
            <span className="text-sm text-zinc-500">/mês</span>
          </div>
          <div className="mt-2 text-xs text-emerald-400/90 font-medium">
            ★ Inclui 3 dias grátis de teste
          </div>

          <div className="mt-6 space-y-3">
            {[
              "Leitura técnica SMC (Order Blocks, BOS, FVG, etc.)",
              "Leitura clássica (Suportes, Resistências, Médias Móveis)",
              "Sinais e Radar em tempo real",
              "Relatório de assertividade e estatísticas",
              "Suporte Premium e alertas instantâneos",
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs">
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mensagem de Erro se houver */}
        {searchParams && (await searchParams).error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{(await searchParams).error}</span>
          </div>
        )}

        {/* Botão de Checkout */}
        <form action="/api/billing/checkout" method="POST" className="mt-6">
          <button
            type="submit"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-charcoal shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400 hover:shadow-emerald-500/20 focus:outline-none"
          >
            Iniciar 3 dias grátis
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        </form>

        <p className="mt-4 text-center text-[10px] text-zinc-500">
          Cancele facilmente a qualquer momento. Garantia incondicional de 7 dias.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 block text-center text-xs text-zinc-400 hover:text-zinc-200 transition"
        >
          Voltar para o Dashboard
        </Link>
      </div>
    </main>
  );
}
