import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always public - never redirect these.
  const isAlwaysPublicPath = pathname === "/" || pathname.startsWith("/auth");
  if (isAlwaysPublicPath) {
    return NextResponse.next();
  }
  const isAuthLandingPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/pricing");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = NextResponse.next();

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAuthLandingPath && user) {
    const [{ data: onboardingRows }, { data: subscriptionRows }] = await Promise.all([
      supabase
        .from("onboarding_answers")
        .select("id")
        .eq("user_id", user.id)
        .limit(1),
      supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .limit(5),
    ]);

    const hasOnboarding = Array.isArray(onboardingRows) && onboardingRows.length > 0;
    const hasSubscription = Array.isArray(subscriptionRows) && subscriptionRows.length > 0;

    if (hasOnboarding || hasSubscription) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isAuthLandingPath) {
    return response;
  }

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
