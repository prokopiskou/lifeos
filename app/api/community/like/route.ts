import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const postId = (body as { postId?: unknown }).postId;
  if (typeof postId !== "string" || !postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  let liked = false;
  if (existing?.id) {
    await supabase.from("post_likes").delete().eq("id", existing.id);
    liked = false;
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    liked = true;
  }

  const { data: likesRows } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId);

  const likesCount = likesRows?.length ?? 0;

  await supabase.from("posts").update({ likes_count: likesCount }).eq("id", postId);

  return NextResponse.json({ liked, likesCount });
}

