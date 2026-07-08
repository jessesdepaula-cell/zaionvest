import Link from "next/link";
import { ArrowRight, Check, Sparkles, AlertCircle, Shield, Target, Zap, TrendingUp, HelpCircle } from "lucide-react";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#070709] text-zinc-300 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Glow de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-emerald-950/20 to-transparent blur-[120px] pointer-events-none z-0" />

      {/* Header Fixo Simples */}
      <header className="relative z-10 mx-auto max-w-6xl flex items-center justify-between px-6 py-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md border border-emerald-500/20 bg-emerald-500/5">
            <Target className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-offwhite">Zaion<span className="text-zinc-500">Vest</span></span>
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
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.03] px-3.5 py-1 text-xs text-emerald-400 font-medium tracking-wide">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Tecnologia de Mesa Proprietária
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-offwhite sm:text-6xl">
          Opere no mesmo nível dos <br />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            Fundos Institucionais.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg">
          Pare de ser liquidez para o mercado. A ZaionVest utiliza visão computacional e algoritmos inteligentes para identificar setups de alta probabilidade baseados em SMC (Smart Money Concepts) e Price Action Puro.
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
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-charcoal shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400 hover:shadow-emerald-500/20 focus:outline-none"
            >
              Iniciar meu Teste Grátis de 3 dias
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </form>
          <a
            href="#pricing"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition py-3 px-6 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
          >
            Ver Detalhes do Plano
          </a>
        </div>

        <div className="mt-4 flex items-center justify-center gap-6 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">🔒 Conexão Criptografada</span>
          <span className="flex items-center gap-1">⚡ Sem taxas ocultas</span>
          <span className="flex items-center gap-1">📅 Cancele com 1 clique</span>
        </div>
      </section>

      {/* A Cilada do Varejo vs Realidade Institucional */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-16 border-t border-white/5">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-white/5 bg-[#0a0a0c] p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
              ⚠️ A Cilada do Trader de Varejo
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Indicadores clássicos (RSI, MACD, Médias Cruzadas) são construídos sobre dados passados. O mercado institucional sabe exatamente onde os traders de varejo colocam seus stops baseando-se nesses indicadores e gera movimentos falsos para capturar essa liquidez.
            </p>
            <ul className="mt-5 space-y-2.5 text-xs text-zinc-500">
              <li className="flex items-center gap-2">❌ Entradas atrasadas em topos ou fundos</li>
              <li className="flex items-center gap-2">❌ Sinais que mudam de direção depois do movimento</li>
              <li className="flex items-center gap-2">❌ Relações Risco/Retorno desastrosas</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-emerald-500/10 bg-[#090b0a] p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 bg-emerald-500/[0.02] blur-xl" />
            <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
              🛡️ A Vantagem Profissional da ZaionVest
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              A ZaionVest ignora o ruído e mapeia o mercado conforme o Smart Money. Identificamos Fair Value Gaps (desequilíbrio de ordens), Order Blocks (onde os grandes bancos se posicionam), e calculamos planos com Risco/Retorno matemáticos favoráveis.
            </p>
            <ul className="mt-5 space-y-2.5 text-xs text-emerald-500/80">
              <li className="flex items-center gap-2">✔ Mapeamento inteligente de BOS e CHoCH</li>
              <li className="flex items-center gap-2">✔ Alvos objetivos baseados em liquidez pendente</li>
              <li className="flex items-center gap-2">✔ Relação Risco:Retorno mínima de 1:1 (média de 1:2+)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Principais Recursos */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-16 border-t border-white/5">
        <h2 className="text-center text-2xl font-bold tracking-tight text-offwhite">
          Tudo o que você precisa para dominar o mercado
        </h2>
        <p className="text-center text-sm text-zinc-400 mt-2 max-w-md mx-auto">
          Uma suíte de ferramentas projetadas para consistência matemática, sem achismos.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Target className="h-5 w-5 text-emerald-400" />}
            title="Análise com Visão Computacional"
            description="Tire um print de qualquer gráfico no TradingView ou MT4, envie na plataforma e receba a marcação técnica em segundos."
          />
          <FeatureCard
            icon={<Zap className="h-5 w-5 text-emerald-400" />}
            title="SMC e Price Action Híbrido"
            description="Entenda o viés de tendência, localize blocos de ordens institucionais e zonas de valor clássicas integradas."
          />
          <FeatureCard
            icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
            title="Radar de Setups 24/7"
            description="Monitore múltiplos ativos e timeframes. O sistema faz varreduras automáticas de mercado constantemente em segundo plano."
          />
          <FeatureCard
            icon={<Shield className="h-5 w-5 text-emerald-400" />}
            title="Gestão de Risco Blindada"
            description="Cada sinal gerado vem com preços exatos de entrada, stop loss técnico e alvos parciais estruturados."
          />
          <FeatureCard
            icon={<Check className="h-5 w-5 text-emerald-400" />}
            title="Auditor de Assertividade"
            description="Um auditor dedicado analisa e publica de forma transparente as taxas de acerto históricas de cada setup."
          />
          <FeatureCard
            icon={<Sparkles className="h-5 w-5 text-emerald-400" />}
            title="Alertas por E-mail em Tempo Real"
            description="Assim que um novo setup é confirmado, você recebe um e-mail na hora com entrada, stop e alvos — sem precisar ficar olhando a tela."
          />
        </div>
      </section>

      {/* Preço e Call to Action */}
      <section id="pricing" className="relative z-10 mx-auto max-w-3xl px-6 py-20 border-t border-white/5 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-offwhite">O investimento que se paga em poucas operações</h2>
        <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto">
          Tenha acesso ilimitado à plataforma pelo preço de um único stop loss bobo que você evitará logo no primeiro dia.
        </p>

        <div className="mt-10 mx-auto max-w-sm rounded-3xl border border-emerald-500/20 bg-[#0a0c0b] p-8 shadow-2xl relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-500/[0.03] blur-2xl pointer-events-none" />
          
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Assinatura Profissional</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              3 Dias Grátis
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="num text-5xl font-extrabold text-offwhite tracking-tight">R$ 47,90</span>
            <span className="text-sm text-zinc-500">/mês</span>
          </div>

          <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
            Seu cartão não será cobrado hoje. O período de teste é totalmente gratuito por 3 dias, cancelável a qualquer momento.
          </p>

          <div className="mt-6 border-t border-white/5 pt-6 space-y-3.5">
            {[
              "Leitura computacional de setups de fotos",
              "Varredura automática e radar de sinais ativos",
              "Modos SMC Avançado e Price Action Clássico",
              "Relação R:R mínima garantida de 1:1 por sinal",
              "Suporte técnico priorizado",
              "Cancelamento simplificado sem burocracia",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <form action="/api/billing/checkout" method="POST" className="mt-8">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-charcoal shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/35 focus:outline-none"
            >
              Começar Teste de 3 Dias Grátis
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-3 text-center text-[10px] text-zinc-500">
            Processamento 100% seguro pelo Asaas. Cancele com um clique.
          </p>
        </div>
      </section>

      {/* FAQ rápido */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-16 border-t border-white/5">
        <h2 className="text-center text-xl font-bold tracking-tight text-offwhite flex items-center justify-center gap-2">
          <HelpCircle className="h-5 w-5 text-emerald-400" />
          Perguntas Frequentes
        </h2>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-offwhite">Como funciona o teste gratuito de 3 dias?</h4>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Você cria sua assinatura hoje via cartão ou pix e seu acesso é liberado na hora. O valor só será cobrado no final do terceiro dia. Se cancelar antes, nada será cobrado.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-offwhite">O sistema realiza operações sozinho (Robô)?</h4>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Não. A ZaionVest é uma ferramenta de auxílio analítico. Ela mapeia os pontos ideais de entrada, alvo e stop, mas você executa as ordens na sua corretora favorita.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-offwhite">Quais mercados a ZaionVest suporta?</h4>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Qualquer par de moedas Forex (principais e cruzados) e as maiores Criptomoedas do mercado (Bitcoin, Ethereum, etc.).
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-offwhite">Como faço para cancelar?</h4>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              A qualquer momento você pode acessar o seu painel de configurações na plataforma e solicitar o cancelamento em um clique, sem pegadinhas.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-10 text-center text-xs text-zinc-500">
        <p>© 2026 ZaionVest. Todos os direitos reservados.</p>
        <p className="mt-1.5 text-[10px] text-zinc-600 max-w-lg mx-auto leading-relaxed">
          A ZaionVest fornece ferramentas de análise de padrões técnicos. Todo conteúdo disponibilizado tem caráter exclusivamente educacional. Não realizamos recomendações de investimentos ou promessas de lucros.
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
    <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 hover:border-white/10 transition">
      <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.02]">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-offwhite">{title}</h3>
      <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

