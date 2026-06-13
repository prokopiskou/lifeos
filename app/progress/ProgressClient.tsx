"use client";

import type { ReactNode } from "react";

const ACCENT = "#C9A96E";
const RED = "#EF4444";
const GRAY = "#737373";

function percentColor(pct: number): string {
  if (pct > 70) return ACCENT;
  if (pct < 50) return RED;
  return GRAY;
}

type Props = {
  currentWeek: number;
  currentDay: number;
  weeklyPercent: number;
  weeklyTasksDone: number;
  monthlyPercent: number;
  monthTasksDone: number;
  monthDaysPassed: number;
  monthStatsUnavailable: boolean;
  streak: number;
  bestStreak: number;
  totalDaysActive: number;
  communityTopPercent: number | null;
  communityMessage: string;
  moodWeek: { date: string; mood: string | null }[];
};

function StatCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export default function ProgressClient({
  currentWeek,
  currentDay,
  weeklyPercent,
  weeklyTasksDone,
  monthlyPercent,
  monthTasksDone,
  monthDaysPassed,
  monthStatsUnavailable,
  streak,
  bestStreak,
  totalDaysActive,
  communityTopPercent,
  communityMessage,
  moodWeek,
}: Props) {
  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 pb-28 pt-10 text-black sm:px-6">
      <div className="mx-auto w-full max-w-[520px]">
        <header className="mb-10 text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-black sm:text-[30px]">
            Η Πρόοδός σου
          </h1>
          <p className="mt-2 text-[15px] text-neutral-500">
            Εβδομάδα {currentWeek} · Ημέρα {currentDay}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard>
            <p
              className="text-[34px] font-semibold leading-none tabular-nums tracking-tight sm:text-[38px]"
              style={{ color: percentColor(weeklyPercent) }}
            >
              {weeklyPercent}%
            </p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Ολοκλήρωση Εβδομάδας
            </p>
            <p className="mt-2 text-[13px] leading-snug text-neutral-600">
              {weeklyTasksDone} από 7 tasks
            </p>
          </StatCard>

          <StatCard>
            <p
              className="text-[34px] font-semibold leading-none tabular-nums tracking-tight sm:text-[38px]"
              style={{
                color: monthStatsUnavailable ? GRAY : percentColor(monthlyPercent),
              }}
            >
              {monthStatsUnavailable ? "—" : `${monthlyPercent}%`}
            </p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Ολοκλήρωση Μήνα
            </p>
            <p className="mt-2 text-[13px] leading-snug text-neutral-600">
              {monthStatsUnavailable
                ? "—"
                : `${monthTasksDone} από ${monthDaysPassed} μέρες`}
            </p>
          </StatCard>

          <StatCard>
            <p className="text-[34px] font-semibold leading-none tabular-nums tracking-tight sm:text-[38px]">
              <span aria-hidden className="mr-1.5 inline-block">
                🔥
              </span>
              <span style={{ color: ACCENT }}>{streak}</span>
            </p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Τρέχον Streak
            </p>
            <p className="mt-2 text-[13px] leading-snug text-neutral-600">
              συνεχόμενες μέρες
            </p>
          </StatCard>

          <StatCard>
            <p className="text-[34px] font-semibold leading-none tabular-nums tracking-tight sm:text-[38px]">
              <span aria-hidden className="mr-1.5 inline-block">
                ⭐
              </span>
              <span className="text-neutral-800">{bestStreak}</span>
            </p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Καλύτερο Streak
            </p>
            <p className="mt-2 text-[13px] leading-snug text-neutral-600">
              προσωπικό ρεκόρ
            </p>
          </StatCard>

          <StatCard>
            <p className="text-[34px] font-semibold leading-none tabular-nums text-neutral-900 sm:text-[38px]">
              {totalDaysActive}
            </p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Συνολικές Μέρες
            </p>
            <p className="mt-2 text-[13px] leading-snug text-neutral-600">
              ενεργής συμμετοχής
            </p>
          </StatCard>

          <StatCard>
            <p
              className="text-[22px] font-semibold leading-tight tabular-nums sm:text-[26px]"
              style={{ color: communityTopPercent !== null ? ACCENT : GRAY }}
            >
              {communityTopPercent !== null ? `Top ${communityTopPercent}%` : "—"}
            </p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Στην Κοινότητα
            </p>
            <p className="mt-2 text-[12px] leading-snug text-neutral-600">
              {communityMessage}
            </p>
          </StatCard>
        </div>

        <section className="mt-8 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Διάθεση Εβδομάδας
          </h2>
          <MoodRow moodWeek={moodWeek} />
        </section>
      </div>
    </main>
  );
}

function MoodRow({ moodWeek }: { moodWeek: { date: string; mood: string | null }[] }) {
  return (
    <div className="mt-6 flex justify-between gap-1 sm:gap-2">
      {moodWeek.map((d, i) => {
        const isToday = i === moodWeek.length - 1;
        return (
          <div
            key={d.date}
            className="flex flex-1 flex-col items-center gap-2"
          >
            <div
              className={[
                "flex h-11 w-11 items-center justify-center rounded-full border-2 text-xl sm:h-12 sm:w-12",
                isToday ? "border-[color:#C9A96E]" : "border-neutral-200",
                d.mood ? "bg-neutral-50" : "bg-white",
              ].join(" ")}
              aria-label={d.mood ? `Διάθεση ${d.date}` : `Χωρίς check-in ${d.date}`}
            >
              {d.mood ? <span aria-hidden>{d.mood}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
