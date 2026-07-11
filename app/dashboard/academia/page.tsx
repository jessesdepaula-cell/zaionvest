import { GraduationCap, PlayCircle, Lock } from "lucide-react";

export const metadata = { title: "Academia — ZaionVest" };

// Trilha de tutoriais. Ainda sem vídeos publicados; mostramos os módulos
// planejados com estado "em breve" para dar visibilidade ao que vem.
const MODULOS = [
  { titulo: "Primeiros passos no MetaTrader 5", desc: "Instalar, conectar a corretora e preparar o terminal para rodar os robôs." },
  { titulo: "Instalando um robô da vitrine", desc: "Baixar o .ex5, colocar na pasta de Experts e arrastar para o gráfico." },
  { titulo: "Entendendo o drawdown real", desc: "O que o número significa, por que não escondemos e como dimensionar seu capital." },
  { titulo: "Montando um portfólio", desc: "Combinar robôs de ativos diferentes para diluir risco." },
  { titulo: "Kill-switch e revalidação", desc: "Como a proteção funciona e o que fazer quando um robô é reprovado." },
];

export default function AcademiaPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <GraduationCap className="h-6 w-6 text-[#2563EB]" />
          Academia
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Tutoriais em vídeo para você tirar o máximo dos robôs — do zero à operação.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/[0.05] px-4 py-3 text-xs text-zinc-300">
        Estamos gravando os primeiros módulos. Em breve os vídeos aparecem aqui.
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MODULOS.map((m, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.015] p-5"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02]">
              <PlayCircle className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-sm font-semibold text-offwhite">{m.titulo}</h2>
              </div>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{m.desc}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-600">
                <Lock className="h-3 w-3" /> Em breve
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
