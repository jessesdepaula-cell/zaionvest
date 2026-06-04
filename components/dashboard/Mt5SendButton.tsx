"use client";

import { useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import { queueMt5Order } from "@/app/actions/mt5";

function toNum(s?: string | null): number | null {
  if (!s) return null;
  const n = parseFloat(
    s.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."),
  );
  return isFinite(n) ? n : null;
}

export function Mt5SendButton({
  asset,
  direction,
  entryPrice,
  stopPrice,
  targetPrice,
}: {
  asset?: string;
  direction: "BUY" | "SELL";
  entryPrice?: string;
  stopPrice?: string;
  targetPrice?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!asset) {
      setError("Ativo não identificado");
      setState("error");
      return;
    }
    setState("sending");
    setError(null);
    const res = await queueMt5Order({
      symbol: asset.replace(/\s+/g, ""),
      side: direction,
      volume: 0.01,
      entryType: "MARKET",
      stopLoss: toNum(stopPrice),
      takeProfit: toNum(targetPrice),
      comment: "TradeVision-AI",
    });
    if (res.ok) {
      setState("ok");
      setTimeout(() => setState("idle"), 2500);
    } else {
      setError(res.error);
      setState("error");
    }
  }

  const isOk = state === "ok";
  const isSending = state === "sending";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={send}
        disabled={isSending || !asset}
        className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-xs font-medium text-charcoal transition hover:bg-amber-400 disabled:opacity-50"
      >
        {isSending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isOk ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
        {isSending ? "Enviando..." : isOk ? "Ordem enfileirada" : "Enviar para MT5"}
      </button>
      {state === "error" && error && (
        <span className="text-[10px] text-rose-400">{error}</span>
      )}
    </div>
  );
}
