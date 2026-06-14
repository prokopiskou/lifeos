import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// WITHIN OS — Phase 5: Πρωινό task generation
// Διαβάζει το task_calibration της σημερινής μέρας, παράγει
// identity-aligned evidence_tasks (πλήθος βάσει task_size).
// Idempotent: αν υπάρχουν ήδη tasks σήμερα, τα επιστρέφει.
// ============================================================

export const dynamic = "force-dynamic";

// Ο owner θέλει ΕΝΑ ξεκάθαρο task τη μέρα (όχι 3). Μόνο "none" -> κανένα.
const COUNT: Record<string, number> = { full: 1, half: 1, minimal: 1, none: 0 };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const date = todayISO();

  // Ήδη υπάρχουν;
  const { data: existing } = await supabase
    .from("evidence_tasks")
    .select("id,task_text,position,completed")
    .eq("user_id", user.id)
    .eq("date", date)
    .order("position", { ascending: true });
  if (existing && existing.length > 0) {
    return NextResponse.json({ tasks: existing, generated: false });
  }

  // Calibration + profile
  const [{ data: cal }, { data: profile }] = await Promise.all([
    supabase.from("task_calibration").select("task_size,tone_profile").eq("user_id", user.id).eq("date", date).maybeSingle(),
    supabase.from("profiles").select("identity_statement,identity_gender,within_path_stage").eq("id", user.id).maybeSingle(),
  ]);

  const taskSize = cal?.task_size ?? "full";
  const n = COUNT[taskSize] ?? 3;
  if (n === 0) return NextResponse.json({ tasks: [], generated: false, task_size: "none" });

  const identity = profile?.identity_statement ?? "Άνθρωπος που χτίζει τον εαυτό του";
  const gender = profile?.identity_gender ?? "n";
  const stage = profile?.within_path_stage ?? "awake";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let tasks: string[] = [];

  if (apiKey) {
    const prompt = `Είσαι ο σχεδιαστής μικρο-πράξεων του Within OS. Μιλάς Ελληνικά.
Ταυτότητα ατόμου: ${identity}
Γένος δήλωσης: ${gender}
Within Path stage: ${stage}
Μέγεθος σήμερα: ${taskSize}
Δώσε ΑΚΡΙΒΩΣ ΕΝΑ (1) ξεκάθαρο micro-action που είναι ΑΠΟΔΕΙΞΗ της ταυτότητας, όχι generic productivity.
Κανόνες:
- Ένα και μόνο. Ξεκάθαρο, χωρίς υποερωτήματα.
- Τόσο μικρό που δεν μπορεί να αποτύχει σε δύσκολη μέρα
- Συγκεκριμένο, παρατηρήσιμο, ολοκληρώνεται σε <5 λεπτά
- Καμία επιβολή, κανένα "πρέπει", κανένα emoji
- Συμφωνία γένους: 'm'→αρσενικά, 'f'→θηλυκά, 'n'→απόφυγε έμφυλους τύπους
- Παράδειγμα για "Γυναίκα που δεν εξηγείται": "Σήμερα, μία φορά, μην πεις συγγνώμη όταν δεν φταις."
Επέστρεψε ΜΟΝΟ JSON: {"tasks":["...","..."]}`;

    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await r.json();
      const text: string = data?.content?.[0]?.text ?? "{}";
      const clean = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const slice = clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1);
      const parsed = JSON.parse(slice);
      if (Array.isArray(parsed?.tasks)) tasks = parsed.tasks.slice(0, n).map(String);
    } catch (e) {
      console.error("[tasks/today] claude error", e);
    }
  }

  // Fallback αν δεν υπάρχει key ή απέτυχε
  if (tasks.length === 0) {
    tasks = ["Σήμερα, κάνε ένα μικρό πράγμα που αποδεικνύει ποιος γίνεσαι."].slice(0, n || 1);
  }

  const rows = tasks.map((t, i) => ({ user_id: user.id, date, task_text: t, position: i + 1, completed: false }));
  const { data: inserted } = await supabase.from("evidence_tasks").insert(rows).select("id,task_text,position,completed");

  return NextResponse.json({ tasks: inserted ?? rows, generated: true, task_size: taskSize });
}
