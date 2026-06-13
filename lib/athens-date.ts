/** YYYY-MM-DD in Europe/Athens for the given instant. */
export function getDateStringAthens(d: Date = new Date()): string {
  return d.toLocaleString("sv-SE", { timeZone: "Europe/Athens" }).slice(0, 10);
}

/** Calendar day of month (1–31) in Athens — days elapsed in month including today. */
export function getDaysPassedInMonthAthens(d: Date = new Date()): number {
  const ymd = getDateStringAthens(d);
  return Number(ymd.split("-")[2]);
}

/** First day of current month in Athens as YYYY-MM-DD. */
export function getMonthStartDateStringAthens(d: Date = new Date()): string {
  const ymd = getDateStringAthens(d);
  const [y, m] = ymd.split("-");
  return `${y}-${m}-01`;
}

/** Seven YYYY-MM-DD strings, oldest → newest (today last), Europe/Athens calendar days. */
export function getLastSevenDatesAthens(now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const t = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(t.toLocaleString("sv-SE", { timeZone: "Europe/Athens" }).slice(0, 10));
  }
  return out;
}
