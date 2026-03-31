import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { normalizeOnboardingAnswers } from "@/lib/onboarding-answers";

export async function middleware(req: NextRequest) {
  // Post–Stripe Checkout: allow through so onboarding loads before webhook writes subscription.
  if (req.nextUrl.href.includes("payment=success")) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const res = NextResponse.next();

  if (!supabaseUrl || !supabaseAnonKey) {
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  async function userHasActiveSubscription(userId: string) {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (error) return false;
      return Boolean(data);
    } catch {
      return false;
    }
  }

  async function userHasCompletedOnboarding(userId: string) {
    try {
      const { data: rows, error } = await supabase
        .from("onboarding_answers")
        .select("answers")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) return false;
      const latest = Array.isArray(rows) ? rows[0] : null;
      return normalizeOnboardingAnswers(latest?.answers) !== null;
    } catch {
      return false;
    }
  }

  let hasActive = false;
  let onboardingDone = false;
  if (user) {
    [hasActive, onboardingDone] = await Promise.all([
      userHasActiveSubscription(user.id),
      userHasCompletedOnboarding(user.id),
    ]);
  }

  const referer = req.headers.get("referer") ?? "";
  // After onboarding, subscription row may lag webhook; allow dashboard (or referer from onboarding).
  const skipSubscriptionCheck =
    Boolean(user) &&
    (referer.includes("/onboarding") || pathname.startsWith("/dashboard"));

  // /onboarding — requires login + active subscription (after payment).
  // URLs with payment=success bypass middleware entirely (early return above).
  if (pathname.startsWith("/onboarding")) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", "/onboarding");
      return NextResponse.redirect(url);
    }
    if (!hasActive) {
      const url = req.nextUrl.clone();
      url.pathname = "/pricing";
      return NextResponse.redirect(url);
    }
    if (onboardingDone) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return res;
  }

  // /dashboard — requires login, subscription, and completed onboarding
  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", "/dashboard");
      return NextResponse.redirect(url);
    }
    if (!hasActive && !skipSubscriptionCheck) {
      const url = req.nextUrl.clone();
      url.pathname = "/pricing";
      return NextResponse.redirect(url);
    }
    if (!onboardingDone) {
      const url = req.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
    return res;
  }

  // /pricing — paywall; skip if already fully set up
  if (pathname.startsWith("/pricing")) {
    if (user && hasActive && onboardingDone) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    if (user && hasActive && !onboardingDone) {
      const url = req.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
    return res;
  }

  // /login, /signup — logged-in users go to the right step
  if (pathname === "/login" || pathname === "/signup") {
    if (!user) {
      return res;
    }
    if (hasActive && onboardingDone) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    if (hasActive && !onboardingDone) {
      const url = req.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
    const url = req.nextUrl.clone();
    url.pathname = "/pricing";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/pricing",
    "/pricing/:path*",
    "/login",
    "/signup",
  ],
};
