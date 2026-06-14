import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// WITHIN OS — Phase 6: Pattern Mirror (weekly)
// Κυριακή 21:00. Για κάθε χρήστη με 7+ μέρες data: τρέχει τους
// 15 κανόνες, διαλέγει ΕΝΑΝ με priority, παράγει stage-adaptive
// κείμενο (Claude), αποθηκεύει σε pattern_mirrors.
// Manual override: αν υπάρχει ήδη row για την εβδομάδα (π.χ. is_manual), skip.
// ============================================================

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Checkin = {
  date: string;
  grid_x: number;
  grid_y: number;
  quadrant: string | null;
  identity_answer: string | null;
  word: string | null;
};

function qOf(c: Checkin): string {
  return c.quadrant ?? (c.grid_x >= 0.5 && c.grid_y >= 0.5 ? "aligned" : c.grid_x < 0.5 && c.grid_y >= 0.5 ? "restorative" : c.grid_x >= 0.5 ? "reactive" : "depleted");
}
function ansVal(a: string | null): number { return a === "yes" ? 1 : a === "partial" ? 0.5 : 0; }
function isoDaysAgo(base: Date, n: number) { const d = new Date(base); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function mondayOf(d: Date) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x.toISOString().slice(0, 10); }

const STAGE_DEPTH: Record<string, string> = {
  awake: "very gentle, reassuring, ελάχιστο pattern naming",
  pause: "gentle με ελαφριά παρατήρηση",
  remember: "balanced ζεστασιά + βάθος",
  align: "πιο direct αλλά με αγάπη",
  embody: "sharp companion, φιλοσοφικό, no hand-holding",
};

// Επιστρέφει {rule, ctx} με priority logic, ή null.
function detectRule(cks: Checkin[]): { rule: number; ctx: string } | null {
  const last30 = cks;
  const yesRate = last30.reduce((s, c) => s + ansVal(c.identity_answer), 0) / Math.max(1, last30.length);
  const counts: Record<string, number> = { aligned: 0, restorative: 0, reactive: 0, depleted: 0 };
  last30.forEach((c) => { counts[qOf(c)] = (counts[qOf(c)] || 0) + 1; });
  const total = last30.length;

  // --- CRITICAL ---
  // R4 Avoidance streak: 5+ συνεχόμενες μέρες depleted/reactive + no
  let run = 0, maxRun = 0;
  for (const c of last30) {
    const q = qOf(c);
    if ((q === "depleted" || q === "reactive") && c.identity_answer === "no") { run++; maxRun = Math.max(maxRun, run); } else run = 0;
  }
  if (maxRun >= 5) return { rule: 4, ctx: `${maxRun} συνεχόμενες δύσκολες μέρες` };

  // R5 Restoration resistance: <10% restorative σε 30 μέρες
  if (total >= 20 && counts.restorative / total < 0.1) return { rule: 5, ctx: `${Math.round((counts.restorative / total) * 100)}% restorative σε ${total} μέρες` };

  // --- IDENTITY ---
  // R2 Action-Identity gap: yes-rate <40% (2+ εβδ)
  if (total >= 14 && yesRate < 0.4) return { rule: 2, ctx: `yes-rate ${Math.round(yesRate * 100)}%` };

  // R3 Fear-driven: yes υψηλό όταν reactive, χαμηλό όταν aligned/restorative
  const reactive = last30.filter((c) => qOf(c) === "reactive");
  const calm = last30.filter((c) => ["aligned", "restorative"].includes(qOf(c)));
  if (reactive.length >= 3 && calm.length >= 3) {
    const yReact = reactive.reduce((s, c) => s + ansVal(c.identity_answer), 0) / reactive.length;
    const yCalm = calm.reduce((s, c) => s + ansVal(c.identity_answer), 0) / calm.length;
    if (yReact - yCalm > 0.3) return { rule: 3, ctx: "δράση περισσότερο από φόβο παρά από ηρεμία" };
  }

  // --- PATTERNS ---
  // R1 Day pattern: συγκεκριμένη μέρα >70% σε ένα quadrant (14+ μέρες)
  if (total >= 14) {
    const byDow: Record<number, Record<string, number>> = {};
    last30.forEach((c) => { const d = new Date(c.date).getDay(); byDow[d] = byDow[d] || {}; byDow[d][qOf(c)] = (byDow[d][qOf(c)] || 0) + 1; });
    const names = ["Κυριακές", "Δευτέρες", "Τρίτες", "Τετάρτες", "Πέμπτες", "Παρασκευές", "Σάββατα"];
    for (const d of Object.keys(byDow)) {
      const m = byDow[+d]; const sum = Object.values(m).reduce((a, b) => a + b, 0);
      if (sum >= 3) { for (const q of Object.keys(m)) if (m[q] / sum > 0.7) return { rule: 1, ctx: `οι ${names[+d]} σου είναι συχνά ${q}` }; }
    }
  }

  // R11 Aligned cluster μετά από restorative
  for (let i = 1; i < last30.length; i++) {
    if (qOf(last30[i]) === "aligned" && qOf(last30[i - 1]) === "restorative") return { rule: 11, ctx: "καλές μέρες μετά από ξεκούραση" };
  }

  // R9 Return: τελευταίο gap >=5 μέρες
  if (last30.length >= 2) {
    const gap = Math.round((new Date(last30[last30.length - 1].date).getTime() - new Date(last30[last30.length - 2].date).getTime()) / 86400000);
    if (gap >= 5) return { rule: 9, ctx: `επιστροφή μετά από ${gap} μέρες` };
  }

  // default: ένα ζεστό continuation mirror (Rule 12-ish)
  return { rule: 12, ctx: "συνέχιση της διαδρομής" };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const today = new Date();
  const weekStart = mondayOf(today);
  const since = isoDaysAgo(today, 30);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const { data: profiles } = await supabase.from("profiles").select("id,identity_statement,identity_gender,within_path_stage").eq("onboarding_done", true);

  let processed = 0, skipped = 0;
  for (const p of profiles ?? []) {
    // Manual override / ήδη υπάρχει για την εβδομάδα;
    const { data: existing } = await supabase.from("pattern_mirrors").select("id,is_manual").eq("user_id", p.id).eq("week_start", weekStart).maybeSingle();
    if (existing) { skipped++; continue; }

    const { data: rows } = await supabase.from("daily_checkins").select("date,grid_x,grid_y,quadrant,identity_answer,word").eq("user_id", p.id).gte("date", since).order("date", { ascending: true });
    const cks = (rows ?? []) as Checkin[];
    if (cks.length < 7) { skipped++; continue; }

    const detected = detectRule(cks);
    if (!detected) { skipped++; continue; }

    const stage = p.within_path_stage ?? "awake";
    let text = "Είσαι ακόμα εδώ. Αυτό μετράει. Δεν χρειάζεται να είναι τέλειο — αρκεί να είναι αληθινό.";

    if (apiKey) {
      const prompt = `You are the Pattern Mirror of Within OS. You speak in Greek.
You are NOT a coach. You are a wise, warm friend who notices things and shares them with love.
User's identity: ${p.identity_statement ?? ""}
User's gender for agreement: ${p.identity_gender ?? "n"}
User's stage: ${stage}
Triggered rule: ${detected.rule}
Data context: ${detected.ctx}
Generate a Pattern Mirror text:
- Start with acknowledgment, not observation
- Maximum 70 words
- Maximum 1 specific data point
- Lower the bar somewhere ("δεν χρειάζεται","αρκεί","λίγο")
- End with continuation, not instruction
- No exclamation marks, no emojis, no "πρέπει"/"you should"
- Gender agreement (f/m) ή ουδέτερο αν n
- Depth για το stage: ${STAGE_DEPTH[stage] ?? STAGE_DEPTH.remember}
Return ONLY the text.`;
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
        });
        const data = await r.json();
        const t: string = data?.content?.[0]?.text;
        if (t && t.trim()) text = t.trim();
      } catch (e) { console.error("[pattern-mirror] claude error", e); }
    }

    await supabase.from("pattern_mirrors").insert({
      user_id: p.id, week_start: weekStart, rule_triggered: detected.rule, mirror_text: text, delivered_at: new Date().toISOString(), is_manual: false,
    });
    processed++;
  }

  return NextResponse.json({ ok: true, week_start: weekStart, processed, skipped });
}
