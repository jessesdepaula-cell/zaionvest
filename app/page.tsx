import Link from "next/link";
import { TrackRecordSection } from "@/components/landing/TrackRecordSection";
import {
  ArrowRight,
  Check,
  Sparkles,
  Shield,
  Target,
  Zap,
  TrendingUp,
  HelpCircle,
  Mail,
  X,
  MessageCircle,
} from "lucide-react";

// ISR: o track record real vem do banco; revalida a cada 5 minutos.
export const revalidate = 300;

export const metadata = {
  title: "ZaionVest — Sinais SMC e Price Action com IA | 3 Dias Grátis",
  description:
    "A única plataforma brasileira com scanner automático multiativo, alertas por e-mail e histórico de assertividade auditável. Opere como os grandes com precisão de IA.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#2A1D0A] text-zinc-300 selection:bg-emerald-500/30 selection:text-emerald-300 relative overflow-hidden">
      {/* Glow de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[550px] bg-gradient-to-b from-emerald-950/20 to-transparent blur-[120px] pointer-events-none z-0" />

      {/* Header Fixo Simples */}
      <header className="relative z-10 mx-auto max-w-6xl flex items-center justify-between px-6 py-6 border-b border-[#f0ddb0]/5">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md border border-emerald-500/20 bg-emerald-500/5">
            <Target className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#F0DDB0]">
            Zaion<span className="text-zinc-500">Vest</span>
          </span>
        </div>
        <nav className="flex items-center gap-4 text-xs">
          <Link href="/sign-in" className="text-zinc-400 hover:text-zinc-200 transition">
            Entrar
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg border border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.04] px-3.5 py-2 text-[#F0DDB0] transition hover:bg-[#f0ddb0]/[0.08]"
          >
            Área de Membros
          </Link>
        </nav>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.03] px-3.5 py-1.5 text-xs text-emerald-400 font-medium tracking-wide">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
          Scanner automático 24h · Alertas por e-mail · 3 Dias 100% Grátis
        </div>

        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-[#F0DDB0] sm:text-7xl">
          Opere como as Instituições.{" "}
          <br />
          <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-200 bg-clip-text text-transparent">
            Sem achismos.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg">
          Pare de ser o stop dos grandes bancos. A ZaionVest traduz gráficos complexos em
          planos de trade claros com Entrada, Stop Loss e Alvos objetivos — e te avisa por{" "}
          <span className="text-emerald-400 font-medium">e-mail</span> quando a hora certa chega.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/sign-up"
            id="cta-hero-primary"
            className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-[#2A1D0A] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 hover:shadow-emerald-500/30 focus:outline-none"
          >
            Começar Teste de 3 Dias Grátis
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#como-funciona"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition py-4 px-6 rounded-xl border border-[#f0ddb0]/5 bg-[#f0ddb0]/[0.02] hover:bg-[#f0ddb0]/[0.05] w-full sm:w-auto text-center"
          >
            Ver como funciona
          </a>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">🔒 Pagamento seguro via Asaas</span>
          <span className="flex items-center gap-1">⚡ 3 Dias de Acesso Grátis</span>
          <span className="flex items-center gap-1">📧 Alertas por e-mail inclusos</span>
          <span className="flex items-center gap-1">📅 Cancele a qualquer momento</span>
        </div>
      </section>

      {/* ─── COMO FUNCIONA O TRIAL ─── */}
      <section id="como-funciona" className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-[#f0ddb0]/5">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">
            Teste de 3 Dias Grátis
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#F0DDB0]">
            Lucre antes de pagar
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto">
            Você tem 3 dias completos para testar, receber sinais, ver o scanner em ação e
            decidir se quer continuar. Sem cobrança antecipada.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              day: "Dia 1",
              icon: "🚀",
              title: "Acesso imediato",
              desc: "Crie sua conta e já entra tudo pronto: a mesa monitora os melhores ativos em tempo real e os sinais aparecem no seu painel em segundos.",
              color: "border-blue-500/20 bg-blue-500/[0.03]",
              textColor: "text-blue-400",
            },
            {
              day: "Dias 2–3",
              icon: "📧",
              title: "Receba sinais no e-mail",
              desc: "Quando a IA detectar uma confluência de alta probabilidade, você recebe um e-mail completo: Entrada, Stop Loss, Alvos e análise estrutural.",
              color: "border-emerald-500/20 bg-emerald-500/[0.03]",
              textColor: "text-emerald-400",
            },
            {
              day: "Após 3 dias",
              icon: "✅",
              title: "Você decide",
              desc: "Se gostar, continue por apenas R$ 47,90/mês. Se não, cancele com um clique. Sem multa, sem burocracia, sem julgamento.",
              color: "border-zinc-500/20 bg-zinc-500/[0.02]",
              textColor: "text-zinc-400",
            },
          ].map((step, i) => (
            <div key={i} className={`rounded-2xl border p-6 ${step.color} relative overflow-hidden`}>
              <div className="text-3xl mb-4">{step.icon}</div>
              <span className={`text-[10px] uppercase tracking-widest font-bold ${step.textColor}`}>
                {step.day}
              </span>
              <h3 className="mt-1 text-sm font-semibold text-[#F0DDB0]">{step.title}</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/sign-up"
            id="cta-trial-flow"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-bold text-[#2A1D0A] transition hover:bg-emerald-400"
          >
            Quero meus 3 dias grátis <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-[10px] text-zinc-600">Nenhum cartão cobrado agora.</p>
        </div>
      </section>

      {/* ─── PROBLEMA VS SOLUÇÃO ─── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-[#f0ddb0]/5">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-[#f0ddb0]/5 bg-[#3A2610] p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
              ⚠️ A Armadilha dos Indicadores Clássicos
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Robôs e indicadores convencionais reagem com atraso. Eles dizem para você comprar
              no topo e vender no fundo porque analisam apenas médias passadas. Os grandes
              investidores (Smart Money) utilizam essas zonas de stop do varejo como liquidez para
              suas próprias operações.
            </p>
            <ul className="mt-5 space-y-2.5 text-xs text-zinc-500">
              <li className="flex items-center gap-2">❌ Entradas atrasadas que causam ansiedade</li>
              <li className="flex items-center gap-2">❌ Rompimentos falsos que acionam seu stop loss</li>
              <li className="flex items-center gap-2">❌ Sem clareza de onde as ordens reais estão</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-emerald-500/10 bg-[#4A3418] p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 bg-emerald-500/[0.02] blur-xl" />
            <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
              🛡️ A Vantagem de Operar com Estrutura
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              A ZaionVest rastreia o fluxo institucional mapeando Fair Value Gaps, Order
              Blocks ativos e confirmando quebras de estrutura (BOS/CHoCH) — e te avisa{" "}
              <strong className="text-emerald-400">antes do movimento acontecer</strong>.
            </p>
            <ul className="mt-5 space-y-2.5 text-xs text-emerald-500/80">
              <li className="flex items-center gap-2">✔ Identificação precisa de regiões de oferta e demanda</li>
              <li className="flex items-center gap-2">✔ Alerta por e-mail no momento exato da oportunidade</li>
              <li className="flex items-center gap-2">✔ Operações com Risco/Retorno matematicamente calculado</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── RECURSOS ─── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-[#f0ddb0]/5">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-[#F0DDB0]">
          Recursos projetados para Traders Profissionais
        </h2>
        <p className="text-center text-sm text-zinc-400 mt-2 max-w-md mx-auto">
          Deixe a tecnologia pesada conosco e foque apenas no que importa: executar seu plano.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Target className="h-5 w-5 text-emerald-400" />}
            title="Mapeamento por Imagem"
            description="Tire print de qualquer gráfico (TradingView, MT5, Corretora) e envie. Nossa IA gera a marcação técnica exata em instantes."
          />
          <FeatureCard
            icon={<Zap className="h-5 w-5 text-emerald-400" />}
            title="SMC e Price Action Integrado"
            description="Mapeie blocos de ordens, quebras estruturais (BOS/CHoCH) e suportes/resistências clássicas no mesmo gráfico."
          />
          <FeatureCard
            icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
            title="Radar de Varredura Automática"
            description="A mesa varre os melhores ativos constantemente, em múltiplos timeframes, nos nossos servidores — você só recebe os sinais prontos."
          />
          <FeatureCard
            icon={<Mail className="h-5 w-5 text-emerald-400" />}
            title="Alertas por E-mail em Tempo Real"
            description="Quando a IA detectar uma entrada de alta probabilidade, você recebe um e-mail completo com Entrada, Stop, Alvos e análise da IA. Nenhum concorrente faz isso."
            highlight
          />
          <FeatureCard
            icon={<Shield className="h-5 w-5 text-emerald-400" />}
            title="Alvos e Stops Técnicos"
            description="Acabe com as dúvidas de saída de trade. Receba preços exatos de entrada, stop de proteção e 3 alvos progressivos com cálculo de R:R."
          />
          <FeatureCard
            icon={<Check className="h-5 w-5 text-emerald-400" />}
            title="Auditor de Assertividade"
            description="O sistema calcula automaticamente a taxa de acerto histórica de cada sinal e setup de forma 100% transparente — algo que nenhum concorrente publica."
          />
        </div>
      </section>

      {/* ─── COMPARATIVO COM CONCORRENTES ─── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-[#f0ddb0]/5">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">
            Comparativo
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#F0DDB0]">
            Por que nos escolher?
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto">
            Analisamos as alternativas disponíveis no mercado. Veja onde a ZaionVest se
            destaca.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#f0ddb0]/5">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#f0ddb0]/5 bg-[#f0ddb0]/[0.02]">
                <th className="px-5 py-3 text-left text-zinc-400 font-medium">Recurso</th>
                <th className="px-5 py-3 text-center text-zinc-400 font-medium">Plataforma A<br /><span className="text-zinc-600 text-[10px]">R$ 220/mês</span></th>
                <th className="px-5 py-3 text-center text-zinc-400 font-medium">Plataforma B<br /><span className="text-zinc-600 text-[10px]">R$ 44,90/mês</span></th>
                <th className="px-5 py-3 text-center font-bold text-emerald-400">ZaionVest<br /><span className="text-emerald-300 text-[10px]">R$ 47,90/mês</span></th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Trial gratuito", "❓ Incerto", "❌ Não", "✅ 3 dias grátis"],
                ["Scanner automático multiativo", "✅ Sim", "❌ Não", "✅ Sim"],
                ["Alertas por e-mail", "❌ Não", "❌ Não", "✅ Sim"],
                ["Cobertura Forex + Cripto", "Parcial", "❌ Não", "✅ Sim"],
                ["Histórico de assertividade", "❌ Não", "❌ Não", "✅ Auditável"],
                ["Sinais SMC + Price Action Clássico", "Parcial", "❌ Não", "✅ Sim"],
                ["Análise de gráfico por imagem", "❌ Não", "❌ Não", "✅ Sim"],
                ["100% no navegador", "✅ Sim", "Parcial", "✅ Sim"],
                ["Gráfico com E/SL/TP plotados", "✅ Sim", "✅ Sim", "✅ Sim"],
              ].map(([feature, a, b, us], i) => (
                <tr key={i} className="border-b border-[#f0ddb0]/[0.03] hover:bg-[#f0ddb0]/[0.015]">
                  <td className="px-5 py-3 text-zinc-300">{feature}</td>
                  <td className="px-5 py-3 text-center text-zinc-500">{a}</td>
                  <td className="px-5 py-3 text-center text-zinc-500">{b}</td>
                  <td className="px-5 py-3 text-center font-semibold text-emerald-400">{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── PROVA SOCIAL ─── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 border-t border-[#f0ddb0]/5">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">
            Depoimentos
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#F0DDB0]">
            O que nossos traders dizem
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {[
            {
              text: "Pela primeira vez entendi onde estou errando. Parei de entrar em trades sem contexto estrutural. Em 3 dias já vi a diferença.",
              name: "Carlos M.",
              sub: "Trader de Forex",
            },
            {
              text: "Recebi o alerta por e-mail, abri a plataforma, o setup estava lá exatamente como a IA descreveu. Fechei o trade no alvo 2.",
              name: "Priscila R.",
              sub: "Day trader — BTCUSD",
            },
            {
              text: "Achei que era mais um robô qualquer. Mas a análise de confluência SMC é diferente do que eu já vi. Renovei sem hesitar.",
              name: "Fábio L.",
              sub: "Trader desde 2019",
            },
          ].map((d, i) => (
            <div key={i} className="rounded-2xl border border-[#f0ddb0]/5 bg-[#f0ddb0]/[0.015] p-5">
              <p className="text-sm text-zinc-300 leading-relaxed">"{d.text}"</p>
              <div className="mt-4 border-t border-[#f0ddb0]/5 pt-3">
                <p className="text-xs font-semibold text-[#F0DDB0]">{d.name}</p>
                <p className="text-[10px] text-zinc-500">{d.sub}</p>
              </div>
            </div>
          ))}
        </div>

      </section>

      {/* ─── TRACK RECORD REAL (dados do banco, sem números editados) ─── */}
      <TrackRecordSection />

      {/* ─── PREÇO ─── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-3xl px-6 py-20 border-t border-[#f0ddb0]/5 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[#F0DDB0]">Domine o mercado sem gastar uma fortuna</h2>
        <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto">
          Um único stop evitado por conta de uma análise correta já paga a mensalidade por meses.
        </p>

        <div className="mt-10 mx-auto max-w-sm rounded-3xl border border-emerald-500/20 bg-[#4A3418] p-8 shadow-2xl relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-500/[0.03] blur-2xl pointer-events-none" />

          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Acesso Profissional</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              3 Dias Grátis
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="num text-5xl font-extrabold text-[#F0DDB0] tracking-tight">R$ 47,90</span>
            <span className="text-sm text-zinc-500">/mês</span>
          </div>

          <p className="mt-1 text-xs text-zinc-500">
            Após o período de teste. Cancele quando quiser.
          </p>

          <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
            <p className="text-xs font-semibold text-emerald-300">🎯 Seus 3 primeiros dias são 100% gratuitos</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Cadastre-se hoje e veja a IA trabalhando na hora. Nenhuma cobrança
              até o 4º dia. Cancele antes e não paga nada.
            </p>
          </div>

          <div className="mt-6 border-t border-[#f0ddb0]/5 pt-6 space-y-3.5">
            {[
              "Scanner automático 24h em múltiplos ativos",
              "Alertas por e-mail quando sinal é detectado",
              "Gráfico com E, SL e TP plotados visualmente",
              "Gestão de risco com R:R calculado",
              "Histórico de assertividade auditável",
              "Modos SMC e Price Action Clássico",
              "Análise de gráfico por imagem (visão computacional)",
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
            className="mt-8 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-[#2A1D0A] shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/35 focus:outline-none"
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
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-20 border-t border-[#f0ddb0]/5">
        <h2 className="text-center text-xl font-bold tracking-tight text-[#F0DDB0] flex items-center justify-center gap-2">
          <HelpCircle className="h-5 w-5 text-emerald-400" />
          Dúvidas Frequentes
        </h2>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <FaqItem
            q="O que acontece ao final dos 3 dias de teste?"
            a="Se você gostar da plataforma e decidir continuar, o Asaas processará a primeira mensalidade de R$ 47,90 automaticamente. Se decidir cancelar antes do final do terceiro dia, nenhuma cobrança será efetuada."
          />
          <FaqItem
            q="Como funcionam os alertas por e-mail?"
            a="Quando a IA detectar uma confluência de alta probabilidade em qualquer ativo monitorado pela mesa, você recebe automaticamente um e-mail com o símbolo, direção (Compra/Venda), preço de entrada, stop loss, alvos e a análise estrutural completa."
          />
          <FaqItem
            q="Eu preciso instalar algum robô ou indicador?"
            a="Não. A ZaionVest roda 100% em nuvem e através do seu navegador. Basta abrir o site e aguardar os sinais chegarem por e-mail e no painel."
          />
          <FaqItem
            q="Qual a assertividade média dos setups?"
            a="Nosso auditor interno calcula e exibe em tempo real o histórico detalhado para que você tenha total clareza matemática da performance. A taxa é 100% auditável — algo que os concorrentes não publicam."
          />
          <FaqItem
            q="Posso usar em contas de mesas proprietárias?"
            a="Com certeza. As marcações técnicas de Entrada, Stop Loss e Alvos progressivos são geradas dentro das regras de risco conservadoras recomendadas por mesas proprietárias de Forex e Cripto."
          />
          <FaqItem
            q="Quais ativos são suportados?"
            a="Forex (EUR/USD, GBP/USD, USD/JPY e mais), Cripto (BTC, ETH e outros pares) e Ouro (XAUUSD). A mesa seleciona e monitora os melhores ativos para você."
          />
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-20 border-t border-[#f0ddb0]/5 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#F0DDB0]">
          Comece agora. Sem risco.
        </h2>
        <p className="mt-4 text-sm text-zinc-400 max-w-sm mx-auto">
          3 dias para testar, receber sinais no e-mail e ver a IA trabalhando pelos seus trades.
          Se não gostar, cancela e não paga nada.
        </p>
        <Link
          href="/sign-up"
          id="cta-final"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-10 py-4 text-sm font-bold text-[#2A1D0A] shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
        >
          Quero meus 3 dias grátis <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-[10px] text-zinc-600">Sem cartão cobrado agora. Cancele quando quiser.</p>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 border-t border-[#f0ddb0]/5 py-10 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap justify-center gap-6 text-[10px] text-zinc-600 mb-6">
            <a href="#" className="hover:text-zinc-400 transition">Termos de Uso</a>
            <a href="#" className="hover:text-zinc-400 transition">Política de Privacidade</a>
            <a href="#" className="hover:text-zinc-400 transition">Aviso de Risco</a>
            <a href="mailto:contato@jessedepaula.com.br" className="hover:text-zinc-400 transition">Contato</a>
          </div>
          <p>© 2026 ZaionVest. Todos os direitos reservados.</p>
          <p className="mt-1.5 text-[10px] text-zinc-600 max-w-lg mx-auto leading-relaxed">
            A ZaionVest fornece ferramentas de análise de padrões técnicos. Todo conteúdo
            disponibilizado tem caráter exclusivamente educacional e informativo. Não realizamos
            recomendações de investimentos nem promessas de lucros. Investir em mercados
            financeiros envolve riscos significativos de perda de capital.
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
          : "border-[#f0ddb0]/5 bg-[#f0ddb0]/[0.01] hover:border-[#f0ddb0]/10"
      }`}
    >
      <div
        className={`grid h-9 w-9 place-items-center rounded-lg border ${
          highlight ? "border-emerald-500/20 bg-emerald-500/[0.08]" : "border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.02]"
        }`}
      >
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-[#F0DDB0]">
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
      <h4 className="text-sm font-semibold text-[#F0DDB0]">{q}</h4>
      <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{a}</p>
    </div>
  );
}
