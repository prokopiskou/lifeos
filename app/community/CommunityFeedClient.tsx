"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  is_admin: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_label: string;
  liked_by_me: boolean;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  author_label: string;
};

const ACCENT = "#C9A96E";

export default function CommunityFeedClient() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(
    null
  );
  const [accessReady, setAccessReady] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({});

  async function loadFeed() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/community/feed");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { posts: Post[] };
      setPosts(data.posts ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Κάτι πήγε στραβά.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/login?redirectTo=/community");
        return;
      }
      setAccessReady(true);
      void loadFeed();
    };
    void run();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function toggleLike(postId: string) {
    const res = await fetch("/api/community/like", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      liked: boolean;
      likesCount: number;
    };
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: data.liked, likes_count: data.likesCount }
          : p
      )
    );
  }

  async function toggleComments(postId: string) {
    const isOpen = openComments[postId];
    if (isOpen) {
      setOpenComments((prev) => ({ ...prev, [postId]: false }));
      return;
    }
    setOpenComments((prev) => ({ ...prev, [postId]: true }));
    if (comments[postId]) return;

    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    const res = await fetch(`/api/community/comments?postId=${encodeURIComponent(postId)}`);
    if (res.ok) {
      const data = (await res.json()) as { comments: Comment[] };
      setComments((prev) => ({ ...prev, [postId]: data.comments ?? [] }));
    }
    setLoadingComments((prev) => ({ ...prev, [postId]: false }));
  }

  async function addComment(postId: string) {
    const draft = (commentDrafts[postId] ?? "").trim();
    if (!draft) return;

    setPostingComment((prev) => ({ ...prev, [postId]: true }));
    const res = await fetch("/api/community/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId, content: draft }),
    });

    if (res.ok) {
      const data = (await res.json()) as { comment: Comment };
      const created = data.comment;
      if (created) {
        setComments((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] ?? []), created],
        }));
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
          )
        );
        setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      }
    }

    setPostingComment((prev) => ({ ...prev, [postId]: false }));
  }

  return (
    <main className="min-h-screen bg-white px-10 py-10 text-black">
      <div className="mx-auto w-full max-w-[480px]">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-[30px] font-semibold tracking-tight">Κοινότητα</h1>
          <Link
            href="/dashboard"
            className="text-sm text-neutral-600 underline decoration-black/20 underline-offset-4"
          >
            Πίσω
          </Link>
        </header>

        {!accessReady || loading ? (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
            <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-black/10 p-4">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadFeed()}
              className="mt-3 rounded-lg border border-black/20 px-4 py-2 text-sm"
            >
              Δοκίμασε ανανέωση
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => (
              <article
                key={post.id}
                className={[
                  "rounded-2xl border bg-white p-5",
                  post.is_admin
                    ? "border-[color:#C9A96E]"
                    : "border-black/10",
                ].join(" ")}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium text-neutral-700">
                    {post.is_admin ? "WithinSuccess" : post.author_label}
                  </div>
                  {post.is_admin ? (
                    <span
                      style={{ color: ACCENT }}
                      className="text-xs font-semibold uppercase tracking-[0.12em]"
                    >
                      WithinSuccess
                    </span>
                  ) : null}
                </div>

                <p className="text-[16px] leading-8 text-neutral-900">{post.content}</p>

                {post.image_url ? (
                  <img
                    src={post.image_url}
                    alt="Post"
                    className="mt-4 w-full rounded-xl border border-black/10 object-cover"
                  />
                ) : null}

                <div className="mt-4 flex items-center gap-4 text-sm text-neutral-600">
                  <button
                    type="button"
                    onClick={() => void toggleLike(post.id)}
                    className="transition"
                    style={{ color: post.liked_by_me ? ACCENT : "#737373" }}
                  >
                    {post.liked_by_me ? "♥" : "♡"} {post.likes_count}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleComments(post.id)}
                    className="transition hover:text-black"
                  >
                    Σχόλια ({post.comments_count})
                  </button>
                </div>

                {openComments[post.id] ? (
                  <div className="mt-4 border-t border-black/10 pt-4">
                    {loadingComments[post.id] ? (
                      <p className="text-sm text-neutral-500">Φόρτωση σχολίων...</p>
                    ) : (
                      <div>
                        {(comments[post.id] ?? []).length > 0 ? (
                          <div className="space-y-3">
                            {(comments[post.id] ?? []).map((c) => (
                              <div key={c.id} className="rounded-lg bg-neutral-50 px-3 py-2">
                                <p className="text-xs text-neutral-500">{c.author_label}</p>
                                <p className="mt-1 text-sm text-neutral-800">{c.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-neutral-500">Δεν υπάρχουν σχόλια ακόμα.</p>
                        )}

                        <div className="mt-4 flex items-center gap-2">
                          <input
                            type="text"
                            value={commentDrafts[post.id] ?? ""}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [post.id]: e.target.value,
                              }))
                            }
                            placeholder="Γράψε σχόλιο..."
                            className="h-10 flex-1 rounded-lg border border-black/15 px-3 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void addComment(post.id)}
                            disabled={postingComment[post.id] || !(commentDrafts[post.id] ?? "").trim()}
                            className="h-10 rounded-lg bg-black px-3 text-sm text-white disabled:opacity-50"
                          >
                            {postingComment[post.id] ? "..." : "Αποστολή"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

