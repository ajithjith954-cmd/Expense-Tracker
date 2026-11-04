export function formatMonth(month: string): string {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, 1);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date);
}

export function formatShortMonth(month: string): string {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, 1);
  return new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date);
}

export function formatDay(value: string): string {
  const [yearText, monthText, dayText] = value.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatClock(value: string | null): string | null {
  if (!value) return null;
  const [hourText, minuteText] = value.split(":");
  const date = new Date(2026, 0, 1, Number(hourText), Number(minuteText));
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
}
