import { LifeBuoy, MessageCircle, HelpCircle, ShieldCheck, Video, Zap } from "lucide-react";

export const metadata = { title: "Suporte & FAQ — ZaionVest" };

const FAQ = [
  {
    q: "Como instalo um robô no MetaTrader 5?",
    a: "Baixe o arquivo do robô (.ex5) na Vitrine ou em Meus Downloads, abra o MT5 → Arquivo → Pasta de Dados → MQL5/Experts, cole o arquivo lá dentro e arraste-o para o gráfico do ativo e timeframe indicados. Veja nossa aba Tutoriais para o passo a passo em vídeo.",
  },
  {
    q: "Qual o capital mínimo recomendado por robô?",
    a: "Cada robô possui uma sugestão de capital recomendada (calculada para um perfil conservador, mantendo o drawdown em cerca de 5% a 8% do saldo). Essa informação fica destacada no card do robô e na página de detalhes.",
  },
  {
    q: "Quantos robôs posso usar ao mesmo tempo?",
    a: "Não há limite! Sua assinatura ZaionVest Pro permite baixar e rodar quantos robôs aprovados desejar simultaneamente, em quantas contas reais ou demo quiser.",
  },
  {
    q: "O que é o kill-switch e a revalidação mensal?",
    a: "É nossa trava automática de segurança. Todos os meses, cada robô passa por um novo teste Out-of-Sample com dados inéditos do mercado. Se o robô mantiver o padrão estatístico, ele permanece ativo. Se falhar, é desativado para proteger seu capital.",
  },
  {
    q: "Como funciona o Zaion Monitor?",
    a: "O Zaion Monitor é nossa ferramenta de telemetria ao vivo. Você instala o robô ZaionVest_Monitor no MT5 com sua Chave de Licença e acompanha o saldo, capital líquido, lucro flutuante e histórico pelo navegador, celular ou link público para investidores.",
  },
  {
    q: "Posso testar em conta Demo antes de ir para a Real?",
    a: "Com certeza! Recomendamos que novos usuários instalem os robôs em uma conta Demo no MetaTrader 5 para acompanhar a execução por alguns dias antes de migrar para a conta Real.",
  },
  {
    q: "Como funciona o cancelamento e a garantia?",
    a: "Sua assinatura não tem fidelidade nem multa. Você pode cancelar ou gerenciar sua renovação a qualquer momento em 'Minha Conta' em apenas 1 clique.",
  },
  {
    q: "Vocês garantem lucros futuros?",
    a: "Não. Mercado financeiro envolve riscos e rentabilidade passada não é garantia de resultados futuros. Nosso compromisso é entregar estratégias rigorosamente testadas em Out-of-Sample de 6 anos e filtradas por Fator de Recuperação ≥ 2.0.",
  },
];

export default function SuportePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <LifeBuoy className="h-6 w-6 text-[#2563EB]" />
          Central de Suporte & Ajuda
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Precisa de suporte com a instalação ou tirando dúvidas? Fale direto com o Gestor pelo WhatsApp ou consulte as perguntas frequentes.
        </p>
      </div>

      {/* Canais de contato */}
      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="https://wa.me/5521979506991"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 transition hover:bg-emerald-500/[0.08] hover:border-emerald-500/40 shadow-xl"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#25D366]/20 border border-[#25D366]/30">
            <MessageCircle className="h-6 w-6 text-[#25D366]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Atendimento via WhatsApp</h2>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-400">ONLINE</span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Suporte direto com o Gestor em horário comercial</p>
          </div>
        </a>

        <div className="flex items-center gap-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-6 shadow-xl">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-500/20 border border-blue-500/30">
            <Video className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Tutoriais em Vídeo</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Assista aos tutoriais gravados na aba 'Tutoriais' da plataforma</p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-6 space-y-6 shadow-2xl">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
          <HelpCircle className="h-4 w-4 text-[#2563EB]" />
          Perguntas Frequentes (FAQ)
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {FAQ.map((f, i) => (
            <div key={i} className="rounded-xl bg-[#050505] p-4 border border-white/5 space-y-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                {f.q}
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
