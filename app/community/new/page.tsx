"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Κάτι πήγε στραβά.";
  }

  const e = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  const parts = [
    e.message?.trim(),
    e.code ? `code: ${e.code}` : null,
    e.details ? `details: ${e.details}` : null,
    e.hint ? `hint: ${e.hint}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Κάτι πήγε στραβά.";
}

export default function NewCommunityPostPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Intentionally run once: this is a one-time auth gate for this page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true;
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;

      if (user?.email === "withinsuccess@gmail.com") {
        setIsAdmin(true);
        setAuthChecked(true);
        return;
      }

      setIsAdmin(false);
      setAuthChecked(true);
      router.replace("/community");
    };

    void run().catch(() => {
      if (!active) return;
      setIsAdmin(false);
      setAuthChecked(true);
      router.replace("/community");
    });

    return () => {
      active = false;
    };
  }, []);

  async function onPublish() {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    setOk(null);

    let imageUrl: string | null = null;

    try {
      if (file) {
        const filePath = `posts/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("community")
          .upload(filePath, file, { upsert: false });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage.from("community").getPublicUrl(filePath);
        imageUrl = data.publicUrl;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error("Not authenticated");
      }

      const { error: insertError } = await supabase.from("posts").insert({
        author_id: userData.user.id,
        content: content.trim(),
        image_url: imageUrl,
        is_admin: true,
      });

      if (insertError) throw insertError;

      setContent("");
      setFile(null);
      setOk("Το post δημοσιεύτηκε.");
    } catch (e: unknown) {
      const message = formatSupabaseError(e);
      console.error("[community/new] publish failed", e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-white px-10 py-10 text-black">
        <div className="mx-auto w-full max-w-[480px] text-center text-sm text-neutral-600">
          Φόρτωση...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-white px-10 py-10 text-black">
        <div className="mx-auto w-full max-w-[480px] text-center text-sm text-neutral-600">
          Φόρτωση...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-10 py-10 text-black">
      <div className="mx-auto w-full max-w-[480px]">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-[30px] font-semibold tracking-tight">Νέο Post</h1>
          <Link href="/community" className="text-sm text-neutral-600 underline">
            Πίσω
          </Link>
        </header>

        <div className="rounded-2xl border border-black/10 p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Γράψε το μήνυμα..."
            className="h-40 w-full resize-none rounded-xl border border-black/20 p-4 text-[16px] outline-none"
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-4 block w-full text-sm"
          />

          {error ? <p className="mt-3 text-sm text-black">{error}</p> : null}
          {ok ? <p className="mt-3 text-sm text-neutral-700">{ok}</p> : null}

          <button
            type="button"
            disabled={loading || !content.trim()}
            onClick={() => void onPublish()}
            className="mt-6 w-full rounded-lg bg-black px-6 py-4 text-[18px] text-white transition hover:bg-neutral-900 disabled:opacity-50"
          >
            {loading ? "Δημοσίευση..." : "Publish"}
          </button>
        </div>
      </div>
    </main>
  );
}

