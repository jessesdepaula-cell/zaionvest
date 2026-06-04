"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";

function num(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function createTrade(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Não autenticado");

  const asset = str(formData.get("asset"));
  const mode = (str(formData.get("mode")) ?? "SMC") as "CLASSICO" | "SMC";
  const direction = (str(formData.get("direction")) ?? "BUY") as "BUY" | "SELL";
  const entryPrice = num(formData.get("entryPrice"));
  const stopPrice = num(formData.get("stopPrice"));
  const targetPrice = num(formData.get("targetPrice"));
  const timeframe = str(formData.get("timeframe"));
  const notes = str(formData.get("notes"));

  if (!asset || entryPrice === null || stopPrice === null) {
    throw new Error("Preencha ativo, entrada e stop.");
  }

  await prisma.trade.create({
    data: {
      userId: user.id,
      asset,
      timeframe,
      mode,
      direction,
      entryPrice,
      stopPrice,
      targetPrice,
      notes,
      outcome: "OPEN",
    },
  });

  revalidatePath("/dashboard/diario");
  revalidatePath("/dashboard/estatisticas");
}

export async function closeTrade(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Não autenticado");

  const id = str(formData.get("id"));
  const outcome = str(formData.get("outcome")) as "WIN" | "LOSS" | "BREAKEVEN";
  const exitPrice = num(formData.get("exitPrice"));
  const pnlAmount = num(formData.get("pnlAmount"));

  if (!id || !outcome) throw new Error("Dados inválidos");

  const trade = await prisma.trade.findFirst({
    where: { id, userId: user.id },
  });
  if (!trade) throw new Error("Trade não encontrado");

  // calcula R múltiplo se temos exitPrice
  let rMultiple: number | null = null;
  if (exitPrice !== null) {
    const risk = Math.abs(trade.entryPrice - trade.stopPrice);
    if (risk > 0) {
      const reward =
        trade.direction === "BUY"
          ? exitPrice - trade.entryPrice
          : trade.entryPrice - exitPrice;
      rMultiple = Number((reward / risk).toFixed(2));
    }
  } else if (outcome === "WIN" && trade.targetPrice) {
    const risk = Math.abs(trade.entryPrice - trade.stopPrice);
    const reward = Math.abs(trade.targetPrice - trade.entryPrice);
    if (risk > 0) rMultiple = Number((reward / risk).toFixed(2));
  } else if (outcome === "LOSS") {
    rMultiple = -1;
  } else if (outcome === "BREAKEVEN") {
    rMultiple = 0;
  }

  await prisma.trade.update({
    where: { id },
    data: {
      outcome,
      exitPrice,
      pnlAmount,
      rMultiple,
      closedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/diario");
  revalidatePath("/dashboard/estatisticas");
}

export async function deleteTrade(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Não autenticado");
  const id = str(formData.get("id"));
  if (!id) return;
  await prisma.trade.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/dashboard/diario");
  revalidatePath("/dashboard/estatisticas");
}
