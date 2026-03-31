"use client";

import { useEffect, useMemo, useState } from "react";
import { JOURNEY_WEEKS, getMicroChallenge, getWeekTheme, type JourneyRow } from "@/lib/journey";

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
};

const ACCENT = "#C9A96E";
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
}: Props) {
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

  const weekTheme = getWeekTheme(journey.current_week);
  const microChallenge = getMicroChallenge(journey.current_week, journey.current_day);
  const nextWeekTitle = JOURNEY_WEEKS[Math.min(9, journey.current_week + 1)]?.title;

  const daysToUnlock = Math.max(0, 7 - journey.current_day + 1);
  const filledDots = Math.min(7, Math.max(0, journey.week_tasks_completed));
  const todayKey = useMemo(() => getDateKey(today), [today]);

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
        microChallenge,
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
    answers,
    completedToday,
    journey.current_day,
    journey.current_week,
    microChallenge,
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

  if (loadingPlan) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
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
    <main className="min-h-screen bg-white px-10 py-10 text-black">
      <div className="mx-auto flex w-full max-w-[480px] flex-col">
        <header className="mb-8 text-center">
          <p className="text-[12px] uppercase tracking-[0.16em] text-neutral-500">
            Εβδομάδα {journey.current_week} · Ημέρα {journey.current_day}
          </p>
          <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-tight">
            {weekTheme.title}
          </h1>
        </header>

        <section className="mb-7">
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

        <p className="mb-8 text-center text-[13px] text-neutral-500">{todayLabel}</p>

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
                <p className="mt-4 text-[13px] text-neutral-500">
                  <span style={{ color: ACCENT }} className="font-medium">
                    Μικρό challenge:
                  </span>{" "}
                  {microChallenge}
                </p>
              </div>
            ) : (
              <div />
            )}
          </div>
        </section>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onMarkComplete}
            disabled={loading || completing || !!error || completedToday}
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

