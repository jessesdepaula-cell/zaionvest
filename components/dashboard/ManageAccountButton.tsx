"use client";

import { useClerk } from "@clerk/nextjs";
import { KeyRound } from "lucide-react";

// Abre o painel de conta do Clerk (onde o usuário troca a senha e gerencia o
// login). Evita reconstruir o fluxo de senha à mão.
export function ManageAccountButton() {
  const { openUserProfile } = useClerk();
  return (
    <button
      type="button"
      onClick={() => openUserProfile()}
      className="inline-flex items-center gap-2 rounded-md border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.04] px-3 py-2 text-xs text-offwhite transition hover:bg-[#f5f5f5]/[0.08]"
    >
      <KeyRound className="h-3.5 w-3.5" />
      Trocar senha / gerenciar login
    </button>
  );
}
