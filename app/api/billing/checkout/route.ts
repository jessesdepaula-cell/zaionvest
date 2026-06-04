import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", req.url));

  if (process.env.STRIPE_MOCK === "true") {
    await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: "active" },
    });
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: [
      { price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!, quantity: 1 },
    ],
    client_reference_id: user.id,
    success_url: `${new URL(req.url).origin}/dashboard?checkout=success`,
    cancel_url: `${new URL(req.url).origin}/billing?checkout=cancel`,
    metadata: { userId: user.id, clerkId: user.clerkId },
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
