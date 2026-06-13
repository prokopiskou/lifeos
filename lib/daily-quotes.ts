/** One quote per calendar day of week: index 0 = Sunday … 6 = Saturday (matches Date#getDay()). */
export const DAILY_QUOTES: string[] = [
  "Η αλλαγή δεν ξεκινά με μια μεγάλη απόφαση. Ξεκινά με μια μικρή πράξη.",
  "Δεν χρειάζεσαι να νιώσεις έτοιμος. Χρειάζεσαι να ξεκινήσεις.",
  "Ο φόβος δεν φεύγει. Απλώς σταματάς να τον ακούς.",
  "Κάθε μέρα που εκτελείς, χτίζεις εμπιστοσύνη στον εαυτό σου.",
  "Η πρώτη σκέψη λέει όχι. Η δεύτερη πράξη λέει ναι.",
  "Δεν αλλάζεις τη ζωή σου. Αλλάζεις τον εαυτό σου.",
  "Μικρές νίκες. Κάθε μέρα. Αυτό είναι όλο.",
];

export function getQuoteForDate(d: Date): string {
  const day = d.getDay();
  return DAILY_QUOTES[day] ?? DAILY_QUOTES[0];
}
