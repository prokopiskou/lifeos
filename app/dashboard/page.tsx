import { redirect } from "next/navigation";

import { clampDay, clampWeek, type JourneyRow } from "@/lib/journey";
import { normalizeOnboardingAnswers } from "@/lib/onboarding-answers";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { welcome?: string };
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    console.error("[dashboard/page] user fetch failed", { userError });
    redirect("/login");
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
    console.error("[dashboard/page] onboarding answers missing/invalid", {
      onboardingError,
      parsedExists: Boolean(parsed),
    });
    redirect("/onboarding");
  }

  const { data: journeyRows } = await supabase
    .from("user_journey")
    .select("id, current_week, current_day, week_tasks_completed, total_days_active, streak")
    .eq("user_id", userData.user.id)
    .limit(1);

  let journey = Array.isArray(journeyRows) ? journeyRows[0] : null;
  console.log("[dashboard/page] journey row fetched", {
    exists: Boolean(journey),
    week: journey?.current_week,
    day: journey?.current_day,
  });

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
      })
      .select("id, current_week, current_day, week_tasks_completed, total_days_active, streak")
      .limit(1);
    journey = Array.isArray(created) ? created[0] : null;
    console.log("[dashboard/page] journey row initialized", {
      exists: Boolean(journey),
      week: journey?.current_week,
      day: journey?.current_day,
    });
  }

  const initialJourney: JourneyRow = {
    current_week: clampWeek(journey?.current_week ?? 1),
    current_day: clampDay(journey?.current_day ?? 1),
    week_tasks_completed: Math.max(journey?.week_tasks_completed ?? 0, 0),
    total_days_active: Math.max(journey?.total_days_active ?? 0, 0),
    streak: Math.max(journey?.streak ?? 0, 0),
  };

  return (
    <>
      <DashboardClient
        answers={parsed}
        initialJourney={initialJourney}
        showWelcomeLoading={searchParams?.welcome === "1"}
      />
      <LogoutButton />
      <BottomNav />
    </>
  );
}
