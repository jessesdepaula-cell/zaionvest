"use client";

import { useState } from "react";
import { RefreshCw, Check, X } from "lucide-react";

interface ValidateButtonProps {
  eaId: string;
  eaName: string;
}

export function ValidateButton({ eaId, eaName }: ValidateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    status?: string;
    wfe?: number;
    message?: string;
  } | null>(null);

  async function handleValidate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/ea/${eaId}/validate`, { method: "POST" });
      const data = await res.json();
      setResult({ ok: res.ok, ...data });
    } catch {
      setResult({ ok: false, message: "Erro de conexão" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleValidate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-[#f5f5f5]/[0.08] disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Validando..." : "Revalidar"}
      </button>

      {result && (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium ${
            result.ok ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {result.ok ? (
            <Check className="h-3 w-3" />
          ) : (
            <X className="h-3 w-3" />
          )}
          {result.status === "APPROVED"
            ? `Aprovado (WFE: ${result.wfe?.toFixed(1)}%)`
            : result.status === "REJECTED"
            ? `Reprovado (WFE: ${result.wfe?.toFixed(1)}%)`
            : result.message ?? "Erro"}
        </span>
      )}
    </div>
  );
}
