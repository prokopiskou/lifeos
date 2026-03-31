import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey) {
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-03-25.dahlia",
  });

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } else {
      // Dev fallback: accept the payload without signature verification.
      // In production, always set STRIPE_WEBHOOK_SECRET.
      event = JSON.parse(payload) as Stripe.Event;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid Stripe webhook signature/payload" },
      { status: 400 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as any;
  const userId = session?.metadata?.user_id;
  const stripeSubscriptionId = session?.subscription;
  const stripeCustomerId =
    typeof session?.customer === "string" ? session.customer : session?.customer?.id;

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id in metadata" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("subscriptions")
      .update({
        stripe_customer_id: stripeCustomerId ?? null,
        stripe_subscription_id: stripeSubscriptionId ?? null,
        status: "active",
      })
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("subscriptions").insert({
      user_id: userId,
      stripe_customer_id: stripeCustomerId ?? null,
      stripe_subscription_id: stripeSubscriptionId ?? null,
      status: "active",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

