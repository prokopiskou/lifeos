"use client";

import { useMemo, useState } from "react";

import {
  WITHIN_PATH_STAGE_DB_VALUES,
  type WithinPathStageDbValue,
} from "@/lib/within-path";

const STAGE_LABELS: Record<WithinPathStageDbValue, string> = {
  Awake: "Awake — Ξύπνημα",
  Pause: "Pause — Παύση",
  Remember: "Remember — Θυμήσου",
  Align: "Align — Ευθυγράμμιση",
  Embody: "Embody — Ενσωμάτωση",
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  current_week: number;
  streak: number;
  completion_rate: number;
  within_path_stage: string;
};

type Props = {
  initialRows: AdminUserRow[];
};

export default function AdminUsersClient({ initialRows }: Props) {
  const [stages, setStages] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRows.map((r) => [r.id, r.within_path_stage]))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Record<string, string | null>>({});

  const sorted = useMemo(
    () => [...initialRows].sort((a, b) => (a.email ?? "").localeCompare(b.email ?? "")),
    [initialRows]
  );

  async function save(userId: string) {
    const stage = stages[userId];
    if (!stage || saving[userId]) return;
    // Προαιρετικό personal letter που θα δει ο χρήστης ως modal.
    const letter = window.prompt(
      "Προσωπικό γράμμα για αυτή τη μετάβαση stage (προαιρετικό — κενό = χωρίς γράμμα):",
      ""
    );
    setSaving((s) => ({ ...s, [userId]: true }));
    setFeedback((f) => ({ ...f, [userId]: null }));
    try {
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, stage, letter: letter ?? "" }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string };
      if (!res.ok || !data?.ok) {
        setFeedback((f) => ({
          ...f,
          [userId]: data?.error || `Σφάλμα (${res.status})`,
        }));
        return;
      }
      setFeedback((f) => ({ ...f, [userId]: "Αποθηκεύτηκε ✓" }));
      window.setTimeout(() => {
        setFeedback((f) => ({ ...f, [userId]: null }));
      }, 2000);
    } finally {
      setSaving((s) => ({ ...s, [userId]: false }));
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-neutral-500">
            <th className="py-3 pr-4 font-medium">Email</th>
            <th className="py-3 pr-4 font-medium">Εβδομάδα</th>
            <th className="py-3 pr-4 font-medium">Σερί</th>
            <th className="py-3 pr-4 font-medium">Ολοκλ. μήνα</th>
            <th className="py-3 pr-4 font-medium">Within Path</th>
            <th className="py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className="border-b border-black/5">
              <td className="max-w-[200px] truncate py-3 pr-4 text-neutral-800">
                {row.email ?? row.id.slice(0, 8)}
              </td>
              <td className="py-3 pr-4 tabular-nums">{row.current_week}</td>
              <td className="py-3 pr-4 tabular-nums">{row.streak}</td>
              <td className="py-3 pr-4 tabular-nums">{row.completion_rate}%</td>
              <td className="py-3 pr-4">
                <select
                  value={stages[row.id] ?? "Awake"}
                  onChange={(e) =>
                    setStages((s) => ({ ...s, [row.id]: e.target.value }))
                  }
                  className="w-full max-w-[240px] rounded-lg border border-black/15 bg-white px-2 py-1.5 text-[13px] outline-none"
                >
                  {WITHIN_PATH_STAGE_DB_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {STAGE_LABELS[v]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-3">
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => void save(row.id)}
                    disabled={Boolean(saving[row.id])}
                    className="rounded-lg border border-black/10 bg-black px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-neutral-900 disabled:opacity-50"
                  >
                    {saving[row.id] ? "…" : "Αποθήκευση"}
                  </button>
                  {feedback[row.id] ? (
                    <span className="text-[11px] text-neutral-500">{feedback[row.id]}</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
