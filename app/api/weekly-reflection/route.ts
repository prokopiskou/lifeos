import { NextResponse } from "next/server";

import { clampWeek } from "@/lib/journey";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const answer1 = typeof raw.answer_1 === "string" ? raw.answer_1 : "";
  const answer2 = typeof raw.answer_2 === "string" ? raw.answer_2 : "";
  const answer3 = typeof raw.answer_3 === "string" ? raw.answer_3 : "";

  const { data: rows } = await supabase
    .from("user_journey")
    .select("current_week")
    .eq("user_id", user.id)
    .limit(1);

  const row = Array.isArray(rows) ? rows[0] : null;
  const weekNumber = clampWeek(
    typeof row?.current_week === "number" ? row.current_week : 1
  );

  const { data: existing } = await supabase
    .from("weekly_reflections")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_number", weekNumber)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, week_number: weekNumber, duplicate: true });
  }

  const { error } = await supabase.from("weekly_reflections").insert({
    user_id: user.id,
    week_number: weekNumber,
    answer_1: answer1.trim(),
    answer_2: answer2.trim(),
    answer_3: answer3.trim(),
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, week_number: weekNumber, duplicate: true });
    }
    console.error("[weekly-reflection] insert failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, week_number: weekNumber });
}
