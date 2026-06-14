import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { id, completed } — τσεκάρει/ξετσεκάρει ένα evidence_task (RLS: μόνο δικό του).
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const completed = Boolean(body.completed);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("evidence_tasks").update({ completed }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
