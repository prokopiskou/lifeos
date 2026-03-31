import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Singleton prevents multiple auth clients from fighting over the same cookie state.
  // We intentionally use safe fallbacks so Next.js can prerender client components
  // during `next build` even before you add env vars locally.
  const safeUrl = supabaseUrl || "http://localhost:54321";
  const safeKey = supabaseAnonKey || "";
  return createBrowserClient(safeUrl, safeKey, { isSingleton: true });
}
