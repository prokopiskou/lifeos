import { redirect } from "next/navigation";

import { normalizeOnboardingAnswers } from "@/lib/onboarding-answers";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
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
    redirect("/onboarding");
  }

  return <DashboardClient answers={parsed} />;
}
