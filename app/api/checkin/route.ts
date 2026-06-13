import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// WITHIN OS — Phase 5: Βραδινό check-in
// Αποθηκεύει το daily_checkin και επιστρέφει tone-appropriate
// μήνυμα (βάσει tone_profile από το task_calibration της μέρας).
// ============================================================

export const dynamic = "force-dynamic";

function quadrant(x: number, y: number): string {
  if (x >= 0.5 && y >= 0.5) return "aligned";
  if (x < 0.5 && y >= 0.5) return "restorative";
  if (x >= 0.5 && y < 0.5) return "reactive";
  return "depleted";
}

const TONE_FEWSHOT: Record<string, string> = {
  protect_momentum: "Κάτι κινείται. Μην το μεγαλώσεις. Άσε το να στεριώσει.",
  quiet_continue: "Συνεχίζεις. Αυτό που φαίνεται βαρετό, είναι το χτίσιμο.",
  lower_bar: "Σήμερα φαίνεται πιο βαρύ από χθες. Δεν χρειάζεται να σηκώσεις το ίδιο. Ένα μικρό αρκεί.",
  gentle_name: "Οι τελευταίες μέρες ήταν πιο δύσκολες — το βλέπω. Δεν χάλασε τίποτα. Ένα μικρό πράγμα σήμερα. Μόνο ένα.",
  door_open: "Δεν χρειάζεται check-in σήμερα. Ένα tap ότι είσαι εδώ, αρκεί.",
  welcome_back: "Επέστρεψες. Δεν χρειάζονται εξηγήσεις. Ξεκινάμε από εδώ, όχι από εκεί που σταμάτησες.",
  honest_check: "Κάνεις όλα τα σωστά. Πες μου κάτι όμως — τα νιώθεις, ή απλά τα τελειώνεις; Δεν υπάρχει λάθος απάντηση.",
};

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const grid_x = Number(body.grid_x);
  const grid_y = Number(body.grid_y);
  if (Number.isNaN(grid_x) || Number.isNaN(grid_y)) {
    return NextResponse.json({ error: "grid_x/grid_y required" }, { status: 400 });
  }
  const date = new Date().toISOString().slice(0, 10);
  const q = quadrant(grid_x, grid_y);

  await supabase.from("daily_checkins").upsert(
    {
      user_id: user.id,
      date,
      grid_x,
      grid_y,
      quadrant: q,
      identity_answer: body.identity_answer ?? null,
      tasks_total: body.tasks_total ?? 3,
      tasks_completed: body.tasks_completed ?? 0,
      word: body.word?.trim() || null,
      checkin_time: new Date().toISOString(),
      response_latency_sec: body.response_latency_sec ?? null,
      opened_not_completed: false,
    },
    { onConflict: "user_id,date" }
  );

  // tone_profile (αν δεν υπάρχει calibration -> quiet_continue)
  const [{ data: cal }, { data: profile }] = await Promise.all([
    supabase.from("task_calibration").select("tone_profile").eq("user_id", user.id).eq("date", date).maybeSingle(),
    supabase.from("profiles").select("identity_statement,identity_gender,within_path_stage").eq("id", user.id).maybeSingle(),
  ]);
  const tone = cal?.tone_profile ?? "quiet_continue";

  let message = TONE_FEWSHOT[tone];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const prompt = `Είσαι η φωνή του Within OS (honest companionship). Μιλάς Ελληνικά.
Ταυτότητα: ${profile?.identity_statement ?? ""}
Γένος: ${profile?.identity_gender ?? "n"} · Stage: ${profile?.within_path_stage ?? "awake"}
Σημερινό quadrant: ${q} · tone_profile: ${tone}
Παράδειγμα ύφους για αυτό το tone: "${TONE_FEWSHOT[tone]}"
Γράψε ΕΝΑ σύντομο βραδινό μήνυμα (max 45 λέξεις) σε αυτό το ύφος.
Κανόνες: ξεκίνα με παρουσία όχι παρατήρηση· χαμήλωσε τον πήχη ("δεν χρειάζεται","αρκεί","λίγο")· τελείωσε με συνέχεια όχι εντολή· συμφωνία γένους· ΟΧΙ θαυμαστικά, ΟΧΙ emojis, ΟΧΙ "πρέπει". Επέστρεψε ΜΟΝΟ το κείμενο.`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 200, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await r.json();
      const text: string = data?.content?.[0]?.text;
      if (text && text.trim()) message = text.trim();
    } catch (e) {
      console.error("[checkin] tone error", e);
    }
  }

  return NextResponse.json({ ok: true, quadrant: q, tone_profile: tone, message });
}
