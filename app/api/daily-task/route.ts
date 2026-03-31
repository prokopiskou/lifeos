import { NextResponse } from "next/server";

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
    return NextResponse.json(
      { error: "Missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const answers = (body as { answers?: unknown }).answers;
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

  const systemPrompt = `You are the Life OS assistant for WithinSuccess, a Greek personal development platform. 
Based on the user's onboarding answers, generate ONE specific daily task in Greek.
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
    "Δημιούργησε μία καθημερινή εργασία σύμφωνα με τις οδηγίες. Επιστρέψε ΜΟΝΟ JSON.";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return NextResponse.json(
      { error: "Anthropic request failed", details: text || undefined },
      { status: 502 }
    );
  }

  const data: any = await response.json();
  const modelText = data?.content?.[0]?.text;
  if (typeof modelText !== "string") {
    return NextResponse.json(
      { error: "Anthropic response missing text content" },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = extractJson(modelText);
  } catch (e: unknown) {
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

  return NextResponse.json(dailyTask);
}

