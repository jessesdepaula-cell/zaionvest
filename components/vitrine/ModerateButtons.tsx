"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";

interface ModerateButtonsProps {
  eaId: string;
  eaName: string;
}

/**
 * Trava humana do staging: promove um EA STAGED para a vitrine (APPROVED) ou
 * o rejeita. Só aparece nas linhas STAGED do admin. Chama /api/ea/[id]/moderate.
 */
export function ModerateButtons({ eaId, eaName }: ModerateButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "APPROVED" | "REJECTED">(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(status: "APPROVED" | "REJECTED") {
    if (status === "REJECTED" && !confirm(`Rejeitar "${eaName}"?`)) return;
    setLoading(status);
    setError(null);
    try {
      const res = await fetch(`/api/ea/${eaId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falhou");
        setLoading(null);
        return;
      }
      // Atualiza a lista do admin (a linha sai da fila de staging).
      router.refresh();
    } catch {
      setError("Erro de conexão");
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => moderate("APPROVED")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/[0.15] disabled:opacity-50"
      >
        {loading === "APPROVED" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        Promover
      </button>
      <button
        onClick={() => moderate("REJECTED")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-1.5 text-xs font-medium text-rose-400 transition hover:bg-rose-500/[0.12] disabled:opacity-50"
      >
        {loading === "REJECTED" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <X className="h-3 w-3" />
        )}
        Rejeitar
      </button>
      {error && <span className="text-[10px] text-rose-400">{error}</span>}
    </div>
  );
}
