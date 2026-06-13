"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WithinGrid, { type GridPoint } from "@/components/WithinGrid";

type Task = { id?: string; task_text: string; position: number; completed: boolean };
type Answer = "yes" | "no" | "partial";

export default function CheckinPage() {
  const router = useRouter();
  const openedAt = useRef<number>(Date.now());
  const [step, setStep] = useState<"grid" | "identity" | "tasks" | "word" | "done">("grid");
  const [identity, setIdentity] = useState("");
  const [grid, setGrid] = useState<GridPoint | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [word, setWord] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("profiles").select("identity_statement").eq("id", data.user.id).maybeSingle()
          .then(({ data: p }) => setIdentity(p?.identity_statement ?? ""));
      }
    });
    fetch("/api/tasks/today").then((r) => r.json()).then((d) => setTasks(d.tasks ?? [])).catch(() => {});
  }, []);

  function toggleTask(i: number) {
    setTasks((ts) => ts.map((t, idx) => (idx === i ? { ...t, completed: !t.completed } : t)));
  }

  async function submit() {
    if (!grid) return;
    setSaving(true);
    const latency = Math.round((Date.now() - openedAt.current) / 1000);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grid_x: grid.x,
          grid_y: grid.y,
          identity_answer: answer,
          tasks_total: tasks.length || 3,
          tasks_completed: tasks.filter((t) => t.completed).length,
          word: word,
          response_latency_sec: latency,
        }),
      });
      const data = await res.json();
      setMessage(data.message ?? "Συνεχίζεις. Αυτό μετράει.");
      setStep("done");
    } catch {
      setMessage("Κάτι πήγε στραβά, αλλά το σημείο σου καταγράφηκε.");
      setStep("done");
    }
  }

  const wrap: React.CSSProperties = {
    minHeight: "100dvh", background: "#FAFAF7", color: "#000",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "32px 24px", textAlign: "center", gap: 22,
  };

  if (step === "grid")
    return (
      <div className="within" style={wrap}>
        <h2 style={{ fontSize: 24 }}>Πού ήσουν σήμερα;</h2>
        <WithinGrid value={grid} onChange={setGrid} showQuadrantLabel={false} />
        {grid && <button className="within-btn" onClick={() => setStep("identity")}>Συνέχεια</button>}
      </div>
    );

  if (step === "identity")
    return (
      <div className="within" style={wrap}>
        <h2 style={{ fontSize: 20, maxWidth: 460 }}>Έδρασες ως {identity || "αυτός/ή που χτίζεις"};</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="within-btn" onClick={() => { setAnswer("yes"); setStep("tasks"); }}>Ναι</button>
          <button className="within-btn" onClick={() => { setAnswer("partial"); setStep("tasks"); }}>Εν μέρει</button>
          <button className="within-btn" onClick={() => { setAnswer("no"); setStep("tasks"); }}>Όχι</button>
        </div>
      </div>
    );

  if (step === "tasks")
    return (
      <div className="within" style={wrap}>
        <h2 style={{ fontSize: 20 }}>Τα σημερινά σου βήματα</h2>
        {tasks.length === 0 && <p style={{ color: "var(--grey)" }}>Σήμερα, ένα tap ότι είσαι εδώ αρκεί.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 460, width: "100%" }}>
          {tasks.map((t, i) => (
            <button
              key={t.id ?? i}
              onClick={() => toggleTask(i)}
              className="within"
              style={{
                textAlign: "left", padding: "12px 16px", border: "1px solid #000",
                background: t.completed ? "#000" : "transparent", color: t.completed ? "#FAFAF7" : "#000",
                cursor: "pointer", fontSize: 16, lineHeight: 1.5,
              }}
            >
              {t.completed ? "✓ " : "○ "}{t.task_text}
            </button>
          ))}
        </div>
        <button className="within-btn" onClick={() => setStep("word")}>Συνέχεια</button>
      </div>
    );

  if (step === "word")
    return (
      <div className="within" style={wrap}>
        <h2 style={{ fontSize: 20 }}>Μία λέξη για σήμερα;</h2>
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="(προαιρετικό)"
          className="within"
          style={{ fontSize: 22, textAlign: "center", border: "none", borderBottom: "1px solid #000", background: "transparent", padding: "10px 4px", outline: "none", maxWidth: 320 }}
        />
        <button className="within-btn" onClick={submit}>{saving ? "..." : "Τελείωσα"}</button>
      </div>
    );

  // done
  return (
    <div className="within" style={wrap}>
      <p style={{ fontSize: 22, lineHeight: 1.7, maxWidth: 520 }} className="within-fade-in">{message}</p>
      <button className="within-btn" onClick={() => router.push("/dashboard")}>Στο dashboard</button>
    </div>
  );
}
