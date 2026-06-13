import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COACH_SYSTEM = `You are Prokopis Koukis, Greek personal development coach.
Someone doesn't feel like doing their daily task today.
Their task is: [currentTask title and description]
Create a MICRO version of this exact task that takes maximum 30 seconds.
Something so small they can't say no.
Example: if task is 'write 3 things you know about yourself' → micro version is 'write just 1 word that describes you today'
2-3 sentences max. Greek only. Warm, zero judgment. End with the micro task clearly stated.`;

const JSON_OUTPUT_RULE = `
Respond ONLY with valid JSON (no markdown, no code fences):
{"leadIn":"<warm sentences in Greek (what you say before the action — do not repeat microTask here)>","microTask":"<only the micro task: one short, clear line in Greek>"}`;

const FALLBACK = {
  leadIn:
    "Σήμερα δεν χρειάζεται να δώσεις 100%. Ένα μικρό βήμα μετράει περισσότερο από το τίποτα.",
  microTask: "Κλείσε τα μάτια για 20 δευτερόλεπτα και πες στον εαυτό σου μία λέξη συμπάθειας.",
};

function parseJsonPayload(raw: string): { leadIn: string; microTask: string } | null {
  const trimmed = raw.trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(withoutFences) as {
      leadIn?: unknown;
      microTask?: unknown;
    };
    const leadIn =
      typeof parsed.leadIn === "string" ? parsed.leadIn.trim() : "";
    const microTask =
      typeof parsed.microTask === "string" ? parsed.microTask.trim() : "";
    if (leadIn && microTask) {
      return { leadIn, microTask };
    }
  } catch {
    // fall through
  }
  return null;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const typed = body as {
    weekTheme?: unknown;
    currentTask?: unknown;
    currentWeek?: unknown;
    onboardingAnswers?: unknown;
  };

  const weekTheme =
    typeof typed.weekTheme === "string" ? typed.weekTheme.trim() : "";
  const currentWeek =
    typeof typed.currentWeek === "number" && Number.isFinite(typed.currentWeek)
      ? typed.currentWeek
      : 1;

  const taskObj = typed.currentTask as { title?: unknown; description?: unknown } | null;
  const title =
    taskObj && typeof taskObj.title === "string" ? taskObj.title.trim() : "";
  const description =
    taskObj && typeof taskObj.description === "string"
      ? taskObj.description.trim()
      : "";

  const onboardingAnswers = typed.onboardingAnswers;
  const answersOk =
    Array.isArray(onboardingAnswers) &&
    onboardingAnswers.length === 5 &&
    onboardingAnswers.every((a) => typeof a === "string" && a.trim().length > 0);

  if (!title || !description || !answersOk) {
    return NextResponse.json(FALLBACK);
  }

  const currentTaskSummary = `${title}. ${description}`;
  const challengeSummary = (onboardingAnswers as string[])
    .map((a, i) => `${i + 1}) ${String(a).trim()}`)
    .join(" ");

  const userMessage = `Week theme: ${weekTheme || "—"}. Week number: ${currentWeek}.
Onboarding context: ${challengeSummary}

Their full daily task (title + description):
${currentTaskSummary}

The micro version must relate directly to this task. Output JSON only.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(FALLBACK);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system:
          COACH_SYSTEM.replace(
            "[currentTask title and description]",
            currentTaskSummary
          ) + JSON_OUTPUT_RULE,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: userMessage }],
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      console.error("[api/skip-day] Anthropic timeout");
    } else {
      console.error("[api/skip-day] Anthropic fetch error", e);
    }
    return NextResponse.json(FALLBACK);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[api/skip-day] Anthropic non-OK", response.status, text);
    return NextResponse.json(FALLBACK);
  }

  const data: { content?: Array<{ text?: string }> } = await response.json();
  const text = data?.content?.[0]?.text;
  const raw = typeof text === "string" ? text.trim() : "";

  const parsed = raw ? parseJsonPayload(raw) : null;
  if (parsed) {
    return NextResponse.json(parsed);
  }

  console.log("[api/skip-day] parse failed, using fallback");
  return NextResponse.json(FALLBACK);
}
