"use client";

import { useState } from "react";

export default function PricingCheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onStart() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
      });

      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      window.location.href = data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Κάτι πήγε στραβά.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={onStart}
        disabled={loading}
        className={[
          "w-full rounded-xl bg-black px-6 py-4 text-sm font-medium text-white",
          "transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60",
        ].join(" ")}
      >
        {loading ? "Κατεβάζω το checkout..." : "Ξεκίνα τώρα"}
      </button>
      {error ? (
        <p className="mt-3 text-center text-sm font-medium text-black">{error}</p>
      ) : null}
    </div>
  );
}

