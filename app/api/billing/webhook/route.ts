import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const isMock = process.env.ASAAS_MOCK === "true" || !process.env.ASAAS_API_KEY;
  if (isMock) {
    return NextResponse.json({ ok: true, mock: true });
  }

  const token = req.headers.get("asaas-access-token");
  const expectedToken = process.env.ASAAS_WEBHOOK_SECRET;
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { event, payment, subscription } = body;

  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      if (payment) {
        const customerId = payment.customer;
        const subId = payment.subscription;
        if (customerId) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              subscriptionStatus: "active",
              stripeSubId: subId ?? null,
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias de ciclo
            },
          });
        }
      }
      break;
    }
    case "PAYMENT_OVERDUE": {
      // Cobrança venceu e não foi paga: rebaixa para "em atraso" — o assinante
      // perde acesso (requireActiveSubscription só libera active/trialing) até
      // regularizar. Se depois pagar, um PAYMENT_CONFIRMED reativa.
      if (payment?.customer) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: payment.customer },
          data: { subscriptionStatus: "past_due" },
        });
      }
      break;
    }
    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_DISABLED": {
      if (subscription) {
        const subId = subscription.id;
        const customerId = subscription.customer;
        await prisma.user.updateMany({
          where: {
            OR: [
              { stripeSubId: subId },
              { stripeCustomerId: customerId }
            ]
          },
          data: {
            subscriptionStatus: "canceled",
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
