import { NextResponse } from "next/server";

import { getDateStringAthens } from "@/lib/athens-date";
import { clampWeek, type JourneyRow } from "@/lib/journey";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type JourneyDbRow = JourneyRow & { id: string; user_id: string };

const SELECT_WITH_BEST =
  "id, user_id, current_week, current_day, week_tasks_completed, total_days_active, streak, best_streak";
const SELECT_MINIMAL =
  "id, user_id, current_week, current_day, week_tasks_completed, total_days_active, streak";

async function loadJourneyRow(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<JourneyDbRow | null> {
  let { data: row, error } = await supabase
    .from("user_journey")
    .select(SELECT_WITH_BEST)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[journey/complete] select with best_streak failed, retrying minimal", error.message);
    const r2 = await supabase
      .from("user_journey")
      .select(SELECT_MINIMAL)
      .eq("user_id", userId)
      .maybeSingle();
    if (r2.error) {
      console.error("[journey/complete] select minimal failed", r2.error.message);
      return null;
    }
    row = r2.data ? { ...r2.data, best_streak: 0 } : null;
  }

  if (!row) return null;

  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    current_week: Number(r.current_week ?? 1),
    current_day: Number(r.current_day ?? 1),
    week_tasks_completed: Number(r.week_tasks_completed ?? 0),
    total_days_active: Number(r.total_days_active ?? 0),
    streak: Number(r.streak ?? 0),
    best_streak: typeof r.best_streak === "number" ? r.best_streak : 0,
  };
}

async function createJourneyRow(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<JourneyDbRow | null> {
  const fullInsert = {
    user_id: userId,
    current_week: 1,
    current_day: 1,
    week_tasks_completed: 0,
    total_days_active: 0,
    streak: 0,
    best_streak: 0,
    within_path_stage: "Awake" as const,
  };

  let { data: created, error: createError } = await supabase
    .from("user_journey")
    .insert(fullInsert)
    .select(SELECT_WITH_BEST)
    .maybeSingle();

  if (createError?.code === "23505") {
    console.log("[journey/complete] insert duplicate user_journey, loading existing row");
    return loadJourneyRow(supabase, userId);
  }

  if (createError) {
    console.warn("[journey/complete] full insert failed, retrying minimal", createError.message);
    const ins2 = await supabase
      .from("user_journey")
      .insert({
        user_id: userId,
        current_week: 1,
        current_day: 1,
        week_tasks_completed: 0,
        total_days_active: 0,
        streak: 0,
      })
      .select(SELECT_MINIMAL)
      .maybeSingle();

    if (ins2.error?.code === "23505") {
      return loadJourneyRow(supabase, userId);
    }

    if (ins2.error) {
      console.error("[journey/complete] minimal insert failed", ins2.error.message);
      return null;
    }
    created = ins2.data ? { ...ins2.data, best_streak: 0 } : null;
  }

  if (!created) {
    return loadJourneyRow(supabase, userId);
  }

  const c = created as Record<string, unknown>;
  return {
    id: c.id as string,
    user_id: c.user_id as string,
    current_week: Number(c.current_week ?? 1),
    current_day: Number(c.current_day ?? 1),
    week_tasks_completed: Number(c.week_tasks_completed ?? 0),
    total_days_active: Number(c.total_days_active ?? 0),
    streak: Number(c.streak ?? 0),
    best_streak: typeof c.best_streak === "number" ? c.best_streak : 0,
  };
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let journey = await loadJourneyRow(supabase, user.id);

  if (!journey) {
    journey = await createJourneyRow(supabase, user.id);
  }

  if (!journey) {
    return NextResponse.json(
      { error: "Failed to initialize journey" },
      { status: 500 }
    );
  }

  const currentWeek = clampWeek(journey.current_week);
  const currentDay = Math.min(Math.max(journey.current_day, 1), 7);
  const completedThisWeek = Math.max(journey.week_tasks_completed, 0);

  await supabase.from("daily_completions").insert({
    user_id: user.id,
    week_number: currentWeek,
    day_number: currentDay,
    completed_on: getDateStringAthens(),
  });

  const nextCompletedThisWeek = completedThisWeek + 1;
  const nextTotalDays = Math.max(journey.total_days_active, 0) + 1;
  const nextStreak = Math.max(journey.streak, 0) + 1;
  const prevBest = Math.max(journey.best_streak ?? 0, 0);
  const nextBestStreak = Math.max(prevBest, nextStreak);
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
    best_streak: nextBestStreak,
  };

  const updateBody = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  let { error: updateError } = await supabase
    .from("user_journey")
    .update(updateBody)
    .eq("id", journey.id);

  if (updateError) {
    console.warn("[journey/complete] update with best_streak failed, retrying without", updateError.message);
    const { best_streak: _bs, ...withoutBest } = updateBody;
    const retry = await supabase
      .from("user_journey")
      .update(withoutBest)
      .eq("id", journey.id);
    updateError = retry.error;
  }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(payload);
}
