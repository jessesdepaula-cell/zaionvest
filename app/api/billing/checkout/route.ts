import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { createAsaasCustomer, createAsaasSubscriptionCheckout } from "@/lib/asaas";

export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", req.url));

  // Mock SÓ quando explicitamente ligado E fora de produção. NUNCA inferir mock
  // pela ausência de ASAAS_API_KEY — senão esquecer a chave em produção liberaria
  // assinatura "active" de graça para qualquer usuário logado. Sem a chave em
  // prod, o checkout falha alto (catch abaixo → /billing?error).
  const isMock =
    process.env.ASAAS_MOCK === "true" && process.env.NODE_ENV !== "production";

  if (isMock) {
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        subscriptionStatus: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      },
    });
    return NextResponse.redirect(new URL("/dashboard?checkout=success", req.url));
  }

  try {
    // Reutiliza a coluna stripeCustomerId para armazenar o ID do cliente no Asaas
    let asaasCustomerId = user.stripeCustomerId;
    if (!asaasCustomerId) {
      asaasCustomerId = await createAsaasCustomer({
        name: user.name ?? "Cliente ZaionVest",
        email: user.email,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: asaasCustomerId },
      });
    }

    // Sem período grátis: a primeira parcela vence hoje (acesso só após pagar).
    const nextDueDate = new Date().toISOString().split("T")[0];

    const checkoutUrl = await createAsaasSubscriptionCheckout({
      customerId: asaasCustomerId,
      value: 67.00,
      cycle: "MONTHLY",
      nextDueDate,
      successUrl: `${new URL(req.url).origin}/dashboard?checkout=success`,
      cancelUrl: `${new URL(req.url).origin}/billing?checkout=cancel`,
    });

    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (err) {
    console.error("Erro no checkout Asaas:", err);
    return NextResponse.redirect(
      new URL(`/billing?error=${encodeURIComponent(err instanceof Error ? err.message : "Erro no checkout")}`, req.url)
    );
  }
}
