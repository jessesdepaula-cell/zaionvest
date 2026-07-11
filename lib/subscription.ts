import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "inactive"
  | "past_due"
  | "canceled";

/**
 * E-mail do dono do sistema (Jessé). Só ele pode executar ações destrutivas
 * como zerar o histórico. Configurável via OWNER_EMAIL; cai no padrão conhecido.
 */
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "jessesdepaula@gmail.com").toLowerCase();

/** True se o usuário é o dono do sistema (não um assinante comum). */
export function isOwner(user: { email?: string | null } | null): boolean {
  return !!user?.email && user.email.toLowerCase() === OWNER_EMAIL;
}

/**
 * FONTE ÚNICA DOS SINAIS (arquitetura global): todos os assinantes veem os MESMOS
 * sinais/estatísticas, produzidos por uma única conta mestra — a do dono do
 * sistema (OWNER_EMAIL). O scan roda só nessa conta e o dashboard de qualquer
 * assinante lê os sinais dela. Retorna o id do usuário dono, ou null se ele ainda
 * não existir no banco (nunca logou).
 */
export async function getSignalSourceUserId(): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { email: { equals: OWNER_EMAIL, mode: "insensitive" } },
    select: { id: true },
  });
  return owner?.id ?? null;
}

export async function getOrCreateUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.emailAddresses[0]?.emailAddress ?? `${clerkUser.id}@no-email.local`;

  const user = await prisma.user.upsert({
    where: { clerkId: userId },
    create: {
      clerkId: userId,
      email,
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" "),
      // Sem período grátis (decisão Jessé 2026-07-11): novo usuário nasce
      // INATIVO e cai no paywall /billing até assinar.
      subscriptionStatus: "inactive",
    },
    update: { email },
  });

  return user;
}

export async function requireActiveSubscription() {
  const user = await getOrCreateUser();
  if (!user) return { ok: false as const, reason: "unauthenticated" as const };

  let status = user.subscriptionStatus as SubscriptionStatus;

  // Se o trial expirou, atualiza para inativo no banco
  if (status === "trialing" && user.currentPeriodEnd && user.currentPeriodEnd < new Date()) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: "inactive" },
    });
    return { ok: false as const, reason: "inactive" as const, user: updated };
  }

  const active = status === "active" || status === "trialing";
  if (!active) return { ok: false as const, reason: "inactive" as const, user };

  return { ok: true as const, user };
}
