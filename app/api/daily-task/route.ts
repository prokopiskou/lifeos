import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DailyTaskResponse = {
  title: string;
  description: string;
  why: string;
  stage: string;
};

function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // Handle ```json ... ``` responses.
  const withoutFences = trimmed.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  // Try direct parse first.
  try {
    return JSON.parse(withoutFences);
  } catch {
    // Continue with extraction.
  }

  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model did not return a JSON object.");
  }

  const jsonSlice = withoutFences.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonSlice);
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[api/daily-task] Missing ANTHROPIC_API_KEY");
    return NextResponse.json(
      { error: "Missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[api/daily-task] unauthenticated request");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bodyTyped = body as {
    answers?: unknown;
    weekNumber?: unknown;
    dayNumber?: unknown;
    weekTheme?: unknown;
    microChallenge?: unknown;
  };

  const answers = bodyTyped.answers;
  if (!Array.isArray(answers) || answers.length !== 5) {
    return NextResponse.json(
      { error: "`answers` must be an array of 5 strings" },
      { status: 400 }
    );
  }

  const fiveAnswers = answers;
  if (!fiveAnswers.every((a) => typeof a === "string" && a.trim().length > 0)) {
    return NextResponse.json(
      { error: "`answers` must contain 5 non-empty strings" },
      { status: 400 }
    );
  }

  const weekNumber =
    typeof bodyTyped.weekNumber === "number" ? bodyTyped.weekNumber : 1;
  const dayNumber = typeof bodyTyped.dayNumber === "number" ? bodyTyped.dayNumber : 1;
  const weekTheme =
    typeof bodyTyped.weekTheme === "string" ? bodyTyped.weekTheme : "Week 1";
  const microChallenge =
    typeof bodyTyped.microChallenge === "string"
      ? bodyTyped.microChallenge
      : "Κάνε ένα μικρό βήμα 5 λεπτών.";

  console.log("[api/daily-task] payload received", {
    answersCount: fiveAnswers.length,
    weekNumber,
    dayNumber,
    hasWeekTheme: Boolean(weekTheme),
    hasMicroChallenge: Boolean(microChallenge),
  });

  const systemPrompt = `You are the Life OS assistant for WithinSuccess, a Greek personal development platform.
Based on the user's onboarding answers, current week theme, day number, and a given weekly micro-challenge, generate ONE specific daily task in Greek.
The task must be:
- Concrete and actionable (not vague advice)
- Completable in 5-15 minutes
- Connected to the Within Path framework (stages: Awake, Pause, Remember, Align, Embody)
- Written in warm but direct Greek
- Format: Task title (short, max 6 words) + 2-3 sentence description + why it matters today

Return JSON only: { title: string, description: string, why: string, stage: string }`;

  const userPrompt =
    "Ο χρήστης απάντησε στα παρακάτω:\n\n" +
    `Q1: ${fiveAnswers[0]}\n` +
    `Q2: ${fiveAnswers[1]}\n` +
    `Q3: ${fiveAnswers[2]}\n` +
    `Q4: ${fiveAnswers[3]}\n` +
    `Q5: ${fiveAnswers[4]}\n\n` +
    `Week: ${weekNumber}\n` +
    `Day: ${dayNumber}\n` +
    `Week Theme: ${weekTheme}\n` +
    `Micro-challenge from playbook: ${microChallenge}\n\n` +
    "Δημιούργησε μία καθημερινή εργασία σύμφωνα με τις οδηγίες. Επιστρέψε ΜΟΝΟ JSON.";

  const todayDate = new Date().toISOString().slice(0, 10);

  // 1) Check cache in daily_tasks
  const { data: cachedRows, error: cacheError } = await supabase
    .from("daily_tasks")
    .select("title, description, why, stage, week_number, task_date")
    .eq("user_id", user.id)
    .eq("task_date", todayDate)
    .eq("week_number", weekNumber)
    .limit(1);

  if (!cacheError && Array.isArray(cachedRows) && cachedRows.length > 0) {
    const cached = cachedRows[0];
    if (
      typeof cached.title === "string" &&
      typeof cached.description === "string" &&
      typeof cached.why === "string" &&
      typeof cached.stage === "string"
    ) {
      console.log("[api/daily-task] cache hit", {
        userId: user.id,
        date: todayDate,
        weekNumber,
        title: cached.title,
      });
      const dailyTask: DailyTaskResponse = {
        title: cached.title,
        description: cached.description,
        why: cached.why,
        stage: cached.stage,
      };
      return NextResponse.json(dailyTask);
    }
  }

  console.log("[api/daily-task] cache miss, calling Anthropic", {
    userId: user.id,
    date: todayDate,
    weekNumber,
  });

  const anthropicController = new AbortController();
  const anthropicTimeoutId = setTimeout(() => anthropicController.abort(), 30000);

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
        max_tokens: 600,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: userPrompt }],
          },
        ],
      }),
      signal: anthropicController.signal,
    });
  } catch (e: unknown) {
    clearTimeout(anthropicTimeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      console.error("[api/daily-task] Anthropic request timeout");
      return NextResponse.json(
        { error: "Anthropic request timed out" },
        { status: 504 }
      );
    }
    console.error("[api/daily-task] Anthropic fetch error", e);
    return NextResponse.json(
      { error: "Anthropic request failed before response" },
      { status: 502 }
    );
  } finally {
    clearTimeout(anthropicTimeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[api/daily-task] Anthropic non-OK", {
      status: response.status,
      body: text,
    });
    return NextResponse.json(
      { error: "Anthropic request failed", details: text || undefined },
      { status: 502 }
    );
  }

  const data: any = await response.json();
  const modelText = data?.content?.[0]?.text;
  if (typeof modelText !== "string") {
    console.error("[api/daily-task] Missing text content in Anthropic response");
    return NextResponse.json(
      { error: "Anthropic response missing text content" },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = extractJson(modelText);
  } catch (e: unknown) {
    console.error("[api/daily-task] Failed to parse model JSON", e);
    return NextResponse.json(
      { error: "Failed to parse model JSON", details: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  const result = parsed as Partial<DailyTaskResponse>;
  if (
    !result ||
    typeof result.title !== "string" ||
    typeof result.description !== "string" ||
    typeof result.why !== "string" ||
    typeof result.stage !== "string"
  ) {
    console.error("[api/daily-task] Model JSON shape mismatch", { result });
    return NextResponse.json(
      { error: "Model JSON did not match expected shape" },
      { status: 502 }
    );
  }

  const dailyTask: DailyTaskResponse = {
    title: result.title,
    description: result.description,
    why: result.why,
    stage: result.stage,
  };

  // Store in cache
  const { error: insertError } = await supabase.from("daily_tasks").insert({
    user_id: user.id,
    task_date: todayDate,
    title: dailyTask.title,
    description: dailyTask.description,
    why: dailyTask.why,
    stage: dailyTask.stage,
    week_number: weekNumber,
  });

  if (insertError) {
    console.error("[api/daily-task] failed to cache daily task", insertError);
  }

  console.log("[api/daily-task] success", {
    title: dailyTask.title,
    stage: dailyTask.stage,
  });
  return NextResponse.json(dailyTask);
}

