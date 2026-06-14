import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: το τελευταίο αδιάβαστο path_letter του χρήστη (ή null)
// POST { id }: μαρκάρει ως διαβασμένο
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ letter: null });

  const { data } = await supabase
    .from("path_letters")
    .select("id,from_stage,to_stage,letter_text,created_at")
    .eq("user_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ letter: data ?? null });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("path_letters").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
