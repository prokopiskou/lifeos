/** `topPercent` from get_community_top_percent(): 1 = top 1%, 100 = bottom band. */
export function getCommunityRankSubtext(topPercent: number): string {
  if (topPercent <= 5) {
    return "Βρίσκεσαι στους κορυφαίους — συνέχισε!";
  }
  if (topPercent <= 15) {
    return "Εξαιρετική θέση στην κοινότητα.";
  }
  if (topPercent <= 35) {
    return "Πολύ δυνατή παρουσία. Συνέχισε!";
  }
  if (topPercent <= 55) {
    return "Καλή πρόοδος — κάθε μέρα μετράει.";
  }
  return "Κράτα τον ρυθμό σου — η συνέπεια κάνει τη διαφορά.";
}
