import { NextResponse } from "next/server";

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
  const redirectTo = url.searchParams.get("redirectTo");

  const supabase = createClient();

  if (error) {
    const target = resolveRedirect(redirectTo, req.url);
    return NextResponse.redirect(target);
  }

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const target = resolveRedirect(redirectTo, req.url);
  return NextResponse.redirect(target);
}

