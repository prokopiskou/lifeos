import { clampWeek } from "@/lib/journey";

export type WithinPathStage = {
  id: string;
  en: string;
  el: string;
  weeksLabel: string;
};

export const WITHIN_PATH_STAGES: WithinPathStage[] = [
  { id: "awake", en: "Awake", el: "Ξύπνημα", weeksLabel: "Εβδομάδες 1–2" },
  { id: "pause", en: "Pause", el: "Παύση", weeksLabel: "Εβδομάδες 3–4" },
  { id: "remember", en: "Remember", el: "Θυμήσου", weeksLabel: "Εβδομάδες 5–6" },
  { id: "align", en: "Align", el: "Ευθυγράμμιση", weeksLabel: "Εβδομάδες 7–8" },
  { id: "embody", en: "Embody", el: "Ενσωμάτωση", weeksLabel: "Εβδομάδα 9" },
];

/** DB / admin values (English keys). */
export const WITHIN_PATH_STAGE_DB_VALUES = [
  "Awake",
  "Pause",
  "Remember",
  "Align",
  "Embody",
] as const;

export type WithinPathStageDbValue = (typeof WITHIN_PATH_STAGE_DB_VALUES)[number];

const DB_TO_INDEX: Record<string, number> = {
  Awake: 0,
  Pause: 1,
  Remember: 2,
  Align: 3,
  Embody: 4,
};

/** Resolve stage index from `user_journey.within_path_stage` (defaults to Awake). */
export function getStageIndexFromDbValue(db: string | null | undefined): number {
  if (!db || !(db in DB_TO_INDEX)) return 0;
  return DB_TO_INDEX[db] ?? 0;
}

export function getStageFromDbValue(db: string | null | undefined): WithinPathStage {
  const idx = getStageIndexFromDbValue(db);
  return WITHIN_PATH_STAGES[idx]!;
}

/** @deprecated Use getStageIndexFromDbValue with DB column instead. */
export function getCurrentStageIndexFromWeek(week: number): number {
  const w = clampWeek(week);
  if (w <= 2) return 0;
  if (w <= 4) return 1;
  if (w <= 6) return 2;
  if (w <= 8) return 3;
  return 4;
}
