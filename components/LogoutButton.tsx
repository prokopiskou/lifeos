"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onLogout()}
      disabled={loading}
      className="fixed bottom-5 right-5 text-sm text-neutral-500 transition hover:text-neutral-700 disabled:opacity-60"
      aria-label="Αποσύνδεση"
    >
      Αποσύνδεση
    </button>
  );
}
