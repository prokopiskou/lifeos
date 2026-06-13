/** Whether `date` is a Sunday in Europe/Athens (calendar day). */
export function isSundayInAthens(date: Date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Athens",
    weekday: "long",
  }).format(date);
  return weekday === "Sunday";
}
