"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { resetAllSignals } from "@/app/actions/signals";

export function ResetSignalsButton() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    startTransition(async () => {
      const r = await resetAllSignals();
      if ("deleted" in r) setMsg(`${r.deleted} sinais apagados — começando do zero`);
      else setMsg(r.error);
      setConfirming(false);
      setTimeout(() => setMsg(null), 4000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={pending}
        className={
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-widest transition " +
          (confirming
            ? "border-rose-500/50 bg-rose-500/[0.15] text-rose-200"
            : "border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.02] text-zinc-400 hover:text-rose-300")
        }
        title="Apaga todos os sinais e zera contadores"
      >
        <Trash2 className="h-3 w-3" />
        {pending ? "Apagando…" : confirming ? "Confirmar zerar tudo" : "Zerar histórico"}
      </button>
      {msg && <span className="text-[10px] text-zinc-400">{msg}</span>}
    </div>
  );
}
