import { redirect } from "next/navigation";

import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import { getCommunityRankSubtext } from "@/lib/community-rank-message";
import {
  getDateStringAthens,
  getDaysPassedInMonthAthens,
  getLastSevenDatesAthens,
  getMonthStartDateStringAthens,
} from "@/lib/athens-date";
import { clampDay, clampWeek } from "@/lib/journey";
import { normalizeOnboardingAnswers } from "@/lib/onboarding-answers";
import { createClient } from "@/lib/supabase/server";
import ProgressClient from "./ProgressClient";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    redirect("/login?redirectTo=/progress");
  }

  const { data: onboardingRows, error: onboardingError } = await supabase
    .from("onboarding_answers")
    .select("answers")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = Array.isArray(onboardingRows) ? onboardingRows[0] : null;
  const parsed = normalizeOnboardingAnswers(latest?.answers);

  if (onboardingError || !parsed) {
    redirect("/onboarding");
  }

  const { data: journeyRows } = await supabase
    .from("user_journey")
    .select(
      "current_week, current_day, week_tasks_completed, total_days_active, streak, best_streak"
    )
    .eq("user_id", userData.user.id)
    .limit(1);

  let journey = Array.isArray(journeyRows) ? journeyRows[0] : null;

  if (!journey) {
    const { data: created } = await supabase
      .from("user_journey")
      .insert({
        user_id: userData.user.id,
        current_week: 1,
        current_day: 1,
        week_tasks_completed: 0,
        total_days_active: 0,
        streak: 0,
        best_streak: 0,
        within_path_stage: "Awake",
      })
      .select(
        "current_week, current_day, week_tasks_completed, total_days_active, streak, best_streak"
      )
      .limit(1);
    journey = Array.isArray(created) ? created[0] : null;
  }

  const currentWeek = clampWeek(journey?.current_week ?? 1);
  const currentDay = clampDay(journey?.current_day ?? 1);
  const weekTasksDone = Math.min(7, Math.max(0, journey?.week_tasks_completed ?? 0));
  const weeklyPercent = Math.min(100, Math.round((weekTasksDone / 7) * 100));

  const totalDaysActive = Math.max(0, journey?.total_days_active ?? 0);
  const streak = Math.max(0, journey?.streak ?? 0);
  const bestStreak = Math.max(
    streak,
    typeof journey?.best_streak === "number" ? journey.best_streak : 0
  );

  const monthStart = getMonthStartDateStringAthens();
  const todayAthens = getDateStringAthens();
  const daysPassed = getDaysPassedInMonthAthens();

  const { count: monthCompletionCount, error: monthCountError } = await supabase
    .from("daily_completions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userData.user.id)
    .gte("completed_on", monthStart)
    .lte("completed_on", todayAthens);

  const monthTasksDone = monthCountError ? 0 : (monthCompletionCount ?? 0);
  let monthlyPercent = 0;
  if (!monthCountError && daysPassed > 0) {
    monthlyPercent = Math.min(100, Math.round((monthTasksDone / daysPassed) * 100));
  }

  let communityTopPercent: number | null = null;
  const { data: rankData, error: rankError } = await supabase.rpc(
    "get_community_top_percent"
  );
  if (!rankError && typeof rankData === "number" && Number.isFinite(rankData)) {
    communityTopPercent = rankData;
  }

  const sevenDates = getLastSevenDatesAthens();
  const { data: moodRows } = await supabase
    .from("mood_checkins")
    .select("checkin_date, mood")
    .eq("user_id", userData.user.id)
    .in("checkin_date", sevenDates);

  const moodByDate = new Map<string, string>();
  for (const row of moodRows ?? []) {
    const d = row.checkin_date as string;
    const m = typeof row.mood === "string" ? row.mood : null;
    if (m) moodByDate.set(d, m);
  }

  const moodWeek = sevenDates.map((date) => ({
    date,
    mood: moodByDate.get(date) ?? null,
  }));

  const communityMessage =
    communityTopPercent !== null
      ? getCommunityRankSubtext(communityTopPercent)
      : "Η κατάταξη θα εμφανιστεί σύντομα.";

  return (
    <>
      <ProgressClient
        currentWeek={currentWeek}
        currentDay={currentDay}
        weeklyPercent={weeklyPercent}
        weeklyTasksDone={weekTasksDone}
        monthlyPercent={monthlyPercent}
        monthTasksDone={monthTasksDone}
        monthDaysPassed={daysPassed}
        monthStatsUnavailable={Boolean(monthCountError)}
        streak={streak}
        bestStreak={bestStreak}
        totalDaysActive={totalDaysActive}
        communityTopPercent={communityTopPercent}
        communityMessage={communityMessage}
        moodWeek={moodWeek}
      />
      <LogoutButton />
      <BottomNav />
    </>
  );
}
