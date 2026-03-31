"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(
    null
  );
  const [initError, setInitError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSupabase(createClient());
      setInitError(null);
    } catch (e) {
      setSupabase(null);
      setInitError(
        e instanceof Error
          ? e.message
          : "Λείπουν NEXT_PUBLIC_SUPABASE_URL ή NEXT_PUBLIC_SUPABASE_ANON_KEY στο .env.local."
      );
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    let client = supabase;
    if (!client) {
      try {
        client = createClient();
        setSupabase(client);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Δεν ήταν δυνατή η σύνδεση με το Supabase. Έλεγξε το .env.local."
        );
        return;
      }
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const emailRedirectTo = `${siteUrl}/auth/callback?redirectTo=/pricing`;

      const { data, error: signUpError } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.replace("/pricing");
        return;
      }

      setInfo("Έστειλα email επιβεβαίωσης. Επιβεβαιώστε για να συνεχίσετε.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Κάτι πήγε στραβά. Δοκίμασε ξανά ή έλεγξε τη σύνδεση."
      );
    } finally {
      setLoading(false);
    }
  }

  const clientBlocked = Boolean(initError);
  const clientPending = !supabase && !initError;
  const canSubmit = !clientBlocked && !loading && !clientPending;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold text-black">Εγγραφή</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Δημιουργήστε λογαριασμό για να ξεκινήσετε το Life OS.
          </p>

          {initError ? (
            <p className="mt-6 text-sm font-medium leading-relaxed text-black">
              {initError}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-black">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                name="email"
                autoComplete="email"
                required
                disabled={clientBlocked}
                className="h-12 rounded-xl border border-black/20 bg-white px-4 text-sm text-black outline-none transition focus:border-black/40 disabled:opacity-60"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-black">Κωδικός</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={6}
                disabled={clientBlocked}
                className="h-12 rounded-xl border border-black/20 bg-white px-4 text-sm text-black outline-none transition focus:border-black/40 disabled:opacity-60"
              />
            </label>

            {error ? (
              <p className="text-sm font-medium text-black">{error}</p>
            ) : null}
            {info ? (
              <p className="text-sm font-medium text-neutral-700">{info}</p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className={[
                "mt-2 h-12 w-full rounded-xl border border-black/20 px-4 text-sm font-medium transition",
                "bg-black text-white hover:bg-neutral-900",
                "disabled:cursor-not-allowed disabled:opacity-50",
              ].join(" ")}
            >
              {loading
                ? "Δημιουργία..."
                : clientPending
                  ? "Φόρτωση..."
                  : "Εγγραφή"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Έχετε ήδη λογαριασμό;{" "}
          <Link
            href="/login"
            className="font-medium text-black underline decoration-black/30 underline-offset-4 hover:decoration-black"
          >
            Σύνδεση
          </Link>
        </p>
      </div>
    </main>
  );
}
