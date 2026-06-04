"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";

export const DEFAULT_WATCHLIST: Array<{ symbol: string; timeframe: string; mode: "SMC" | "CLASSICO" }> = [
  { symbol: "EURUSD", timeframe: "M15", mode: "SMC" },
  { symbol: "EURUSD", timeframe: "M15", mode: "CLASSICO" },
  { symbol: "USDJPY", timeframe: "M15", mode: "SMC" },
  { symbol: "USDJPY", timeframe: "M15", mode: "CLASSICO" },
  { symbol: "GBPUSD", timeframe: "M15", mode: "SMC" },
  { symbol: "GBPUSD", timeframe: "M15", mode: "CLASSICO" },
  { symbol: "XAUUSD", timeframe: "M15", mode: "SMC" },
  { symbol: "XAUUSD", timeframe: "M15", mode: "CLASSICO" },
];

export async function seedWatchlist(accountId: string) {
  for (const w of DEFAULT_WATCHLIST) {
    await prisma.watchlist.upsert({
      where: {
        accountId_symbol_timeframe_mode: {
          accountId,
          symbol: w.symbol,
          timeframe: w.timeframe,
          mode: w.mode,
        },
      },
      create: { accountId, ...w, active: true },
      update: {},
    });
  }
}

export async function addWatch(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Não autenticado");
  const accountId = String(formData.get("accountId"));
  const symbol = String(formData.get("symbol") ?? "").toUpperCase().trim();
  const timeframe = String(formData.get("timeframe") ?? "M15");
  const mode = String(formData.get("mode") ?? "SMC") as "SMC" | "CLASSICO";

  if (!accountId || !symbol) return;

  // valida que conta é do user
  const account = await prisma.mT5Account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return;

  await prisma.watchlist.upsert({
    where: {
      accountId_symbol_timeframe_mode: { accountId, symbol, timeframe, mode },
    },
    create: { accountId, symbol, timeframe, mode, active: true },
    update: { active: true },
  });

  revalidatePath("/dashboard/mt5");
}

export async function toggleWatch(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Não autenticado");
  const id = String(formData.get("id"));
  const w = await prisma.watchlist.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!w || w.account.userId !== user.id) return;
  await prisma.watchlist.update({ where: { id }, data: { active: !w.active } });
  revalidatePath("/dashboard/mt5");
}

export async function removeWatch(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Não autenticado");
  const id = String(formData.get("id"));
  const w = await prisma.watchlist.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!w || w.account.userId !== user.id) return;
  await prisma.watchlist.delete({ where: { id } });
  revalidatePath("/dashboard/mt5");
}
