"use client";

import { useEffect, useState } from "react";

type Letter = { id: string; from_stage: string; to_stage: string; letter_text: string };

const STAGE_GR: Record<string, string> = {
  awake: "Awake", pause: "Pause", remember: "Remember", align: "Align", embody: "Embody",
};

/**
 * Όταν ο admin προάγει stage και γράψει γράμμα, ο χρήστης το βλέπει
 * ΜΙΑ φορά ως modal στο επόμενο άνοιγμα. Mountάρεται global (layout).
 */
export default function PathLetterModal() {
  const [letter, setLetter] = useState<Letter | null>(null);

  useEffect(() => {
    fetch("/api/path-letter").then((r) => r.json()).then((d) => { if (d.letter) setLetter(d.letter); }).catch(() => {});
  }, []);

  if (!letter) return null;

  function close() {
    if (letter) fetch("/api/path-letter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: letter.id }) }).catch(() => {});
    setLetter(null);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      className="within within-fade-in"
    >
      <div style={{ maxWidth: 560, color: "#FAFAF7", textAlign: "center" }}>
        <p style={{ color: "var(--gold)", fontSize: 13, letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
          {STAGE_GR[letter.from_stage] ?? letter.from_stage} → {STAGE_GR[letter.to_stage] ?? letter.to_stage}
        </p>
        <p style={{ fontSize: 22, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{letter.letter_text}</p>
        <button className="within-btn within-btn--invert" style={{ marginTop: 28 }} onClick={close}>
          Το κράτησα
        </button>
      </div>
    </div>
  );
}
