import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, author_id, content, image_url, is_admin, likes_count, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const postIds = (posts ?? []).map((p) => p.id);
  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.author_id)));

  const [{ data: comments }, { data: likes }, { data: myLikes }] = await Promise.all([
    postIds.length > 0
      ? supabase
          .from("comments")
          .select("post_id")
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
    postIds.length > 0
      ? supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
    postIds.length > 0
      ? supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", postIds)
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
  ]);

  const commentsCount = new Map<string, number>();
  for (const c of comments ?? []) {
    commentsCount.set(c.post_id, (commentsCount.get(c.post_id) ?? 0) + 1);
  }

  const likesCount = new Map<string, number>();
  for (const l of likes ?? []) {
    likesCount.set(l.post_id, (likesCount.get(l.post_id) ?? 0) + 1);
  }

  const myLikeSet = new Set((myLikes ?? []).map((l) => l.post_id));

  const profileMap = new Map<string, string>();
  for (const id of authorIds) {
    profileMap.set(id, "Μέλος");
  }

  const enriched = (posts ?? []).map((p) => ({
    ...p,
    author_label: p.is_admin ? "WithinSuccess" : profileMap.get(p.author_id) ?? "Μέλος",
    likes_count: likesCount.get(p.id) ?? p.likes_count ?? 0,
    comments_count: commentsCount.get(p.id) ?? 0,
    liked_by_me: myLikeSet.has(p.id),
  }));

  return NextResponse.json({ posts: enriched });
}

