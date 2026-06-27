"use client";

import { useState } from "react";
import { Loader2, Save, Key } from "lucide-react";
import { updateAPIKeysAction } from "@/app/actions/account";

type APIKeysFormProps = {
  initialGeminiKey: string;
  initialOpenAIKey: string;
};

export function APIKeysForm({ initialGeminiKey, initialOpenAIKey }: APIKeysFormProps) {
  const [geminiKey, setGeminiKey] = useState(initialGeminiKey);
  const [openaiKey, setOpenaiKey] = useState(initialOpenAIKey);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSuccess(false);
    setError("");
    try {
      await updateAPIKeysAction(geminiKey || null, openaiKey || null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar chaves");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 block">
            Chave Google Gemini (Grátis)
          </label>
          <div className="relative">
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Cole sua GEMINI_API_KEY aqui..."
              className="w-full rounded-md border border-white/10 bg-charcoal px-3 py-2.5 text-sm text-offwhite outline-none focus:border-emerald-500/50 pr-10"
            />
            <Key className="absolute right-3 top-3 h-4 w-4 text-zinc-600" />
          </div>
          <p className="text-[10px] text-zinc-500">
            Obtenha uma chave grátis em{" "}
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 underline hover:text-emerald-300"
            >
              aistudio.google.com
            </a>
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 block">
            Chave OpenAI GPT-4o (Paga - Opcional)
          </label>
          <div className="relative">
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="Cole sua OPENAI_API_KEY aqui..."
              className="w-full rounded-md border border-white/10 bg-charcoal px-3 py-2.5 text-sm text-offwhite outline-none focus:border-emerald-500/50 pr-10"
            />
            <Key className="absolute right-3 top-3 h-4 w-4 text-zinc-600" />
          </div>
          <p className="text-[10px] text-zinc-500">
            Caso queira usar a API da OpenAI ao invés do Gemini grátis.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-charcoal transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar chaves de API
        </button>

        {success && (
          <span className="text-xs text-emerald-400 font-medium">
            ✔ Chaves atualizadas com sucesso!
          </span>
        )}
        {error && (
          <span className="text-xs text-rose-400 font-medium">
            ❌ {error}
          </span>
        )}
      </div>
    </form>
  );
}
