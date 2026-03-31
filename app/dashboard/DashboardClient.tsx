"use client";

import { useEffect, useMemo, useState } from "react";

type TaskResponse = {
  title: string;
  description: string;
  why: string;
  stage: string;
};

type Props = {
  answers: string[];
};

const COMPLETED_STORAGE_PREFIX = "lifeos_daily_task_done_";

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

export default function DashboardClient({ answers }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayLabel = useMemo(() => getGreekTodayLabel(today), [today]);
  const completedKey = useMemo(
    () => `${COMPLETED_STORAGE_PREFIX}${getDateKey(today)}`,
    [today]
  );

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    try {
      const done = window.localStorage.getItem(completedKey);
      setCompleted(done === "1");
    } catch {
      // Ignore storage read errors.
    }

    setLoading(true);
    setError(null);

    fetch("/api/daily-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed (${res.status})`);
        }
        const data = (await res.json()) as TaskResponse;
        setTask(data);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Κάτι πήγε στραβά.");
      })
      .finally(() => setLoading(false));
  }, [answers, completedKey]);

  function onMarkComplete() {
    window.localStorage.setItem(completedKey, "1");
    setCompleted(true);
  }

  return (
    <main className="min-h-screen bg-white px-6">
      <div className="mx-auto flex max-w-2xl flex-col pb-16 pt-10">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-semibold">Καλημέρα</h1>
          <p className="mt-2 text-sm text-neutral-600">{todayLabel}</p>
        </header>

        <section className="flex flex-1 items-center justify-center">
          <div className="w-full rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            {loading ? (
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
              </div>
            ) : task ? (
              <div>
                <h2 className="text-xl font-semibold text-black">{task.title}</h2>
                <p className="mt-3 text-neutral-700">{task.description}</p>
                <p className="mt-4 text-sm text-neutral-500">
                  <span className="font-medium text-neutral-600">
                    Γιατί έχει σημασία σήμερα:
                  </span>{" "}
                  {task.why}
                </p>
              </div>
            ) : (
              <div />
            )}
          </div>
        </section>

        <div className="mt-auto flex justify-center">
          <button
            type="button"
            onClick={onMarkComplete}
            disabled={loading || completed || !!error}
            className={[
              "w-full max-w-md rounded-xl border border-black/10 bg-black px-6 py-4 text-center",
              "text-sm font-medium text-white transition",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
          >
            {completed ? "Ολοκληρώθηκε ✓" : "Το έκανα ✓"}
          </button>
        </div>
      </div>
    </main>
  );
}

