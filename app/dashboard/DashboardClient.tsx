"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getQuoteForDate } from "@/lib/daily-quotes";
import { JOURNEY_WEEKS, getWeekTheme, type JourneyRow } from "@/lib/journey";
import { MOOD_RESPONSE_FALLBACK_MESSAGE } from "@/lib/mood-response-fallback";
import { createClient } from "@/lib/supabase/client";

const MOOD_OPTIONS = ["😔", "😐", "🙂", "😊"] as const;

type TaskResponse = {
  title: string;
  description: string;
  why: string;
  stage: string;
};

type Props = {
  answers: string[];
  initialJourney: JourneyRow;
  showWelcomeLoading: boolean;
  showWeeklyReflection: boolean;
  reflectionWeekNumber: number;
};

const ACCENT = "#C9A96E";
const LIFEOS_MOOD_DATE_KEY = "lifeos_mood_date";
const LAST_COMPLETION_KEY = "lifeos_last_completion";
const LAST_COMPLETION_TASK_KEY = "lifeos_last_completion_task";

function getGreekTodayLabel(d: Date) {
  return new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function getDateKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function DashboardClient({
  answers,
  initialJourney,
  showWelcomeLoading,
  showWeeklyReflection,
  reflectionWeekNumber,
}: Props) {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(
    null
  );
  const [accessReady, setAccessReady] = useState(false);
  const today = useMemo(() => new Date(), []);
  const todayLabel = useMemo(() => getGreekTodayLabel(today), [today]);
  const [journey, setJourney] = useState<JourneyRow>(initialJourney);
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(showWelcomeLoading);
  const [task, setTask] = useState<TaskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);
  const [completedTask, setCompletedTask] = useState<TaskResponse | null>(null);
  type MorningCheckinState = "loading" | "picker" | "ai_wait" | "card" | "finished";
  const [morningCheckin, setMorningCheckin] = useState<MorningCheckinState>("loading");
  const [moodCardText, setMoodCardText] = useState("");
  const [reflectionA1, setReflectionA1] = useState("");
  const [reflectionA2, setReflectionA2] = useState("");
  const [reflectionA3, setReflectionA3] = useState("");
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const [reflectionDone, setReflectionDone] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  type MicroDayState =
    | null
    | "loading"
    | { leadIn: string; microTask: string };
  const [microDay, setMicroDay] = useState<MicroDayState>(null);

  const weekTheme = getWeekTheme(journey.current_week);
  const quoteOfDay = useMemo(() => getQuoteForDate(today), [today]);
  const nextWeekTitle = JOURNEY_WEEKS[Math.min(9, journey.current_week + 1)]?.title;

  const daysToUnlock = Math.max(0, 7 - journey.current_day + 1);
  const filledDots = Math.min(7, Math.max(0, journey.week_tasks_completed));
  const todayKey = useMemo(() => getDateKey(today), [today]);

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/login?redirectTo=/dashboard");
        return;
      }
      setAccessReady(true);
    };
    void run();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LIFEOS_MOOD_DATE_KEY);
      const shouldSkip = stored === todayKey;
      console.log("[dashboard] mood: load → read localStorage", {
        todayKey,
        stored,
        shouldSkip,
      });
      setMorningCheckin((prev) => {
        if (prev === "ai_wait" || prev === "card") {
          console.log("[dashboard] mood: load → keep in-flight state", prev);
          return prev;
        }
        return shouldSkip ? "finished" : "picker";
      });
    } catch (e) {
      console.error("[dashboard] mood: load localStorage error", e);
      setMorningCheckin((prev) =>
        prev === "ai_wait" || prev === "card" ? prev : "picker"
      );
    }
  }, [todayKey]);

  useEffect(() => {
    if (!showWelcomeLoading) return;
    const timer = window.setTimeout(() => setLoadingPlan(false), 3000);
    return () => window.clearTimeout(timer);
  }, [showWelcomeLoading]);

  useEffect(() => {
    try {
      const lastCompletion = window.localStorage.getItem(LAST_COMPLETION_KEY);
      const doneToday = lastCompletion === todayKey;
      setCompletedToday(doneToday);

      if (doneToday) {
        const savedTaskRaw = window.localStorage.getItem(LAST_COMPLETION_TASK_KEY);
        if (savedTaskRaw) {
          const savedTask = JSON.parse(savedTaskRaw) as TaskResponse;
          if (
            typeof savedTask?.title === "string" &&
            typeof savedTask?.description === "string" &&
            typeof savedTask?.why === "string"
          ) {
            setCompletedTask(savedTask);
          }
        }
      }
    } catch {
      // Ignore localStorage parse/read issues.
    }
  }, [todayKey]);

  useEffect(() => {
    if (!accessReady) return;
    if (completedToday) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    const run = async () => {
      setLoading(true);
      setError(null);

      const payload = {
        answers,
        weekNumber: journey.current_week,
        dayNumber: journey.current_day,
        weekTheme: `${weekTheme.title} — ${weekTheme.theme}`,
      };

      console.log("[dashboard] fetching daily task", {
        weekNumber: payload.weekNumber,
        dayNumber: payload.dayNumber,
        weekTheme: payload.weekTheme,
      });

      try {
        const res = await fetch("/api/daily-task", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("[dashboard] daily task request failed", {
            status: res.status,
            body: text,
          });
          throw new Error(text || `Request failed (${res.status})`);
        }

        const data = (await res.json()) as TaskResponse;
        console.log("[dashboard] daily task loaded", { title: data.title });
        setTask(data);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setError("Η δημιουργία task άργησε πολύ. Δοκίμασε ανανέωση.");
          console.error("[dashboard] daily task request timed out");
        } else {
          setError(e instanceof Error ? e.message : "Κάτι πήγε στραβά.");
          console.error("[dashboard] daily task request error", e);
        }
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    void run();

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    accessReady,
    answers,
    completedToday,
    journey.current_day,
    journey.current_week,
    retryNonce,
    weekTheme.theme,
    weekTheme.title,
  ]);

  async function onMarkComplete() {
    if (completing || loading) return;
    if (!task) return;
    setCompleting(true);
    setError(null);

    const res = await fetch("/api/journey/complete", { method: "POST" });
    const data = (await res.json().catch(() => null)) as
      | (JourneyRow & { error?: string })
      | null;

    if (!res.ok || !data) {
      setError(data?.error || `Request failed (${res.status})`);
      setCompleting(false);
      return;
    }

    setJourney({
      current_week: data.current_week,
      current_day: data.current_day,
      week_tasks_completed: data.week_tasks_completed,
      total_days_active: data.total_days_active,
      streak: data.streak,
      best_streak: data.best_streak,
    });
    setCompletedTask(task);
    setCompletedToday(true);
    try {
      window.localStorage.setItem(LAST_COMPLETION_KEY, todayKey);
      window.localStorage.setItem(LAST_COMPLETION_TASK_KEY, JSON.stringify(task));
    } catch {
      // Ignore localStorage write errors.
    }
    setCompleting(false);
  }

  function onRetryTask() {
    setError(null);
    setRetryNonce((v) => v + 1);
  }

  async function onRequestMicroDay() {
    if (!task || microDay === "loading") return;
    setMicroDay("loading");
    try {
      const weekThemeStr = `${weekTheme.title} — ${weekTheme.theme}`;
      const res = await fetch("/api/skip-day", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weekTheme: weekThemeStr,
          currentTask: { title: task.title, description: task.description },
          currentWeek: journey.current_week,
          onboardingAnswers: answers,
        }),
      });
      const data = (await res.json()) as {
        leadIn?: string;
        microTask?: string;
        error?: string;
      };
      if (!res.ok) {
        setMicroDay(null);
        return;
      }
      const leadIn = typeof data.leadIn === "string" ? data.leadIn.trim() : "";
      const microTask =
        typeof data.microTask === "string" ? data.microTask.trim() : "";
      if (leadIn && microTask) {
        setMicroDay({ leadIn, microTask });
      } else {
        setMicroDay(null);
      }
    } catch (e) {
      console.error("[dashboard] skip-day failed", e);
      setMicroDay(null);
    }
  }

  function onDismissMicroDay() {
    setMicroDay(null);
  }

  async function onSaveWeeklyReflection() {
    if (reflectionSaving) return;
    setReflectionSaving(true);
    setReflectionError(null);
    try {
      const res = await fetch("/api/weekly-reflection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answer_1: reflectionA1,
          answer_2: reflectionA2,
          answer_3: reflectionA3,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setReflectionError(data?.error || `Αποτυχία (${res.status})`);
        return;
      }
      setReflectionDone(true);
    } catch (e) {
      setReflectionError("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
      console.error("[dashboard] weekly reflection save failed", e);
    } finally {
      setReflectionSaving(false);
    }
  }

  async function onMoodSelect(mood: string) {
    console.log("[dashboard] mood: step 1 emoji click", { mood, morningCheckin });
    if (morningCheckin !== "picker") return;

    console.log("[dashboard] mood: step 2 show loading …");
    setMorningCheckin("ai_wait");

    const weekThemeStr = `${weekTheme.title} — ${weekTheme.theme}`;
    let message = MOOD_RESPONSE_FALLBACK_MESSAGE;

    try {
      console.log("[dashboard] mood: step 3 POST /api/mood-response");
      const res = await fetch("/api/mood-response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          mood,
          weekTheme: weekThemeStr,
          currentWeek: journey.current_week,
          onboardingAnswers: answers,
        }),
      });
      console.log("[dashboard] mood: step 4 response", { status: res.status, ok: res.ok });
      const payload = (await res.json()) as { message?: string };
      if (typeof payload.message === "string" && payload.message.trim()) {
        message = payload.message.trim();
      } else {
        console.warn("[dashboard] mood: step 4 no message field, using fallback");
      }
    } catch (e) {
      console.error("[dashboard] mood: step 3–4 fetch failed", e);
      message = MOOD_RESPONSE_FALLBACK_MESSAGE;
    }

    console.log("[dashboard] mood: step 5 show card + OK", { preview: message.slice(0, 80) });
    setMoodCardText(message);
    setMorningCheckin("card");

    if (supabase) {
      void supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) {
          console.warn("[dashboard] mood: background insert skipped (no user)");
          return;
        }
        const { error } = await supabase.from("mood_checkins").insert({
          user_id: user.id,
          mood,
          checkin_date: todayKey,
        });
        if (error && error.code !== "23505") {
          console.warn("[dashboard] mood: background mood_checkins insert failed", error);
        } else {
          console.log("[dashboard] mood: background mood_checkins ok");
        }
      });
    }
  }

  function onMoodOk() {
    console.log("[dashboard] mood: step 6 OK click → save date", todayKey);
    try {
      window.localStorage.setItem(LIFEOS_MOOD_DATE_KEY, todayKey);
    } catch (e) {
      console.error("[dashboard] mood: localStorage set failed", e);
    }
    setMorningCheckin("finished");
    console.log("[dashboard] mood: step 7 check-in hidden for today");
  }

  if (loadingPlan || !accessReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 pb-20">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-black/20 border-t-black" />
          <p className="mt-5 text-base text-black">
            Δημιουργείται το προσωπικό σου πλάνο...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-10 py-10 pb-20 text-black">
      <div className="mx-auto flex w-full max-w-[480px] flex-col">
        {morningCheckin === "picker" ? (
          <section className="mb-8 rounded-2xl border border-black/10 bg-neutral-50/80 px-4 py-5 text-center">
            <p className="text-[15px] font-medium text-black">Πώς νιώθεις σήμερα;</p>
            <div className="mt-4 flex justify-center gap-3">
              {MOOD_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void onMoodSelect(emoji)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-black/10 bg-white text-2xl transition hover:border-black/25"
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {morningCheckin === "ai_wait" ? (
          <section
            className="mb-8 py-8 text-center text-lg font-medium tracking-[0.2em] text-neutral-500"
            aria-live="polite"
            aria-busy="true"
          >
            ...
          </section>
        ) : null}

        {morningCheckin === "card" ? (
          <div className="mb-8 flex justify-center">
            <section
              className="w-full max-w-[380px] border-l-[3px] py-2 pl-3 pr-2"
              style={{ borderLeftColor: ACCENT }}
            >
              <p className="text-[14px] leading-[1.55] text-neutral-600">{moodCardText}</p>
              <button
                type="button"
                onClick={onMoodOk}
                className="mt-3 text-[13px] font-normal text-neutral-500 transition hover:text-neutral-700"
              >
                OK →
              </button>
            </section>
          </div>
        ) : null}

        <header className="mb-6 text-center">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            Εβδομάδα {journey.current_week} · Ημέρα {journey.current_day}
          </p>
          <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-tight">
            {weekTheme.title}
          </h1>
        </header>

        <div className="mb-4 border-t border-black/10" />

        <blockquote
          className="mb-4 px-2 text-center text-[13px] italic leading-relaxed"
          style={{ color: ACCENT }}
        >
          &ldquo;{quoteOfDay}&rdquo;
        </blockquote>

        <div className="mb-6 border-t border-black/10" />

        <section className="mb-6">
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <span
                key={index}
                className="inline-block rounded-full"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: index < filledDots ? ACCENT : "transparent",
                  border: index < filledDots ? "none" : "1px solid #D4D4D4",
                }}
              />
            ))}
          </div>
        </section>

        {journey.streak >= 3 ? (
          <p
            className="mb-8 text-center text-[15px] font-medium"
            style={{ color: ACCENT }}
          >
            🔥 {journey.streak} μέρες συνεχόμενα
          </p>
        ) : null}

        <p className="mb-8 text-center text-[13px] text-neutral-500">{todayLabel}</p>

        {showWeeklyReflection && !reflectionDone ? (
          <section
            className="mb-6 rounded-2xl border bg-white p-5 shadow-sm"
            style={{ borderColor: `${ACCENT}99` }}
          >
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: ACCENT }}
            >
              Εβδομαδιαία ανασκόπηση · Εβδομάδα {reflectionWeekNumber}
            </p>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-[13px] text-neutral-700">
                  Τι πήγε καλά αυτή την εβδομάδα;
                </span>
                <textarea
                  value={reflectionA1}
                  onChange={(e) => setReflectionA1(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-black/20"
                  placeholder="…"
                />
              </label>
              <label className="block">
                <span className="text-[13px] text-neutral-700">Τι ήταν δύσκολο;</span>
                <textarea
                  value={reflectionA2}
                  onChange={(e) => setReflectionA2(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-black/20"
                  placeholder="…"
                />
              </label>
              <label className="block">
                <span className="text-[13px] text-neutral-700">
                  Τι κρατάς μαζί σου για την επόμενη;
                </span>
                <textarea
                  value={reflectionA3}
                  onChange={(e) => setReflectionA3(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-black/20"
                  placeholder="…"
                />
              </label>
            </div>
            {reflectionError ? (
              <p className="mt-3 text-[13px] text-red-600">{reflectionError}</p>
            ) : null}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void onSaveWeeklyReflection()}
                disabled={reflectionSaving}
                className="rounded-lg border border-black/10 bg-black px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reflectionSaving ? "Αποθήκευση…" : "Αποθήκευση"}
              </button>
            </div>
          </section>
        ) : null}

        <section className="flex-1">
          <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
            {completedToday ? (
              <div>
                <h2 className="text-[28px] font-semibold leading-tight text-black">
                  Μπράβο, το ολοκλήρωσες σήμερα!
                </h2>
                <p className="mt-4 text-[16px] leading-8 text-neutral-700">
                  Το σημερινό task σημειώθηκε ως ολοκληρωμένο.
                </p>

                {completedTask ? (
                  <div className="mt-6 rounded-xl border border-black/10 bg-neutral-50 p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Ολοκληρωμένο σήμερα
                    </p>
                    <h3 className="mt-2 text-[22px] font-semibold text-black line-through decoration-2">
                      {completedTask.title}
                    </h3>
                    <p className="mt-3 text-[16px] leading-8 text-neutral-700">
                      {completedTask.description}
                    </p>
                  </div>
                ) : null}

                <p className="mt-6 text-[15px] text-neutral-700">
                  Επιστρέφουμε αύριο με νέο task.
                </p>
                <p className="mt-1 text-[15px] text-neutral-500">
                  Αύριο: Ημέρα {journey.current_day}
                </p>
              </div>
            ) : loading ? (
              <div>
                <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-200" />
                <div className="mt-4 space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
                  <div className="h-4 w-11/12 animate-pulse rounded bg-neutral-200" />
                  <div className="h-4 w-9/12 animate-pulse rounded bg-neutral-200" />
                </div>
              </div>
            ) : error ? (
              <div>
                <p className="text-black">{error}</p>
                <button
                  type="button"
                  onClick={onRetryTask}
                  className="mt-4 rounded-lg border border-black/20 px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-100"
                >
                  Δοκίμασε ανανέωση
                </button>
              </div>
            ) : task ? (
              <div>
                {microDay && typeof microDay === "object" ? (
                  <section
                    className="border-l-[3px] py-2 pl-3 pr-1"
                    style={{ borderLeftColor: ACCENT }}
                  >
                    <p className="text-[14px] leading-relaxed text-neutral-600">
                      {microDay.leadIn}
                    </p>
                    <p className="mt-3 text-[15px] font-semibold leading-snug text-black">
                      {microDay.microTask}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void onMarkComplete()}
                        disabled={completing}
                        className="flex-1 rounded-lg border border-black/10 bg-black py-2.5 text-center text-[13px] font-medium text-white transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Το κάνω ✓
                      </button>
                      <button
                        type="button"
                        onClick={onDismissMicroDay}
                        disabled={completing}
                        className="flex-1 rounded-lg border border-black/10 bg-neutral-100 py-2.5 text-center text-[13px] font-medium text-neutral-600 transition hover:bg-neutral-200 disabled:opacity-50"
                      >
                        Εντάξει, αύριο
                      </button>
                    </div>
                  </section>
                ) : (
                  <>
                    <h2 className="text-[22px] font-semibold leading-tight text-black">
                      {task.title}
                    </h2>
                    <p className="mt-4 text-[16px] leading-[1.8] text-neutral-800">
                      {task.description}
                    </p>
                    <p className="mt-5 text-[15px] leading-7 text-neutral-600">
                      <span style={{ color: ACCENT }} className="font-semibold">
                        Γιατί σήμερα:
                      </span>{" "}
                      {task.why}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div />
            )}
          </div>
        </section>

        <div className="mt-8 flex w-full flex-col items-stretch gap-3">
          {microDay && typeof microDay === "object" ? null : (
            <>
              <button
                type="button"
                onClick={onMarkComplete}
                disabled={
                  loading ||
                  completing ||
                  !!error ||
                  completedToday ||
                  microDay === "loading"
                }
                className={[
                  "w-full rounded-lg border border-black/10 bg-black px-6 py-5 text-center",
                  "text-[18px] font-medium text-white transition hover:bg-neutral-900",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
              >
                {completedToday
                  ? "Ολοκληρώθηκε για σήμερα ✓"
                  : completing
                    ? "Αποθήκευση..."
                    : "Το έκανα ✓"}
              </button>
              {task && !loading && !error && !completedToday ? (
                <button
                  type="button"
                  onClick={() => void onRequestMicroDay()}
                  disabled={microDay === "loading"}
                  className="w-full py-1 text-center text-[13px] text-neutral-500 transition hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {microDay === "loading" ? "Φόρτωση…" : "Δεν έχω όρεξη σήμερα"}
                </button>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-6 text-center text-[13px] text-neutral-500">
          🔒 Εβδομάδα {Math.min(9, journey.current_week + 1)}{" "}
          {nextWeekTitle ? `(${nextWeekTitle}) ` : ""}
          ξεκλειδώνει σε {daysToUnlock} μέρες
        </div>
      </div>
    </main>
  );
}

