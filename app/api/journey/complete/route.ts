import { NextResponse } from "next/server";

import { clampWeek, type JourneyRow } from "@/lib/journey";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type JourneyDbRow = JourneyRow & { id: string; user_id: string };

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: rows } = await supabase
    .from("user_journey")
    .select("id, user_id, current_week, current_day, week_tasks_completed, total_days_active, streak")
    .eq("user_id", user.id)
    .limit(1);

  let journey = (Array.isArray(rows) ? rows[0] : null) as JourneyDbRow | null;

  if (!journey) {
    const { data: created, error: createError } = await supabase
      .from("user_journey")
      .insert({
        user_id: user.id,
        current_week: 1,
        current_day: 1,
        week_tasks_completed: 0,
        total_days_active: 0,
        streak: 0,
      })
      .select("id, user_id, current_week, current_day, week_tasks_completed, total_days_active, streak")
      .limit(1);

    if (createError || !created || created.length === 0) {
      return NextResponse.json(
        { error: "Failed to initialize journey" },
        { status: 500 }
      );
    }
    journey = created[0] as JourneyDbRow;
  }

  const currentWeek = clampWeek(journey.current_week);
  const currentDay = Math.min(Math.max(journey.current_day, 1), 7);
  const completedThisWeek = Math.max(journey.week_tasks_completed, 0);

  await supabase.from("daily_completions").insert({
    user_id: user.id,
    week_number: currentWeek,
    day_number: currentDay,
  });

  const nextCompletedThisWeek = completedThisWeek + 1;
  const nextTotalDays = Math.max(journey.total_days_active, 0) + 1;
  const nextStreak = Math.max(journey.streak, 0) + 1;
  const nextDayRaw = currentDay + 1;

  let nextWeek = currentWeek;
  let nextDay = nextDayRaw;
  let weekTasksCompleted = nextCompletedThisWeek;

  if (nextDayRaw > 7) {
    if (nextCompletedThisWeek >= 4 && currentWeek < 9) {
      nextWeek = currentWeek + 1;
      nextDay = 1;
      weekTasksCompleted = 0;
    } else {
      // Repeat current week from day 1 if fewer than 4 completed tasks.
      nextWeek = currentWeek;
      nextDay = 1;
      weekTasksCompleted = 0;
    }
  }

  const payload: JourneyRow = {
    current_week: nextWeek,
    current_day: nextDay,
    week_tasks_completed: weekTasksCompleted,
    total_days_active: nextTotalDays,
    streak: nextStreak,
  };

  const { error: updateError } = await supabase
    .from("user_journey")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", journey.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(payload);
}

