"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function deleteAccountAction() {
  const { userId } = await auth();
  if (!userId) throw new Error("Não autenticado");

  // Apaga User → cascades em analyses, trades, watchlist, signals, ticks.
  await prisma.user
    .deleteMany({ where: { clerkId: userId } })
    .catch(() => null);

  redirect("/");
}

export async function updateAPIKeysAction(geminiApiKey: string | null, openaiApiKey: string | null) {
  const { userId } = await auth();
  if (!userId) throw new Error("Não autenticado");

  await prisma.user.update({
    where: { clerkId: userId },
    data: {
      geminiApiKey: geminiApiKey ? geminiApiKey.trim() : null,
      openaiApiKey: openaiApiKey ? openaiApiKey.trim() : null,
    },
  });
}

