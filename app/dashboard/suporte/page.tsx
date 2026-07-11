import { LifeBuoy, MessageCircle, Mail, HelpCircle } from "lucide-react";

export const metadata = { title: "Suporte — ZaionVest" };

const FAQ = [
  {
    q: "Como instalo um robô no MetaTrader 5?",
    a: "Baixe o arquivo do robô em Meus Downloads (ou na vitrine), coloque na pasta de Experts do MetaTrader 5 e arraste-o para o gráfico do ativo indicado. Leva menos de um minuto.",
  },
  {
    q: "O que é o kill-switch?",
    a: "É uma proteção automática. Se um robô deixar de cumprir os critérios de robustez na revalidação mensal, ele recebe a ordem de parar e não abre novas operações no seu MetaTrader. As operações já abertas seguem sendo geridas até fechar.",
  },
  {
    q: "Um robô que baixei foi reprovado. E agora?",
    a: "Ele aparece como 'Reprovado' em Meus Downloads e para de abrir novas ordens sozinho. Escolha outro robô aprovado na vitrine para substituí-lo.",
  },
  {
    q: "Qual corretora e plataforma preciso?",
    a: "Você opera no MetaTrader 5. Alguns robôs são otimizados para a nossa corretora parceira (RoboForex); isso fica indicado na página de cada robô.",
  },
  {
    q: "Como funciona a cobrança e o cancelamento?",
    a: "A assinatura é mensal (R$ 47,90) via Asaas, no Pix ou cartão, e renova automaticamente. Você cancela quando quiser em Minha Conta, em um clique, sem multa.",
  },
  {
    q: "Vocês garantem lucro?",
    a: "Não. Nenhum robô garante lucro e todo investimento envolve risco de perda. Nosso trabalho é validar a robustez de cada robô, revalidá-lo todo mês e ser transparente sobre o risco.",
  },
];

export default function SuportePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <LifeBuoy className="h-6 w-6 text-[#2563EB]" />
          Suporte
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Precisa de ajuda? Fale com a gente ou veja as perguntas frequentes abaixo.
        </p>
      </div>

      {/* Canais de contato */}
      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="https://wa.me/5511940016759"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 transition hover:bg-emerald-500/[0.08]"
        >
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#25D366]/15">
            <MessageCircle className="h-5 w-5 text-[#25D366]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-offwhite">WhatsApp</h2>
            <p className="text-xs text-zinc-400">Resposta mais rápida no horário comercial</p>
          </div>
        </a>
        <a
          href="mailto:contato@jessedepaula.com.br"
          className="flex items-center gap-3 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/[0.04] p-5 transition hover:bg-[#2563EB]/[0.08]"
        >
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#2563EB]/15">
            <Mail className="h-5 w-5 text-[#2563EB]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-offwhite">E-mail</h2>
            <p className="text-xs text-zinc-400">contato@jessedepaula.com.br</p>
          </div>
        </a>
      </div>

      {/* FAQ */}
      <div className="mt-10">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-offwhite">
          <HelpCircle className="h-4 w-4 text-[#2563EB]" />
          Perguntas frequentes
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {FAQ.map((f, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold text-offwhite">{f.q}</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
