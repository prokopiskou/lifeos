"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WithinGrid, { quadrantOf, type GridPoint } from "@/components/WithinGrid";

type Gender = "f" | "m" | "n";
type Answer = "yes" | "no" | "partial";

const TYPE_LABEL: Record<Gender, string> = {
  f: "Γυναίκα που",
  m: "Άντρας που",
  n: "Άνθρωπος που",
};

const WHISPERS: Record<Gender, string[]> = {
  f: [
    "Γυναίκα που δεν εξηγείται",
    "Γυναίκα που μένει με αυτό που νιώθει",
    "Γυναίκα που δεν χρειάζεται έγκριση",
    "Γυναίκα που λέει όχι χωρίς ενοχή",
    "Γυναίκα που τελειώνει αυτό που ξεκινάει",
    "Γυναίκα που δεν επιστρέφει σε ό,τι την έσπασε",
    "Γυναίκα που εμπιστεύεται την παρόρμησή της",
  ],
  m: [
    "Άντρας που δεν εξηγείται",
    "Άντρας που μένει με αυτό που νιώθει",
    "Άντρας που δεν χρειάζεται έγκριση",
    "Άντρας που λέει όχι χωρίς ενοχή",
    "Άντρας που τελειώνει αυτό που ξεκινάει",
    "Άντρας που δεν επιστρέφει σε ό,τι τον έσπασε",
    "Άντρας που εμπιστεύεται την παρόρμησή του",
  ],
  n: [
    "Άνθρωπος που δεν εξηγείται",
    "Άνθρωπος που μένει με αυτό που νιώθει",
    "Άνθρωπος που δεν χρειάζεται έγκριση",
    "Άνθρωπος που λέει όχι χωρίς ενοχή",
    "Άνθρωπος που τελειώνει αυτό που ξεκινάει",
    "Άνθρωπος που δεν επιστρέφει σε ό,τι τον έσπασε",
    "Άνθρωπος που εμπιστεύεται την παρόρμησή του",
  ],
};

const PRONOUN: Record<Gender, string> = { f: "αυτή", m: "αυτός", n: "αυτό" };

function quadrantLine(q: string, g: Gender): string {
  if (q === "aligned") return "Σήμερα ήσουν εσύ.";
  if (q === "restorative") return "Σήμερα ήσουν σε ειρήνη.";
  if (q === "reactive") return "Σήμερα ήσουν σε φόβο.";
  return g === "f" ? "Σήμερα ήσουν καμένη." : g === "m" ? "Σήμερα ήσουν καμένος." : "Σήμερα ήσουν καμένο.";
}

function actionLine(a: Answer, g: Gender): string {
  const who = PRONOUN[g];
  if (a === "no") return `Και δεν έδρασες ως ${who} που χτίζεις.`;
  if (a === "partial") return `Και έδρασες λίγο ως ${who} που χτίζεις.`;
  return `Και έδρασες ως ${who} που χτίζεις.`;
}

// Wrapper οθόνης
function Screen({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="within"
      style={{
        minHeight: "100dvh",
        background: dark ? "#000000" : "#FAFAF7",
        color: dark ? "#FAFAF7" : "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        textAlign: "center",
        gap: 24,
      }}
    >
      {children}
    </div>
  );
}

function Btn({ onClick, children, dark }: { onClick: () => void; children: React.ReactNode; dark?: boolean }) {
  return (
    <button className={`within-btn${dark ? " within-btn--invert" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [gender, setGender] = useState<Gender | null>(null);
  const [identity, setIdentity] = useState("");
  const [showWhispers, setShowWhispers] = useState(false);
  const [mirrorReady, setMirrorReady] = useState(false);
  const [grid, setGrid] = useState<GridPoint | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const next = () => setStep((s) => s + 1);

  // Screen 4: whispered examples μετά από 6s inactivity
  useEffect(() => {
    if (step !== 4 || !gender) return;
    setShowWhispers(false);
    const t = setTimeout(() => setShowWhispers(true), 6000);
    return () => clearTimeout(t);
  }, [step, gender]);

  // Screen 5: mirror moment — 5s ΧΩΡΙΣ κουμπί
  useEffect(() => {
    if (step !== 5) return;
    setMirrorReady(false);
    const t = setTimeout(() => setMirrorReady(true), 5000);
    return () => clearTimeout(t);
  }, [step]);

  async function finish() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const lock = new Date();
        lock.setDate(lock.getDate() + 30);
        await supabase.from("profiles").upsert({
          id: user.id,
          identity_statement: identity.trim(),
          identity_gender: gender,
          identity_locked_until: lock.toISOString().slice(0, 10),
          within_path_stage: "awake",
          onboarding_done: true,
          notify_time: notify ? "21:00" : null,
        });
      }
    } catch (e) {
      // Μην μπλοκάρεις τον χρήστη σε σφάλμα — προχώρα στο dashboard.
      console.error(e);
    }
    router.push("/today");
  }

  // ---------- SCREENS ----------
  if (step === 1)
    return (
      <Screen dark>
        <h1 style={{ fontSize: 48, lineHeight: 1.2 }} className="within-fade-in">
          Σταμάτα.<br />Δεν χρειάζεσαι<br />άλλο app.
        </h1>
        <p style={{ color: "#9a9a9a", fontSize: 18 }}>Εκτός αν διαφέρει.</p>
        <Btn dark onClick={next}>Δείξε μου</Btn>
      </Screen>
    );

  if (step === 2)
    return (
      <Screen>
        <h2 style={{ fontSize: 28, maxWidth: 520 }}>
          Πόσα apps έχεις στο τηλέφωνό σου που σου υποσχέθηκαν αλλαγή;
        </h2>
        <p style={{ color: "var(--grey)" }}>Άλλαξες;</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Btn onClick={next}>Όχι αρκετά</Btn>
          <Btn onClick={next}>Καθόλου</Btn>
        </div>
      </Screen>
    );

  if (step === 3)
    return (
      <Screen dark>
        <h2 style={{ fontSize: 28, lineHeight: 1.4, maxWidth: 560 }} className="within-slide-up">
          Δεν είναι τα apps το πρόβλημα.<br />Είναι αυτό που μετράνε.
        </h2>
        <p style={{ fontSize: 22 }}>Μετράνε τι κάνεις. Όχι ποιος γίνεσαι.</p>
        <Btn dark onClick={next}>Δείξε μου τη διαφορά</Btn>
      </Screen>
    );

  if (step === 4)
    return (
      <Screen>
        <h2 style={{ fontSize: 28 }}>Ποιος θέλεις να γίνεις;</h2>
        <p style={{ color: "var(--grey)", maxWidth: 460 }}>
          Όχι τι θες να αλλάξεις. Ποιος θες να γίνεις.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {(["f", "m", "n"] as Gender[]).map((g) => (
            <button
              key={g}
              className="within-btn"
              style={{ borderColor: gender === g ? "var(--gold)" : "var(--ink)", color: gender === g ? "var(--gold)" : "var(--ink)" }}
              onClick={() => { setGender(g); setIdentity((v) => v || ""); }}
            >
              {TYPE_LABEL[g]}…
            </button>
          ))}
        </div>
        {gender && (
          <>
            <input
              autoFocus
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder={`${TYPE_LABEL[gender]}…`}
              className="within"
              style={{
                marginTop: 8, width: "100%", maxWidth: 480, fontSize: 22, textAlign: "center",
                border: "none", borderBottom: "1px solid var(--ink)", background: "transparent",
                padding: "10px 4px", outline: "none",
              }}
            />
            {showWhispers && (
              <div style={{ marginTop: 8, color: "#bdbdbd", fontSize: 16, lineHeight: 1.9 }} className="within-fade-in">
                {WHISPERS[gender].map((w) => (
                  <div key={w} style={{ cursor: "pointer" }} onClick={() => setIdentity(w)}>{w}</div>
                ))}
              </div>
            )}
            <Btn onClick={() => identity.trim().length > 3 && next()}>Συνέχεια</Btn>
          </>
        )}
      </Screen>
    );

  if (step === 5)
    return (
      <Screen dark>
        <h1 style={{ fontSize: 48, lineHeight: 1.25, maxWidth: 640 }} className="within-fade-in">
          {identity.trim()}
        </h1>
        {mirrorReady && (
          <div className="within-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
            <p style={{ fontSize: 20 }}>Αυτή/ός είσαι από σήμερα.</p>
            <Btn dark onClick={next}>Ναι</Btn>
          </div>
        )}
      </Screen>
    );

  if (step === 6)
    return (
      <Screen dark>
        <div style={{ fontSize: 22, lineHeight: 1.7 }} className="within-slide-up">
          Δεν θα σε ταΐσουμε κίνητρα.<br />
          Δεν θα σε ξυπνάμε στις 6.<br />
          Δεν θα σου μετράμε streaks.
        </div>
        <div style={{ fontSize: 22, lineHeight: 1.7, marginTop: 12 }}>
          Θα σου κάνουμε μία ερώτηση το βράδυ.<br />
          Και θα σου δείχνουμε ποιος γίνεσαι.
        </div>
        <Btn dark onClick={next}>Συνεχίζω</Btn>
      </Screen>
    );

  if (step === 7)
    return (
      <Screen>
        <h2 style={{ fontSize: 24 }}>Πού ήσουν σήμερα;</h2>
        <WithinGrid value={grid} onChange={setGrid} showQuadrantLabel={false} />
        {grid && (
          <div className="within-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <p style={{ fontSize: 18 }}>Έδρασες ως {identity.trim()};</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <Btn onClick={() => { setAnswer("yes"); next(); }}>Ναι</Btn>
              <Btn onClick={() => { setAnswer("partial"); next(); }}>Εν μέρει</Btn>
              <Btn onClick={() => { setAnswer("no"); next(); }}>Όχι</Btn>
            </div>
          </div>
        )}
      </Screen>
    );

  if (step === 8) {
    const g = gender ?? "n";
    const q = grid ? quadrantOf(grid.x, grid.y) : "depleted";
    const a = answer ?? "no";
    return (
      <Screen dark>
        <div style={{ fontSize: 24, lineHeight: 1.6, maxWidth: 560 }} className="within-slide-up">
          {quadrantLine(q, g)}<br />
          {actionLine(a, g)}<br /><br />
          Αυτό δεν είναι αποτυχία.<br />
          Είναι το πρώτο σημείο στον χάρτη σου.
        </div>
        <Btn dark onClick={next}>Δες πού ξεκινάς</Btn>
      </Screen>
    );
  }

  if (step === 9)
    return (
      <Screen>
        <WithinGrid value={grid} readOnly showQuadrantLabel={false} size={220} />
        <div style={{ fontSize: 22, lineHeight: 1.7, maxWidth: 520 }}>
          Σε 7 μέρες, θα δεις 7 σημεία.<br />
          Σε 30, θα δεις ποιος γίνεσαι.<br />
          Σε 90, θα την έχεις γίνει.
        </div>
        <Btn onClick={next}>Ξεκινάμε</Btn>
      </Screen>
    );

  // step 10
  return (
    <Screen>
      <h2 style={{ fontSize: 24, maxWidth: 460 }}>Θες να σου θυμίζουμε στις 9 κάθε βράδυ;</h2>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="within-btn" style={{ borderColor: notify ? "var(--gold)" : "var(--ink)", color: notify ? "var(--gold)" : "var(--ink)" }} onClick={() => setNotify(true)}>Ναι</button>
        <button className="within-btn" style={{ borderColor: !notify ? "var(--gold)" : "var(--ink)", color: !notify ? "var(--gold)" : "var(--ink)" }} onClick={() => setNotify(false)}>Όχι τώρα</button>
      </div>
      <Btn onClick={finish}>{saving ? "..." : "Μπες μέσα"}</Btn>
    </Screen>
  );
}
