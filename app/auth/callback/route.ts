import { NextResponse } from "next/server";

import { normalizeOnboardingAnswers } from "@/lib/onboarding-answers";
import { createClient } from "@/lib/supabase/server";

function resolveRedirect(redirectTo: string | null | undefined, requestUrl: string) {
  const fallback = "/pricing";
  const value = redirectTo || fallback;

  try {
    // If it's an absolute URL, keep it.
    // eslint-disable-next-line no-new
    new URL(value);
    return value;
  } catch {
    return new URL(value, requestUrl).toString();
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const explicitRedirectTo = url.searchParams.get("redirectTo");

  const supabase = createClient();

  if (error) {
    const target = resolveRedirect(explicitRedirectTo, req.url);
    return NextResponse.redirect(target);
  }

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If auth callback succeeded but session is missing, return to login.
  if (!user) {
    const target = resolveRedirect("/login", req.url);
    return NextResponse.redirect(target);
  }

  // Priority:
  // 1) Explicit redirectTo if present
  // 2) Derived flow: pricing vs onboarding vs dashboard
  if (explicitRedirectTo) {
    const target = resolveRedirect(explicitRedirectTo, req.url);
    return NextResponse.redirect(target);
  }

  const [{ data: subRow }, { data: onboardingRows }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("onboarding_answers")
      .select("answers")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const hasActiveSubscription = Boolean(subRow);
  const latestOnboarding = Array.isArray(onboardingRows) ? onboardingRows[0] : null;
  const onboardingDone = normalizeOnboardingAnswers(latestOnboarding?.answers) !== null;

  const nextPath = !hasActiveSubscription
    ? "/pricing"
    : onboardingDone
      ? "/dashboard"
      : "/onboarding";

  const target = resolveRedirect(nextPath, req.url);
  return NextResponse.redirect(target);
}

