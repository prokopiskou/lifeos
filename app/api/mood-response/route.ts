import { NextResponse } from "next/server";

import { MOOD_RESPONSE_FALLBACK_MESSAGE } from "@/lib/mood-response-fallback";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are Prokopis Koukis, founder of WithinSuccess — a Greek personal development coach. 
Your style: short, direct, warm, no clichés, no motivation-speak. 
Like a trusted friend who tells the truth with love.
Max 2-3 sentences. Always in Greek. Never generic.`;

export async function POST(req: Request) {
  console.log("[api/mood-response] step: POST received");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("[api/mood-response] step: no session → 401");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  console.log("[api/mood-response] step: user ok", user.id);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.log("[api/mood-response] step: invalid JSON → fallback message");
    return NextResponse.json({ message: MOOD_RESPONSE_FALLBACK_MESSAGE });
  }

  const typed = body as {
    mood?: unknown;
    weekTheme?: unknown;
    currentWeek?: unknown;
    onboardingAnswers?: unknown;
  };

  const mood = typeof typed.mood === "string" ? typed.mood.trim() : "";
  const weekTheme = typeof typed.weekTheme === "string" ? typed.weekTheme.trim() : "";
  const currentWeek =
    typeof typed.currentWeek === "number" && Number.isFinite(typed.currentWeek)
      ? typed.currentWeek
      : 1;

  const onboardingAnswers = typed.onboardingAnswers;
  const answersOk =
    Array.isArray(onboardingAnswers) &&
    onboardingAnswers.length === 5 &&
    onboardingAnswers.every((a) => typeof a === "string" && a.trim().length > 0);

  if (!mood || !answersOk) {
    console.log("[api/mood-response] step: validation soft-fail → fallback message", {
      hasMood: Boolean(mood),
      answersOk,
    });
    return NextResponse.json({ message: MOOD_RESPONSE_FALLBACK_MESSAGE });
  }

  const challengeSummary = onboardingAnswers
    .map((a, i) => `${i + 1}) ${String(a).trim()}`)
    .join(" ");

  const userMessage = `The user feels ${mood} today. They are on week ${currentWeek} of their journey, theme: ${weekTheme || "—"}. Their main challenge is reflected in their onboarding answers: ${challengeSummary}. Give them a real, human response for this morning.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[api/mood-response] step: no ANTHROPIC_API_KEY → fallback message");
    return NextResponse.json({ message: MOOD_RESPONSE_FALLBACK_MESSAGE });
  }

  const anthropicController = new AbortController();
  const anthropicTimeoutId = setTimeout(() => anthropicController.abort(), 30000);

  let response: Response;
  try {
    console.log("[api/mood-response] step: calling Anthropic");
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 320,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: userMessage }],
          },
        ],
      }),
      signal: anthropicController.signal,
    });
  } catch (e: unknown) {
    clearTimeout(anthropicTimeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      console.log("[api/mood-response] step: Anthropic timeout → fallback");
    } else {
      console.error("[api/mood-response] step: Anthropic fetch error", e);
    }
    return NextResponse.json({ message: MOOD_RESPONSE_FALLBACK_MESSAGE });
  } finally {
    clearTimeout(anthropicTimeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[api/mood-response] step: Anthropic non-OK", response.status, text);
    return NextResponse.json({ message: MOOD_RESPONSE_FALLBACK_MESSAGE });
  }

  const data: { content?: Array<{ text?: string }> } = await response.json();
  const text = data?.content?.[0]?.text;
  const message = typeof text === "string" ? text.trim() : "";

  if (!message) {
    console.log("[api/mood-response] step: empty model text → fallback");
    return NextResponse.json({ message: MOOD_RESPONSE_FALLBACK_MESSAGE });
  }

  console.log("[api/mood-response] step: success, message length", message.length);
  return NextResponse.json({ message });
}
