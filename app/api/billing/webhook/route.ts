import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  if (process.env.STRIPE_MOCK === "true") {
    return NextResponse.json({ ok: true, mock: true });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature error: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: "active",
            stripeCustomerId: session.customer as string,
            stripeSubId: session.subscription as string,
          },
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.user.updateMany({
        where: { stripeSubId: sub.id },
        data: {
          subscriptionStatus: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
