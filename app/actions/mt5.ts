"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { seedWatchlist } from "./watchlist";

function newToken(): string {
  return "tvai_" + randomBytes(24).toString("base64url");
}

export async function createMt5Account(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Não autenticado");
  const label = String(formData.get("label") ?? "").trim() || "Conta MT5";
  const account = await prisma.mT5Account.create({
    data: { userId: user.id, label, apiToken: newToken() },
  });
  // semeia watchlist com EURUSD, USDJPY, GBPUSD, XAUUSD em SMC e Clássico
  await seedWatchlist(account.id);
  revalidatePath("/dashboard/mt5");
}

export async function rotateMt5Token(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Não autenticado");
  const id = String(formData.get("id"));
  await prisma.mT5Account.updateMany({
    where: { id, userId: user.id },
    data: { apiToken: newToken() },
  });
  revalidatePath("/dashboard/mt5");
}

export async function deleteMt5Account(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Não autenticado");
  const id = String(formData.get("id"));
  await prisma.mT5Account.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/dashboard/mt5");
}

export async function queueMt5Order(input: {
  symbol: string;
  side: "BUY" | "SELL";
  volume?: number;
  entryType?: "MARKET" | "LIMIT" | "STOP";
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  comment?: string | null;
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const user = await getOrCreateUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const account = await prisma.mT5Account.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!account) {
    return { ok: false, error: "Nenhuma conta MT5 conectada. Configure em /dashboard/mt5" };
  }

  const order = await prisma.mT5Order.create({
    data: {
      accountId: account.id,
      symbol: input.symbol,
      side: input.side,
      volume: input.volume ?? 0.01,
      entryType: input.entryType ?? "MARKET",
      entryPrice: input.entryPrice ?? null,
      stopLoss: input.stopLoss ?? null,
      takeProfit: input.takeProfit ?? null,
      comment: input.comment ?? "TradeVision",
      status: "PENDING",
    },
  });

  revalidatePath("/dashboard/mt5");
  return { ok: true, orderId: order.id };
}
