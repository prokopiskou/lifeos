import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// WITHIN OS — Phase 7: Promote stage + personal letter
// Admin-only. Ενημερώνει profiles.within_path_stage (+ user_journey
// για συμβατότητα) και γράφει path_letters αν δοθεί letter.
// ============================================================

export const dynamic = "force-dynamic";
const ADMIN_EMAIL = "withinsuccess@gmail.com";
const STAGES = ["awake", "pause", "remember", "align", "embody"];

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const stageRaw = typeof body.stage === "string" ? body.stage.trim() : "";
  const stage = stageRaw.toLowerCase();
  const letter = typeof body.letter === "string" ? body.letter.trim() : "";
  if (!userId || !STAGES.includes(stage)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let admin;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: "Server configuration (SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 }); }

  // current stage (για το path_letter from_stage)
  const { data: prof } = await admin.from("profiles").select("within_path_stage").eq("id", userId).maybeSingle();
  const fromStage = prof?.within_path_stage ?? "awake";

  // profiles
  await admin.from("profiles").upsert(
    { id: userId, within_path_stage: stage, stage_updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );

  // user_journey (συμβατότητα με υπάρχον σύστημα — capitalized)
  const cap = stage.charAt(0).toUpperCase() + stage.slice(1);
  const { data: jrow } = await admin.from("user_journey").select("id").eq("user_id", userId).limit(1);
  if (Array.isArray(jrow) && jrow[0]) {
    await admin.from("user_journey").update({ within_path_stage: cap, updated_at: new Date().toISOString() }).eq("id", jrow[0].id);
  }

  // path_letter (αν δόθηκε)
  if (letter && fromStage !== stage) {
    await admin.from("path_letters").insert({
      user_id: userId, from_stage: fromStage, to_stage: stage, letter_text: letter,
    });
  }

  return NextResponse.json({ ok: true });
}
