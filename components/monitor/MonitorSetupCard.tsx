"use client";
import { useState } from "react";
import { ChevronDown, Copy, Check, Download, KeyRound } from "lucide-react";

interface MonitorSetupCardProps {
  monitorKey: string;
}

/**
 * Card recolhível com o tutorial de instalação, a chave de licença e o
 * download do EA. Fica sempre disponível na área de membros — mesmo depois
 * que a conta já conectou — para o usuário poder copiar a chave de novo.
 */
export function MonitorSetupCard({ monitorKey }: MonitorSetupCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(monitorKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[#f5f5f5]/8 bg-[#0D0D0D] shadow-lg shadow-black/40 overflow-hidden">
      {/* Cabeçalho clicável */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#141414] transition"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F5F5F5]">
          <KeyRound className="h-4 w-4 text-blue-400" />
          Instalação &amp; Chave de Licença
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Conteúdo expansível */}
      {open && (
        <div className="border-t border-[#f5f5f5]/5 p-4 space-y-5">
          {/* Chave */}
          <div>
            <p className="text-[11px] text-zinc-500 mb-2">
              Sua <strong className="text-[#F5F5F5]">Chave de Monitoramento</strong> — cole no
              campo <code className="text-blue-400 font-mono">ApiKey</code> do robô no MT5. A mesma
              chave vale para quantas contas você quiser.
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-[#070707] p-2 border border-[#f5f5f5]/5">
              <code className="flex-1 font-mono text-[10px] text-blue-400 truncate">{monitorKey}</code>
              <button
                onClick={copyKey}
                className="rounded bg-[#141414] p-1.5 text-zinc-400 hover:bg-[#1C1C1C] hover:text-[#F5F5F5] transition"
                title="Copiar chave"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Passo a passo */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#F5F5F5] mb-2">
              Como Configurar
            </h3>
            <ol className="space-y-2.5 text-[11px] text-zinc-400 list-decimal list-inside leading-relaxed">
              <li>Baixe o robô compilado abaixo e copie o arquivo <code className="text-[#F5F5F5] bg-[#141414] px-1 py-0.5 rounded font-mono">.ex5</code>.</li>
              <li>No MT5: <strong className="text-zinc-300">Arquivo → Pasta de Dados</strong>, cole em <code className="text-[#F5F5F5] bg-[#141414] px-1 py-0.5 rounded font-mono">MQL5/Experts/</code>.</li>
              <li>
                <strong className="text-zinc-300">Ferramentas → Opções → Expert Advisors</strong>: marque
                &quot;Permitir WebRequest&quot; e adicione a URL{" "}
                <code className="text-blue-400 font-mono">https://zaionvest.com.br</code>.
              </li>
              <li>Arraste o <code className="text-[#F5F5F5] bg-[#141414] px-1 py-0.5 rounded font-mono">ZaionVest_Monitor</code> para um gráfico e cole a chave no campo <code className="text-blue-400 font-mono">ApiKey</code>.</li>
            </ol>
          </div>

          {/* Download */}
          <a
            href="/ZaionVest_Monitor.ex5"
            download
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Baixar ZaionVest_Monitor.ex5
          </a>
        </div>
      )}
    </div>
  );
}
