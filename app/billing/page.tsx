import Link from "next/link";
import { ArrowRight, Check, Sparkles, AlertCircle, Shield, RefreshCw, Power, Gauge, Bot, HelpCircle } from "lucide-react";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#000000] text-zinc-300 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Glow de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-[#2563EB]/15 to-transparent blur-[120px] pointer-events-none z-0" />

      {/* Header Fixo Simples */}
      <header className="relative z-10 mx-auto max-w-6xl flex items-center justify-between px-6 py-6 border-b border-[#f5f5f5]/5">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md border border-[#2563EB]/20 bg-[#2563EB]/5">
            <Bot className="h-4 w-4 text-[#2563EB]" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-offwhite">Zaion<span className="text-[#2563EB]">Vest</span></span>
        </div>
        <Link
          href="/dashboard"
          className="text-xs text-zinc-400 hover:text-zinc-200 transition"
        >
          Voltar para o App
        </Link>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-12 text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#2563EB]/30 bg-[#2563EB]/[0.06] px-3.5 py-1 text-xs text-[#F5F5F5] font-medium tracking-wide">
          <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" />
          Ative sua assinatura para acessar a vitrine
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-offwhite sm:text-6xl">
          Robôs de trading que <br />
          <span className="bg-gradient-to-r from-[#F5F5F5] to-[#2563EB] bg-clip-text text-transparent">
            não escondem o risco.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg">
          Cada robô da vitrine passa por uma validação de robustez, é revalidado todo mês e tem
          kill-switch remoto. Assine para liberar o acesso a todos e baixá-los para o seu MetaTrader 5.
        </p>

        {/* Mensagem de Erro se houver */}
        {params.error && (
          <div className="mx-auto mt-8 max-w-md flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 text-left text-xs text-rose-300">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Falha no processamento</span>
              {params.error}
            </div>
          </div>
        )}

        {/* Botões do Hero */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <form action="/api/billing/checkout" method="POST" className="w-full sm:w-auto">
            <button
              type="submit"
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#2563EB]/20 transition hover:bg-[#1D4ED8] focus:outline-none"
            >
              Assinar e acessar a vitrine
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </form>
          <a
            href="#pricing"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition py-3 px-6 rounded-xl border border-[#f5f5f5]/5 bg-[#f5f5f5]/[0.02] hover:bg-[#f5f5f5]/[0.05]"
          >
            Ver Detalhes do Plano
          </a>
        </div>

        <div className="mt-4 flex items-center justify-center gap-6 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">🔒 Pagamento seguro via Asaas</span>
          <span className="flex items-center gap-1">⚡ Acesso imediato após pagar</span>
          <span className="flex items-center gap-1">📅 Cancele com 1 clique</span>
        </div>
      </section>

      {/* Problema vs Solução */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-16 border-t border-[#f5f5f5]/5">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-[#f5f5f5]/5 bg-[#0A0A0A] p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
              ⚠️ O “robô perfeito” que só funciona no passado
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              A maioria dos robôs vendidos por aí brilha no backtest e desanda na conta real. E o
              pior: seguem operando mesmo depois de parar de funcionar, drenando a conta.
            </p>
            <ul className="mt-5 space-y-2.5 text-xs text-zinc-500">
              <li className="flex items-center gap-2">❌ Curvas de backtest que não se repetem ao vivo</li>
              <li className="flex items-center gap-2">❌ Drawdown escondido ou maquiado no marketing</li>
              <li className="flex items-center gap-2">❌ Robô que continua operando mesmo depois de “quebrar”</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-emerald-500/10 bg-[#141414] p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 bg-emerald-500/[0.02] blur-xl" />
            <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
              🛡️ Robôs que provam valor — e continuam provando
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Só entra na vitrine o robô que passa na nossa validação de robustez. Reavaliamos todo
              mês com dados novos — o que degrada é retirado e desligado na sua conta.
            </p>
            <ul className="mt-5 space-y-2.5 text-xs text-emerald-500/80">
              <li className="flex items-center gap-2">✔ Validação de robustez antes de listar</li>
              <li className="flex items-center gap-2">✔ Revalidação mensal com dados atualizados</li>
              <li className="flex items-center gap-2">✔ Kill-switch remoto: robô que degrada para sozinho</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Principais Recursos */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-16 border-t border-[#f5f5f5]/5">
        <h2 className="text-center text-2xl font-bold tracking-tight text-offwhite">
          O que você recebe na vitrine
        </h2>
        <p className="text-center text-sm text-zinc-400 mt-2 max-w-md mx-auto">
          Robôs prontos para o MetaTrader 5, com transparência total sobre o risco.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Bot className="h-5 w-5 text-emerald-400" />}
            title="Robôs prontos para o MT5"
            description="Baixe o Expert Advisor, coloque no MetaTrader 5 e opere. Sem programar, sem configurar parâmetros."
          />
          <FeatureCard
            icon={<Shield className="h-5 w-5 text-emerald-400" />}
            title="Validação de robustez"
            description="Cada robô passa por um processo proprietário de validação antes de aparecer na vitrine."
          />
          <FeatureCard
            icon={<RefreshCw className="h-5 w-5 text-emerald-400" />}
            title="Revalidação mensal"
            description="Todo mês reavaliamos cada robô com dados novos de mercado. O que degrada é retirado."
          />
          <FeatureCard
            icon={<Power className="h-5 w-5 text-emerald-400" />}
            title="Kill-switch remoto"
            description="Robô que perde robustez é desativado automaticamente no seu MetaTrader — sem você fazer nada."
          />
          <FeatureCard
            icon={<Gauge className="h-5 w-5 text-emerald-400" />}
            title="Drawdown real"
            description="Mostramos o rebaixamento real de cada robô, não um número de marketing. Você conhece o risco antes."
          />
          <FeatureCard
            icon={<Check className="h-5 w-5 text-emerald-400" />}
            title="Portfólio diversificado"
            description="Combine robôs de ativos e comportamentos diferentes para diluir risco, com sugestões prontas."
          />
        </div>
      </section>

      {/* Preço e Call to Action */}
      <section id="pricing" className="relative z-10 mx-auto max-w-3xl px-6 py-20 border-t border-[#f5f5f5]/5 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-offwhite">Acesso completo à vitrine</h2>
        <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto">
          Uma assinatura, todos os robôs. Sem taxa por robô, sem pacotes escondidos.
        </p>

        <div className="mt-10 mx-auto max-w-sm rounded-3xl border border-emerald-500/20 bg-[#141414] p-8 shadow-2xl relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-500/[0.03] blur-2xl pointer-events-none" />

          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Assinatura Profissional</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              Acesso imediato
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="num text-5xl font-extrabold text-offwhite tracking-tight">R$ 67,00</span>
            <span className="text-sm text-zinc-500">/mês</span>
          </div>

          <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
            Cobrança mensal recorrente via Asaas. O acesso é liberado assim que o pagamento é
            confirmado. Cancele quando quiser, sem multa.
          </p>

          <div className="mt-6 border-t border-[#f5f5f5]/5 pt-6 space-y-3.5">
            {[
              "Acesso a toda a vitrine de robôs",
              "Robôs prontos para MetaTrader 5 (.ex5)",
              "Validação de robustez em cada robô",
              "Revalidação mensal com dados novos",
              "Kill-switch remoto automático",
              "Drawdown real e transparente por robô",
              "Zaion Monitor incluído: telemetria ao vivo das suas contas MT5",
              "Cancelamento simplificado e imediato",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-blue-500/15 bg-blue-500/[0.04] px-4 py-3">
            <p className="text-xs font-semibold text-blue-300">📈 O que é o Zaion Monitor?</p>
            <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
              Um painel ao vivo, incluído na assinatura, que acompanha saldo, capital líquido,
              drawdown real e lucro de todas as suas contas MetaTrader 5 em tempo real — pelo
              navegador ou celular. Você ainda gera um link público para mostrar seus resultados
              a investidores, sem precisar dar acesso à sua conta.
            </p>
          </div>

          <form action="/api/billing/checkout" method="POST" className="mt-8">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-charcoal shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/35 focus:outline-none"
            >
              Assinar agora
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-3 text-center text-[10px] text-zinc-500">
            Processamento 100% seguro pelo Asaas (Pix ou Cartão). Cancele com um clique.
          </p>
        </div>
      </section>

      {/* FAQ rápido */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-16 border-t border-[#f5f5f5]/5">
        <h2 className="text-center text-xl font-bold tracking-tight text-offwhite flex items-center justify-center gap-2">
          <HelpCircle className="h-5 w-5 text-emerald-400" />
          Perguntas Frequentes
        </h2>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-offwhite">Como funciona a cobrança?</h4>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              A assinatura é mensal (R$ 67,00) via Asaas, no Pix ou cartão. O acesso à vitrine é
              liberado assim que o pagamento é confirmado e renova automaticamente todo mês.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-offwhite">Preciso saber programar?</h4>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Não. Os robôs vêm prontos, com os parâmetros embutidos. Você baixa o arquivo e coloca
              no MetaTrader 5 — o passo a passo fica dentro da plataforma.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-offwhite">O que é o kill-switch?</h4>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Se um robô deixar de cumprir os critérios de robustez na revalidação, ele recebe a
              ordem de parar e não abre novas operações no seu MetaTrader.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-offwhite">Como faço para cancelar?</h4>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              A qualquer momento, pelo painel de configurações da plataforma, em um clique, sem
              pegadinhas.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#f5f5f5]/5 py-10 text-center text-xs text-zinc-500">
        <p>© 2026 ZaionVest. Todos os direitos reservados.</p>
        <p className="mt-1.5 text-[10px] text-zinc-600 max-w-lg mx-auto leading-relaxed">
          A ZaionVest disponibiliza robôs de trading automático (Expert Advisors). Conteúdo com
          caráter informativo e educacional. Não realizamos recomendações de investimento nem
          promessas de lucro. Investir envolve risco de perda de capital.
        </p>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#f5f5f5]/5 bg-[#f5f5f5]/[0.01] p-5 hover:border-[#f5f5f5]/10 transition">
      <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02]">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-offwhite">{title}</h3>
      <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
