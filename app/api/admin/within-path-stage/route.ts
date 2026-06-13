import { NextResponse } from "next/server";

import { WITHIN_PATH_STAGE_DB_VALUES } from "@/lib/within-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "withinsuccess@gmail.com";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as { userId?: unknown; within_path_stage?: unknown };
  const userId = typeof raw.userId === "string" ? raw.userId.trim() : "";
  const stage =
    typeof raw.within_path_stage === "string" ? raw.within_path_stage.trim() : "";

  if (!userId || !WITHIN_PATH_STAGE_DB_VALUES.includes(stage as (typeof WITHIN_PATH_STAGE_DB_VALUES)[number])) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[admin/within-path-stage] admin client", e);
    return NextResponse.json({ error: "Server configuration" }, { status: 500 });
  }

  const { data: rows, error: fetchError } = await admin
    .from("user_journey")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    const { error: insertError } = await admin.from("user_journey").insert({
      user_id: userId,
      current_week: 1,
      current_day: 1,
      week_tasks_completed: 0,
      total_days_active: 0,
      streak: 0,
      best_streak: 0,
      within_path_stage: stage,
    });
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await admin
    .from("user_journey")
    .update({ within_path_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", row.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
