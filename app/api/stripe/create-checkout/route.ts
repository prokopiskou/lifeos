import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getOrCreateProductAndPrice(stripe: Stripe) {
  const productName = "Life OS";
  const metadataApp = "lifeos";

  const products = await stripe.products.list({ active: true, limit: 100 });
  const existingProduct = products.data.find(
    (p) => p.name === productName && p.metadata?.app === metadataApp
  );

  const product =
    existingProduct ??
    (await stripe.products.create({
      name: productName,
      metadata: { app: metadataApp },
    }));

  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });

  const existingPrice = prices.data.find((price) => {
    const recurring = price.recurring;
    return (
      recurring?.interval === "month" &&
      price.currency === "eur" &&
      price.unit_amount === 2900
    );
  });

  const price =
    existingPrice ??
    (await stripe.prices.create({
      product: product.id,
      unit_amount: 2900,
      currency: "eur",
      recurring: { interval: "month" },
      nickname: "Life OS €29/μήνα",
    }));

  return { priceId: price.id };
}

function pricingRedirect(req: Request, checkout: string) {
  const url = new URL(req.url);
  const origin = req.headers.get("origin") ?? url.origin;
  const target = new URL("/pricing", origin);
  target.searchParams.set("checkout", checkout);
  return NextResponse.redirect(target, 303);
}

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return pricingRedirect(req, "missing_key");
  }

  let supabaseUserId: string;
  let userEmail: string | undefined;
  try {
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      const url = new URL(req.url);
      const origin = req.headers.get("origin") ?? url.origin;
      const target = new URL("/login", origin);
      target.searchParams.set("redirectTo", "/pricing");
      return NextResponse.redirect(target, 303);
    }
    supabaseUserId = userData.user.id;
    userEmail = userData.user.email ?? undefined;
  } catch {
    return pricingRedirect(req, "auth_error");
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-03-25.dahlia",
    });

    const { priceId } = await getOrCreateProductAndPrice(stripe);

    const url = new URL(req.url);
    const origin = req.headers.get("origin") ?? url.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/onboarding?payment=success`,
      cancel_url: `${origin}/pricing`,
      customer_email: userEmail,
      metadata: { user_id: supabaseUserId },
      payment_method_types: ["card"],
    });

    if (!session.url) {
      return pricingRedirect(req, "no_url");
    }

    return NextResponse.redirect(session.url, 303);
  } catch {
    return pricingRedirect(req, "stripe_error");
  }
}
