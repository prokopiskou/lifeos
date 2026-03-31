import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function emailLabel(email: string | null | undefined) {
  if (!email) return "Μέλος";
  return email.split("@")[0] || "Μέλος";
}

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const postId = url.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("comments")
    .select("id, content, created_at, author_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let labelByUserId = new Map<string, string>();
  try {
    const admin = createAdminClient();
    const uniqueAuthorIds = Array.from(new Set((data ?? []).map((c) => c.author_id)));
    const labelEntries = await Promise.all(
      uniqueAuthorIds.map(async (id) => {
        const result = await admin.auth.admin.getUserById(id);
        return [id, emailLabel(result.data.user?.email)] as const;
      })
    );
    labelByUserId = new Map(labelEntries);
  } catch {
    // Fallback when service role is unavailable.
  }

  const comments = (data ?? []).map((c) => ({
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    author_label: labelByUserId.get(c.author_id) ?? "Μέλος",
  }));

  return NextResponse.json({ comments });
}

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
  const content = (body as { content?: unknown }).content;
  if (typeof postId !== "string" || !postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }
  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_id: user.id,
      content: content.trim(),
    })
    .select("id, content, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    comment: {
      id: inserted.id,
      content: inserted.content,
      created_at: inserted.created_at,
      author_label: emailLabel(user.email),
    },
  });
}

