"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(
    null
  );

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
    setSupabase(createClient());
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Φόρτωση σύνδεσης... δοκίμασε ξανά.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.replace(redirectTo);
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

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto flex max-w-md flex-col">
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

          {error ? <p className="text-sm font-medium text-black">{error}</p> : null}
          {info ? <p className="text-sm font-medium text-neutral-700">{info}</p> : null}

          <button
            disabled={loading}
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

