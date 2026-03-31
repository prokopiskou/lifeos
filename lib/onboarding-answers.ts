/**
 * Normalizes `answers` from DB (jsonb) — sometimes parsed as string or loosely typed.
 */
export function normalizeOnboardingAnswers(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    if (
      raw.length === 5 &&
      raw.every((a) => typeof a === "string" && String(a).trim().length > 0)
    ) {
      return raw.map((a) => String(a).trim());
    }
    return null;
  }

  if (typeof raw === "string") {
    try {
      return normalizeOnboardingAnswers(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  return null;
}
