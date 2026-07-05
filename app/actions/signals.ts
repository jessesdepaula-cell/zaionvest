"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateUser, isOwner } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";

/**
 * Apaga TODOS os sinais do usuário para resetar contadores/assertividade.
 * Mantém a watchlist intacta.
 *
 * AÇÃO RESTRITA AO DONO: assinantes não podem zerar histórico. A checagem é
 * feita no servidor (não só escondendo o botão) para bloquear chamadas diretas.
 */
export async function resetAllSignals(): Promise<
  { ok: true; deleted: number } | { ok: false; error: string }
> {
  const user = await getOrCreateUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  if (!isOwner(user)) return { ok: false, error: "Ação disponível apenas para o administrador" };

  const result = await prisma.signal.deleteMany({ where: { userId: user.id } });

  // Limpa trades catalogados automaticamente a partir de sinais
  await prisma.trade.deleteMany({
    where: { userId: user.id, signalId: { not: null } },
  });

  revalidatePath("/dashboard/sinais");
  revalidatePath("/dashboard/diario");
  revalidatePath("/dashboard/estatisticas");
  return { ok: true, deleted: result.count };
}
