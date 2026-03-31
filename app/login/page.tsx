"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(
    null
  );
  const [initError, setInitError] = useState<string | null>(null);

  const [redirectTo, setRedirectTo] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(params.get("redirectTo") || "/dashboard");
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
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
          : "Δεν ήταν δυνατή η αρχικοποίηση σύνδεσης. Έλεγξε τα Supabase env vars."
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
        setInitError(null);
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
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace(redirectTo);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Αποτυχία σύνδεσης. Δοκίμασε ξανά."
      );
    } finally {
      setLoading(false);
    }
  }

  async function onMagicLink() {
    if (!supabase) {
      setError("Φόρτωση σύνδεσης... δοκίμασε ξανά.");
      return;
    }
    if (!email) {
      setError("Συμπλήρωσε πρώτα το email σου.");
      return;
    }

    setMagicLoading(true);
    setError(null);
    setInfo(null);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const emailRedirectTo = `${siteUrl}/auth/callback`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setMagicLoading(false);
      return;
    }

    setInfo("Στείλαμε magic link στο email σου.");
    setMagicLoading(false);
  }

  async function onForgotPassword() {
    if (!supabase) {
      setError("Φόρτωση σύνδεσης... δοκίμασε ξανά.");
      return;
    }
    if (!email) {
      setError("Συμπλήρωσε πρώτα το email σου.");
      return;
    }

    setError(null);
    setInfo(null);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const redirectTo = `${siteUrl}/login`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setInfo("Στείλαμε email επαναφοράς κωδικού.");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold">Σύνδεση</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Εισάγετε τα στοιχεία σας για να συνεχίσετε.
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="h-11 rounded-md border border-black/20 bg-white px-3 text-sm outline-none focus:border-black/50"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Κωδικός</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="h-11 rounded-md border border-black/20 bg-white px-3 text-sm outline-none focus:border-black/50"
            />
          </label>

          <button
            type="button"
            onClick={onForgotPassword}
            className="self-start text-sm font-medium text-black underline decoration-black/30 underline-offset-4 hover:decoration-black"
          >
            Forgot password?
          </button>

          {initError ? <p className="text-sm font-medium text-black">{initError}</p> : null}
          {error ? <p className="text-sm font-medium text-black">{error}</p> : null}
          {info ? <p className="text-sm font-medium text-neutral-700">{info}</p> : null}

          <button
            disabled={loading || Boolean(initError)}
            type="submit"
            className="mt-2 h-11 rounded-md bg-black px-4 text-sm font-medium text-white transition hover:bg-neutral-900 disabled:opacity-50"
          >
            {loading ? "Σύνδεση..." : "Συνδέομαι"}
          </button>

          <button
            disabled={magicLoading}
            type="button"
            onClick={onMagicLink}
            className="h-11 rounded-md border border-black/20 bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-100 disabled:opacity-50"
          >
            {magicLoading ? "Αποστολή..." : "Σύνδεση με magic link"}
          </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Δεν έχετε λογαριασμό;{" "}
          <a
            className="font-medium text-black underline decoration-black/30 underline-offset-4"
            href="/signup"
          >
            Εγγραφή
          </a>
        </p>
      </div>
    </main>
  );
}

