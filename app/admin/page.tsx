import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getDateStringAthens,
  getDaysPassedInMonthAthens,
  getMonthStartDateStringAthens,
} from "@/lib/athens-date";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import AdminUsersClient, { type AdminUserRow } from "./AdminUsersClient";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "withinsuccess@gmail.com";

async function loadRows(): Promise<AdminUserRow[]> {
  const admin = createAdminClient();

  const users: { id: string; email?: string | null }[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw error;
    }
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < 1000) break;
    page += 1;
  }

  const { data: journeys, error: jErr } = await admin
    .from("user_journey")
    .select("user_id, current_week, streak, within_path_stage");

  if (jErr) {
    throw jErr;
  }

  const journeyMap = new Map(
    (journeys ?? []).map((j) => [
      j.user_id as string,
      j as {
        current_week: number;
        streak: number;
        within_path_stage: string | null;
      },
    ])
  );

  const monthStart = getMonthStartDateStringAthens();
  const today = getDateStringAthens();
  const { data: completionRows, error: completionErr } = await admin
    .from("daily_completions")
    .select("user_id")
    .gte("completed_on", monthStart)
    .lte("completed_on", today);

  const counts = new Map<string, number>();
  if (completionErr) {
    console.error("[admin] daily_completions count query", completionErr);
  }
  for (const r of completionErr ? [] : completionRows ?? []) {
    const uid = r.user_id as string;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }

  const daysPassed = getDaysPassedInMonthAthens();

  return users.map((u) => {
    const j = journeyMap.get(u.id);
    const c = counts.get(u.id) ?? 0;
    const rate =
      daysPassed > 0 ? Math.min(100, Math.round((c / daysPassed) * 100)) : 0;
    return {
      id: u.id,
      email: u.email ?? null,
      current_week: j?.current_week ?? 1,
      streak: j?.streak ?? 0,
      completion_rate: rate,
      within_path_stage:
        typeof j?.within_path_stage === "string" ? j.within_path_stage : "Awake",
    };
  });
}

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  let rows: AdminUserRow[] = [];
  try {
    rows = await loadRows();
  } catch (e) {
    console.error("[admin] loadRows failed", e);
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-white px-4 pb-24 pt-10 text-black">
      <div className="mx-auto w-full max-w-[960px]">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-500 underline decoration-black/20 underline-offset-4"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Διαχείριση χρηστών</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Within Path στάδιο ανά χρήστη · ολοκλήρωση μήνα = ημέρες με task / ημέρες που
          πέρασαν (μήνας Αθήνα).
        </p>
        <div className="mt-8">
          <AdminUsersClient initialRows={rows} />
        </div>
      </div>
    </main>
  );
}
