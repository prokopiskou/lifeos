"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Task = { id: string; task_text: string; position: number; completed: boolean };

export default function TodayPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("profiles").select("identity_statement").eq("id", data.user.id).maybeSingle()
          .then(({ data: p }) => setIdentity(p?.identity_statement ?? ""));
      }
    });
    fetch("/api/tasks/today")
      .then((r) => r.json())
      .then((d) => setTasks((d.tasks ?? []).filter((t: Task) => t.id)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggle(i: number) {
    const t = tasks[i];
    const next = !t.completed;
    setTasks((ts) => ts.map((x, idx) => (idx === i ? { ...x, completed: next } : x)));
    fetch("/api/tasks/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, completed: next }),
    }).catch(() => {});
  }

  const wrap: React.CSSProperties = {
    minHeight: "100dvh", background: "#FAFAF7", color: "#000",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "40px 24px", gap: 24, textAlign: "center",
  };

  return (
    <div className="within" style={wrap}>
      {identity && (
        <p style={{ color: "var(--grey)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
          {identity}
        </p>
      )}
      <h1 style={{ fontSize: 28 }}>Σήμερα</h1>

      {loading ? (
        <p style={{ color: "var(--grey)" }}>…</p>
      ) : tasks.length === 0 ? (
        <p style={{ color: "var(--grey)", maxWidth: 420, lineHeight: 1.6 }}>
          Σήμερα δεν χρειάζεται τίποτα μεγάλο. Ένα tap το βράδυ ότι είσαι εδώ, αρκεί.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480, width: "100%" }}>
          {tasks.map((t, i) => (
            <button
              key={t.id}
              onClick={() => toggle(i)}
              className="within"
              style={{
                textAlign: "left", padding: "14px 18px", border: "1px solid #000",
                background: t.completed ? "#000" : "transparent",
                color: t.completed ? "#FAFAF7" : "#000",
                cursor: "pointer", fontSize: 16, lineHeight: 1.5,
              }}
            >
              {t.completed ? "✓ " : "○ "}{t.task_text}
            </button>
          ))}
        </div>
      )}

      <button className="within-btn" style={{ marginTop: 12 }} onClick={() => router.push("/checkin")}>
        Βραδινό check-in
      </button>
    </div>
  );
}
