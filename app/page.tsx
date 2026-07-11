import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Sparkles,
  Shield,
  RefreshCw,
  Power,
  Gauge,
  Layers,
  Bot,
  Download,
  HelpCircle,
} from "lucide-react";

export const metadata = {
  title: "ZaionVest — Robôs de Trading Automático para MetaTrader 5 | 3 Dias Grátis",
  description:
    "Vitrine de robôs (Expert Advisors) validados para MetaTrader 5. Revalidação mensal, kill-switch remoto e drawdown real e transparente. Teste 3 dias grátis.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#000000] text-zinc-300 selection:bg-emerald-500/30 selection:text-emerald-300 relative overflow-hidden">
      {/* Glow de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[550px] bg-gradient-to-b from-[#2563EB]/15 to-transparent blur-[120px] pointer-events-none z-0" />

      {/* Header Fixo Simples */}
      <header className="relative z-10 mx-auto max-w-6xl flex items-center justify-between px-6 py-6 border-b border-[#f5f5f5]/5">
        <Link href="/" aria-label="ZaionVest" className="flex items-center">
          <Image
            src="/logo.png"
            alt="ZaionVest"
            width={785}
            height={145}
            priority
            className="h-9 w-auto"
            style={{ mixBlendMode: "lighten" }}
          />
        </Link>
        <nav className="flex items-center gap-4 text-xs">
          <Link href="/sign-in" className="text-zinc-400 hover:text-zinc-200 transition">
            Entrar
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.04] px-3.5 py-2 text-[#F5F5F5] transition hover:bg-[#f5f5f5]/[0.08]"
          >
            Área de Membros
          </Link>
        </nav>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[#2563EB]/40 bg-[#2563EB]/[0.08] px-3.5 py-1.5 text-xs text-[#F5F5F5] font-medium tracking-wide">
          <Sparkles className="h-3.5 w-3.5 text-[#2563EB] animate-pulse" />
          Robôs para MetaTrader 5 · Revalidação mensal · 3 Dias 100% Grátis
        </div>

        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-[#F5F5F5] sm:text-7xl">
          Robôs de trading que{" "}
          <span className="bg-gradient-to-r from-[#F5F5F5] via-[#F5F5F5] to-[#2563EB] bg-clip-text text-transparent">
            não escondem o risco.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg">
          A maioria dos robôs vendidos por aí brilha no backtest e quebra na conta real. Na
          ZaionVest, cada robô passa por uma <span className="text-[#F5F5F5] font-semibold">validação
          de robustez</span> antes de entrar na vitrine, é reavaliado todo mês e tem um{" "}
          <span className="text-[#2563EB] font-semibold">kill-switch</span> que o desliga sozinho se
          parar de funcionar. E mostramos o <span className="text-[#F5F5F5] font-semibold">drawdown
          real</span> — não o número bonito de marketing.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/sign-up"
            id="cta-hero-primary"
            className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-8 py-4 text-sm font-bold tracking-wide text-white shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)] ring-1 ring-white/10 transition hover:bg-[#1D4ED8] hover:shadow-[0_14px_50px_-8px_rgba(37,99,235,0.8)] focus:outline-none"
          >
            Começar Teste de 3 Dias Grátis
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#como-funciona"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition py-4 px-6 rounded-xl border border-[#f5f5f5]/5 bg-[#f5f5f5]/[0.02] hover:bg-[#f5f5f5]/[0.05] w-full sm:w-auto text-center"
          >
            Ver como funciona
          </a>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">🔒 Pagamento seguro via Asaas</span>
          <span className="flex items-center gap-1">⚡ 3 Dias de Acesso Grátis</span>
          <span className="flex items-center gap-1">🤖 Robôs prontos para MetaTrader 5</span>
          <span className="flex items-center gap-1">📅 Cancele a qualquer momento</span>
        </div>
      </section>

      {/* ─── COMO FUNCIONA O TRIAL ─── */}
      <section id="como-funciona" className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-[#f5f5f5]/5">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-widest text-[#2563EB] font-semibold">
            Teste de 3 Dias Grátis
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#F5F5F5]">
            Explore antes de pagar
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto">
            Você tem 3 dias completos para acessar a vitrine, baixar os robôs e colocá-los para
            rodar. Sem cobrança antecipada.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              day: "Dia 1",
              icon: "🚀",
              title: "Acesso imediato à vitrine",
              desc: "Crie sua conta e entre direto na vitrine: veja todos os robôs disponíveis, com o drawdown real e as métricas de cada um.",
              color: "border-blue-500/20 bg-blue-500/[0.03]",
              textColor: "text-blue-400",
            },
            {
              day: "Dias 2–3",
              icon: "🤖",
              title: "Coloque para rodar",
              desc: "Baixe os robôs que fizerem sentido, instale no seu MetaTrader 5 (conta demo ou real) e acompanhe funcionando.",
              color: "border-emerald-500/20 bg-emerald-500/[0.03]",
              textColor: "text-emerald-400",
            },
            {
              day: "Após 3 dias",
              icon: "✅",
              title: "Você decide",
              desc: "Se gostar, continue por apenas R$ 47,90/mês. Se não, cancele com um clique. Sem multa, sem burocracia.",
              color: "border-zinc-500/20 bg-zinc-500/[0.02]",
              textColor: "text-zinc-400",
            },
          ].map((step, i) => (
            <div key={i} className={`rounded-2xl border p-6 ${step.color} relative overflow-hidden`}>
              <div className="text-3xl mb-4">{step.icon}</div>
              <span className={`text-[10px] uppercase tracking-widest font-bold ${step.textColor}`}>
                {step.day}
              </span>
              <h3 className="mt-1 text-sm font-semibold text-[#F5F5F5]">{step.title}</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/sign-up"
            id="cta-trial-flow"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-bold text-[#000000] transition hover:bg-emerald-400"
          >
            Quero meus 3 dias grátis <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-[10px] text-zinc-600">Nenhum cartão cobrado agora.</p>
        </div>
      </section>

      {/* ─── PROBLEMA VS SOLUÇÃO ─── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-[#f5f5f5]/5">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-[#f5f5f5]/5 bg-[#0A0A0A] p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
              ⚠️ O “robô perfeito” que só funciona no passado
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              É fácil encontrar um robô com uma curva de backtest impecável. O problema é que muitos
              foram ajustados demais ao histórico — e desandam assim que encontram um mercado que
              nunca viram. Pior: continuam operando mesmo depois de parar de funcionar, drenando a
              conta em silêncio.
            </p>
            <ul className="mt-5 space-y-2.5 text-xs text-zinc-500">
              <li className="flex items-center gap-2">❌ Curvas de backtest perfeitas que não se repetem ao vivo</li>
              <li className="flex items-center gap-2">❌ Drawdown escondido ou maquiado no marketing</li>
              <li className="flex items-center gap-2">❌ Robô que segue operando mesmo depois de “quebrar”</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-emerald-500/10 bg-[#141414] p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 bg-emerald-500/[0.02] blur-xl" />
            <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
              🛡️ Robôs que precisam provar valor — e continuar provando
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Só entra na vitrine o robô que passa na nossa validação de robustez. E não para por aí:
              reavaliamos <strong className="text-emerald-400">todo mês</strong> com dados novos de
              mercado — o que degrada é retirado e desligado automaticamente na sua conta.
            </p>
            <ul className="mt-5 space-y-2.5 text-xs text-emerald-500/80">
              <li className="flex items-center gap-2">✔ Validação de robustez antes de qualquer robô ir para a vitrine</li>
              <li className="flex items-center gap-2">✔ Revalidação mensal com dados atualizados — o que degrada, sai</li>
              <li className="flex items-center gap-2">✔ Kill-switch remoto: robô que perde robustez para de operar sozinho</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── RECURSOS ─── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-[#f5f5f5]/5">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-[#F5F5F5]">
          Uma vitrine construída sobre confiança
        </h2>
        <p className="text-center text-sm text-zinc-400 mt-2 max-w-md mx-auto">
          Você escolhe o robô. Nós cuidamos de garantir que ele merece estar lá — e continuar lá.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Bot className="h-5 w-5 text-emerald-400" />}
            title="Robôs prontos para o MetaTrader 5"
            description="Baixe o Expert Advisor, coloque no MT5 e opere. Sem programar, sem configurar parâmetros — tudo já vem embutido no robô."
          />
          <FeatureCard
            icon={<Shield className="h-5 w-5 text-emerald-400" />}
            title="Validação de robustez"
            description="Cada robô passa por um processo proprietário de validação antes de aparecer para você. Só o que se prova robusto entra na vitrine."
          />
          <FeatureCard
            icon={<RefreshCw className="h-5 w-5 text-emerald-400" />}
            title="Revalidação mensal"
            description="Todo mês reavaliamos cada robô com dados novos de mercado. Se deixar de cumprir os critérios, é retirado da vitrine."
          />
          <FeatureCard
            icon={<Power className="h-5 w-5 text-emerald-400" />}
            title="Kill-switch remoto"
            description="Se um robô perder robustez, ele é desativado automaticamente no seu MetaTrader — para de abrir novas ordens sem você precisar fazer nada."
            highlight
          />
          <FeatureCard
            icon={<Gauge className="h-5 w-5 text-emerald-400" />}
            title="Drawdown real e transparente"
            description="Mostramos o rebaixamento real de cada robô, não um número de marketing. Você conhece o risco antes de ligar o robô."
          />
          <FeatureCard
            icon={<Layers className="h-5 w-5 text-emerald-400" />}
            title="Portfólio diversificado"
            description="Combine robôs de ativos e comportamentos diferentes para diluir risco. A vitrine sugere composições de portfólio prontas."
          />
        </div>
      </section>

      {/* ─── COMO COLOCAR PARA RODAR ─── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-[#f5f5f5]/5">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">
            Simples assim
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#F5F5F5]">
            Do clique ao robô operando
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              n: "1",
              icon: <Bot className="h-5 w-5 text-emerald-400" />,
              title: "Escolha o robô",
              desc: "Navegue pela vitrine, compare drawdown real, métricas e ativo de cada robô e escolha o que combina com você.",
            },
            {
              n: "2",
              icon: <Download className="h-5 w-5 text-emerald-400" />,
              title: "Baixe o arquivo",
              desc: "Um clique baixa o Expert Advisor (.ex5) pronto. O passo a passo de instalação fica dentro da plataforma.",
            },
            {
              n: "3",
              icon: <Power className="h-5 w-5 text-emerald-400" />,
              title: "Ligue no MetaTrader",
              desc: "Arraste o robô para o gráfico do ativo indicado no MetaTrader 5 e pronto — ele opera e obedece ao kill-switch remoto.",
            },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border border-[#f5f5f5]/5 bg-[#f5f5f5]/[0.01] p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02]">
                  {s.icon}
                </div>
                <span className="num text-2xl font-extrabold text-[#f5f5f5]/15">{s.n}</span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[#F5F5F5]">{s.title}</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PREÇO ─── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-3xl px-6 py-20 border-t border-[#f5f5f5]/5 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[#F5F5F5]">Acesso completo à vitrine</h2>
        <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto">
          Uma assinatura, todos os robôs. Sem taxa por robô, sem pacotes escondidos.
        </p>

        <div className="mt-10 mx-auto max-w-sm rounded-3xl border border-emerald-500/20 bg-[#141414] p-8 shadow-2xl relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-500/[0.03] blur-2xl pointer-events-none" />

          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Acesso Profissional</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              3 Dias Grátis
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="num text-5xl font-extrabold text-[#F5F5F5] tracking-tight">R$ 47,90</span>
            <span className="text-sm text-zinc-500">/mês</span>
          </div>

          <p className="mt-1 text-xs text-zinc-500">
            Após o período de teste. Cancele quando quiser.
          </p>

          <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
            <p className="text-xs font-semibold text-emerald-300">🎯 Seus 3 primeiros dias são 100% gratuitos</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Cadastre-se hoje e explore a vitrine na hora. Nenhuma cobrança
              até o 4º dia. Cancele antes e não paga nada.
            </p>
          </div>

          <div className="mt-6 border-t border-[#f5f5f5]/5 pt-6 space-y-3.5">
            {[
              "Acesso a toda a vitrine de robôs",
              "Robôs prontos para MetaTrader 5 (.ex5)",
              "Validação de robustez em cada robô",
              "Revalidação mensal com dados novos",
              "Kill-switch remoto automático",
              "Drawdown real e transparente por robô",
              "Sugestões de portfólio diversificado",
              "Cancelamento simplificado e imediato",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <Link
            href="/sign-up"
            id="cta-pricing"
            className="mt-8 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-[#000000] shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/35 focus:outline-none"
          >
            Iniciar meu Teste Grátis
            <ArrowRight className="h-4 w-4" />
          </Link>

          <p className="mt-3 text-center text-[10px] text-zinc-500">
            Assinatura processada de forma segura via Asaas (Pix ou Cartão).
          </p>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-20 border-t border-[#f5f5f5]/5">
        <h2 className="text-center text-xl font-bold tracking-tight text-[#F5F5F5] flex items-center justify-center gap-2">
          <HelpCircle className="h-5 w-5 text-emerald-400" />
          Dúvidas Frequentes
        </h2>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <FaqItem
            q="O que acontece ao final dos 3 dias de teste?"
            a="Se você gostar e decidir continuar, o Asaas processará a primeira mensalidade de R$ 47,90 automaticamente. Se cancelar antes do final do terceiro dia, nenhuma cobrança será efetuada."
          />
          <FaqItem
            q="Preciso saber programar ou configurar algo complicado?"
            a="Não. Os robôs vêm prontos, com os parâmetros já embutidos. Você só baixa o arquivo e coloca no MetaTrader 5 — o passo a passo está dentro da plataforma."
          />
          <FaqItem
            q="Como instalo um robô no MetaTrader?"
            a="Baixe o arquivo do robô na vitrine, coloque na pasta de Experts do MetaTrader 5 e arraste-o para o gráfico do ativo indicado. Leva menos de um minuto e mostramos cada passo."
          />
          <FaqItem
            q="O que é o kill-switch?"
            a="É uma proteção automática. Se um robô deixar de cumprir nossos critérios de robustez na revalidação, ele recebe a ordem de parar e não abre novas operações no seu MetaTrader. As operações já abertas seguem sendo geridas normalmente até fechar."
          />
          <FaqItem
            q="Qual corretora e plataforma eu preciso?"
            a="Você opera no MetaTrader 5. Alguns robôs são otimizados para a nossa corretora parceira (RoboForex); isso fica indicado na página de cada robô."
          />
          <FaqItem
            q="Vocês garantem lucro?"
            a="Não. Nenhum robô garante lucro e todo investimento envolve risco de perda. Nosso trabalho é validar a robustez de cada robô, reavaliá-lo todo mês e ser transparente sobre o risco (drawdown real) — não prometer retorno."
          />
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-20 border-t border-[#f5f5f5]/5 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#F5F5F5]">
          Comece agora. Sem risco de assinatura.
        </h2>
        <p className="mt-4 text-sm text-zinc-400 max-w-sm mx-auto">
          3 dias para explorar a vitrine, baixar robôs e vê-los operando. Se não gostar, cancela e
          não paga nada.
        </p>
        <Link
          href="/sign-up"
          id="cta-final"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-10 py-4 text-sm font-bold text-[#000000] shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
        >
          Quero meus 3 dias grátis <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-[10px] text-zinc-600">Sem cartão cobrado agora. Cancele quando quiser.</p>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 border-t border-[#f5f5f5]/5 py-10 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap justify-center gap-6 text-[10px] text-zinc-600 mb-6">
            <a href="#" className="hover:text-zinc-400 transition">Termos de Uso</a>
            <a href="#" className="hover:text-zinc-400 transition">Política de Privacidade</a>
            <a href="#" className="hover:text-zinc-400 transition">Aviso de Risco</a>
            <a href="mailto:contato@jessedepaula.com.br" className="hover:text-zinc-400 transition">Contato</a>
          </div>
          <p>© 2026 ZaionVest. Todos os direitos reservados.</p>
          <p className="mt-1.5 text-[10px] text-zinc-600 max-w-lg mx-auto leading-relaxed">
            A ZaionVest disponibiliza robôs de trading automático (Expert Advisors) e ferramentas
            relacionadas, com caráter informativo e educacional. Não realizamos recomendações de
            investimento nem promessas de lucro. Resultados passados não garantem resultados futuros.
            Investir em mercados financeiros envolve riscos significativos de perda de capital.
          </p>
        </div>
      </footer>

      {/* ─── BOTÃO FLUTUANTE WHATSAPP ─── */}
      <a
        href="https://wa.me/5511940016759"
        target="_blank"
        rel="noopener noreferrer"
        id="whatsapp-float"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-[#25D366]/30 transition hover:scale-110 hover:shadow-[#25D366]/50"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" aria-hidden="true">
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.12.56 4.15 1.62 5.97L0 24l6.18-1.62A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.19-1.24-6.19-3.48-8.52zM12 22a9.93 9.93 0 0 1-5.06-1.39l-.36-.22-3.67.96.98-3.58-.23-.37A9.93 9.93 0 0 1 2 12c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10zm5.47-7.48c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.34.22-.64.07-.3-.15-1.27-.47-2.42-1.49a9.07 9.07 0 0 1-1.68-2.07c-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.06 2.89 1.21 3.09.15.2 2.09 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z" />
        </svg>
      </a>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        highlight
          ? "border-emerald-500/20 bg-emerald-500/[0.03] hover:border-emerald-500/30"
          : "border-[#f5f5f5]/5 bg-[#f5f5f5]/[0.01] hover:border-[#f5f5f5]/10"
      }`}
    >
      <div
        className={`grid h-9 w-9 place-items-center rounded-lg border ${
          highlight ? "border-emerald-500/20 bg-emerald-500/[0.08]" : "border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02]"
        }`}
      >
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-[#F5F5F5]">
        {title}
        {highlight && (
          <span className="ml-2 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
            Exclusivo
          </span>
        )}
      </h3>
      <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-[#F5F5F5]">{q}</h4>
      <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{a}</p>
    </div>
  );
}
