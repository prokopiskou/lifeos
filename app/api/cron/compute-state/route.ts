import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// WITHIN OS — State Engine (Phase 4)
// Τρέχει κάθε βράδυ (Vercel Cron). Προστατευμένο με CRON_SECRET.
// Για κάθε χρήστη με onboarding_done: υπολογίζει 6 metrics από rolling
// 7-day window, εφαρμόζει το rule engine (masking ΠΡΙΝ το momentum),
// και γράφει user_state_daily + task_calibration (για ΑΥΡΙΟ).
// ============================================================

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Checkin = {
  date: string;
  grid_x: number;
  grid_y: number;
  quadrant: string | null;
  identity_answer: string | null;
  response_latency_sec: number | null;
  word: string | null;
  opened_not_completed: boolean | null;
};

type State =
  | "frozen" | "return" | "slipping" | "masking" | "wobble" | "momentum" | "steady";

const CALIBRATION: Record<State, { task_size: string; tone_profile: string }> = {
  frozen: { task_size: "none", tone_profile: "door_open" },
  return: { task_size: "minimal", tone_profile: "welcome_back" },
  slipping: { task_size: "minimal", tone_profile: "gentle_name" },
  masking: { task_size: "full", tone_profile: "honest_check" },
  wobble: { task_size: "half", tone_profile: "lower_bar" },
  momentum: { task_size: "full", tone_profile: "protect_momentum" },
  steady: { task_size: "full", tone_profile: "quiet_continue" },
};

function answerValue(a: string | null): number {
  if (a === "yes") return 1;
  if (a === "partial") return 0.5;
  return 0; // 'no' ή κενή μέρα
}

function quadrant(x: number, y: number): string {
  if (x >= 0.5 && y >= 0.5) return "aligned";
  if (x < 0.5 && y >= 0.5) return "restorative";
  if (x >= 0.5 && y < 0.5) return "reactive";
  return "depleted";
}

function isoDaysAgo(base: Date, n: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  // --- auth ---
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const tomorrowISO = isoDaysAgo(today, -1);
  const windowStart = isoDaysAgo(today, 6); // 7 ημερών παράθυρο (σήμερα + 6 πίσω)

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("onboarding_done", true);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  let processed = 0;

  for (const p of profiles ?? []) {
    const userId = p.id as string;

    const { data: rows } = await supabase
      .from("daily_checkins")
      .select("date,grid_x,grid_y,quadrant,identity_answer,response_latency_sec,word,opened_not_completed")
      .eq("user_id", userId)
      .gte("date", windowStart)
      .lte("date", todayISO)
      .order("date", { ascending: true });

    const checkins = (rows ?? []) as Checkin[];
    const byDate = new Map(checkins.map((c) => [c.date, c]));

    // 7 ordered days oldest -> newest
    const days = Array.from({ length: 7 }, (_, i) => isoDaysAgo(today, 6 - i));
    const series = days.map((d) => byDate.get(d) || null);

    // --- 1. AR (alignment rate) ---
    const ar = days.reduce((s, d) => s + answerValue(byDate.get(d)?.identity_answer ?? null), 0) / 7;

    // --- 2. Trajectory ---
    const avg = (arr: (Checkin | null)[]) =>
      arr.reduce((s, c) => s + answerValue(c?.identity_answer ?? null), 0) / (arr.length || 1);
    const firstHalf = avg(series.slice(0, 3));
    const lastHalf = avg(series.slice(4, 7));
    const diff = lastHalf - firstHalf;
    const trajectory = diff > 0.12 ? "rising" : diff < -0.12 ? "falling" : "flat";

    // --- 3. Volatility (μέση ευκλείδεια απόσταση διαδοχικών taps) ---
    const present = checkins;
    let volatility = 0;
    if (present.length > 1) {
      let sum = 0;
      for (let i = 1; i < present.length; i++) {
        const dx = present[i].grid_x - present[i - 1].grid_x;
        const dy = present[i].grid_y - present[i - 1].grid_y;
        sum += Math.sqrt(dx * dx + dy * dy);
      }
      volatility = sum / (present.length - 1);
    }

    // --- 4. Engagement integrity (0..1) ---
    let integrity = 0.7;
    const latencies = present.map((c) => c.response_latency_sec).filter((v): v is number => v != null);
    const fastConst = latencies.length >= 3 && latencies.every((l) => l < 3);
    const everWord = present.some((c) => c.word && c.word.trim().length > 0);
    // ίδια ακριβώς grid θέση 3+ μέρες
    let identicalRun = 1, maxIdentical = 1;
    for (let i = 1; i < present.length; i++) {
      if (present[i].grid_x === present[i - 1].grid_x && present[i].grid_y === present[i - 1].grid_y) {
        identicalRun++; maxIdentical = Math.max(maxIdentical, identicalRun);
      } else identicalRun = 1;
    }
    if (fastConst) integrity -= 0.3;
    if (maxIdentical >= 3) integrity -= 0.3;
    if (!everWord) integrity -= 0.1;
    if (everWord) integrity += 0.1;
    if (volatility > 0.15) integrity += 0.1;
    integrity = Math.max(0, Math.min(1, integrity));

    // --- 5. Body gap (Apple Health, nullable) ---
    let bodyGap: number | null = null;
    const { data: health } = await supabase
      .from("health_daily")
      .select("sleep_minutes,resting_hr")
      .eq("user_id", userId)
      .eq("date", todayISO)
      .maybeSingle();
    const todayCheckin = byDate.get(todayISO);
    if (health && todayCheckin) {
      const q = todayCheckin.quadrant ?? quadrant(todayCheckin.grid_x, todayCheckin.grid_y);
      if (q === "aligned" && ((health.sleep_minutes ?? 999) < 360)) bodyGap = 1;
    }

    // --- early signals ---
    const openedNotCompleted = present.filter((c) => c.opened_not_completed).length;

    // --- gap / consecutive ---
    const lastCheckinDate = present.length ? present[present.length - 1].date : null;
    const gapDays = lastCheckinDate
      ? Math.round((today.getTime() - new Date(lastCheckinDate).getTime()) / 86400000)
      : 99;
    const checkedToday = !!todayCheckin;

    // consecutive aligned (από το τέλος)
    let consecAligned = 0;
    for (let i = series.length - 1; i >= 0; i--) {
      const c = series[i];
      if (!c) break;
      const q = c.quadrant ?? quadrant(c.grid_x, c.grid_y);
      if (q === "aligned") consecAligned++; else break;
    }

    const todayQ = todayCheckin ? (todayCheckin.quadrant ?? quadrant(todayCheckin.grid_x, todayCheckin.grid_y)) : null;

    // ============ RULE ENGINE (πρώτο που πιάνει κερδίζει) ============
    let state: State;
    if (gapDays >= 3 || openedNotCompleted >= 2) {
      state = "frozen";
    } else if (checkedToday && gapDays === 0 && lastCheckinPriorGap(present) >= 3) {
      state = "return";
    } else if (trajectory === "falling" && ar < 0.4) {
      state = "slipping";
    } else if (ar > 0.7 && (integrity < 0.4 || bodyGap)) {
      state = "masking"; // ΠΡΙΝ το momentum — κρίσιμο
    } else if (volatility > 0.2 && (todayQ === "depleted" || todayQ === "reactive") && ar > 0.5) {
      state = "wobble";
    } else if (trajectory === "rising" && ar > 0.6 && consecAligned >= 2) {
      state = "momentum";
    } else {
      state = "steady";
    }

    const signals = {
      opened_not_completed_count: openedNotCompleted,
      gap_days: gapDays,
      consec_aligned: consecAligned,
    };

    // --- write user_state_daily (σήμερα) ---
    await supabase.from("user_state_daily").upsert(
      {
        user_id: userId,
        date: todayISO,
        ar_7d: Number(ar.toFixed(3)),
        trajectory,
        volatility: Number(volatility.toFixed(3)),
        engagement_integrity: Number(integrity.toFixed(3)),
        body_gap: bodyGap,
        state,
        signals,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    );

    // --- write task_calibration (για ΑΥΡΙΟ) ---
    const cal = CALIBRATION[state];
    await supabase.from("task_calibration").upsert(
      { user_id: userId, date: tomorrowISO, task_size: cal.task_size, tone_profile: cal.tone_profile },
      { onConflict: "user_id,date" }
    );

    processed++;
  }

  return NextResponse.json({ ok: true, processed, date: todayISO });
}

// Επιστρέφει το gap (μέρες) ΠΡΙΝ από το σημερινό check-in, για το rule "return".
function lastCheckinPriorGap(present: Checkin[]): number {
  if (present.length < 2) return 99;
  const last = new Date(present[present.length - 1].date).getTime();
  const prev = new Date(present[present.length - 2].date).getTime();
  return Math.round((last - prev) / 86400000);
}
