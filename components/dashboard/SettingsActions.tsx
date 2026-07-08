"use client";

import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/app/actions/account";

export function ExportButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error("Falha no download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = (res.headers.get("Content-Disposition") ?? "")
        .match(/filename="([^"]+)"/)?.[1] ?? `${label}.csv`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      className="inline-flex w-full items-center justify-between gap-3 rounded-md border border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.02] px-4 py-3 text-sm text-offwhite transition hover:bg-[#f0ddb0]/[0.05] disabled:opacity-50"
    >
      <span className="flex items-center gap-2">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
        ) : (
          <Download className="h-4 w-4 text-emerald-400" />
        )}
        {label}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">CSV</span>
    </button>
  );
}

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/[0.04] px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/[0.10]"
      >
        <Trash2 className="h-4 w-4" />
        Deletar minha conta
      </button>
    );
  }

  return (
    <form
      action={async () => {
        setBusy(true);
        await deleteAccountAction();
      }}
      className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-4"
    >
      <div>
        <p className="text-sm font-medium text-rose-200">
          Ação irreversível
        </p>
        <p className="mt-1 text-xs text-rose-300/80">
          Tudo é apagado: análises, diário de trades, sinais, watchlist
          e histórico. Para confirmar, digite{" "}
          <span className="num text-rose-200">DELETAR</span> abaixo.
        </p>
      </div>
      <input
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder="DELETAR"
        className="num w-full rounded-md border border-[#f0ddb0]/10 bg-charcoal px-3 py-2 text-sm text-offwhite outline-none focus:border-rose-500/50"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={phrase !== "DELETAR" || busy}
          className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-offwhite transition hover:bg-rose-400 disabled:opacity-30"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Confirmar exclusão
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setPhrase("");
          }}
          className="rounded-md border border-[#f0ddb0]/10 bg-[#f0ddb0]/[0.04] px-4 py-2 text-sm text-zinc-300 hover:bg-[#f0ddb0]/[0.08]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
