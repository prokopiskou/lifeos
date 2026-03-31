import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function resolveRedirect(redirectTo: string | null | undefined, requestUrl: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || requestUrl;
  const fallback = "/dashboard";
  const value = redirectTo || fallback;

  try {
    // If it's an absolute URL, keep it.
    // eslint-disable-next-line no-new
    new URL(value);
    return value;
  } catch {
    return new URL(value, baseUrl).toString();
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

  // After successful auth callback, always land on dashboard.
  const target = resolveRedirect("/dashboard", req.url);
  return NextResponse.redirect(target);
}

