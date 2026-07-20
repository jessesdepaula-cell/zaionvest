import Link from "next/link";
import { Bot, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#000] text-zinc-300 px-6 text-center">
      <div className="rounded-2xl border border-[#f5f5f5]/8 bg-[#0A0A0A] p-8 max-w-md w-full shadow-2xl flex flex-col items-center">
        <div className="h-12 w-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
          <Bot className="h-6 w-6" />
        </div>
        
        <h1 className="text-xl font-bold text-[#F5F5F5] mb-2">
          Página ou Robô não encontrado
        </h1>
        <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
          A estratégia solicitada pode ter sido movida, estar em fase de análise restrita ou não existir no sistema.
        </p>

        <Link
          href="/dashboard/vitrine"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8] transition shadow-[0_4px_16px_-4px_rgba(37,99,235,0.4)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a Vitrine
        </Link>
      </div>
    </div>
  );
}
