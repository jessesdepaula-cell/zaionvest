"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";

/**
 * Apaga TODOS os sinais do usuário para resetar contadores/assertividade.
 * Mantém as contas MT5 e watchlist intactas.
 */
export async function resetAllSignals(): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const user = await getOrCreateUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const accounts = await prisma.mT5Account.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) {
    return { ok: true, deleted: 0 };
  }

  const result = await prisma.signal.deleteMany({
    where: { accountId: { in: accountIds } },
  });

  // Também limpa trades vinculados a esses sinais (catalogados automaticamente)
  await prisma.trade.deleteMany({
    where: { userId: user.id, signalId: { not: null } },
  });

  revalidatePath("/dashboard/sinais");
  revalidatePath("/dashboard/diario");
  revalidatePath("/dashboard/estatisticas");
  return { ok: true, deleted: result.count };
}
