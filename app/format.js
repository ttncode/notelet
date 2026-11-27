// Notes on iPhone shows 24-hour times and day/month dates, whatever the browser's language.
const LOCALE = "en-GB";

export function formatRowDate(timestamp, now) {
  const date = new Date(timestamp);
  if (date.toDateString() === new Date(now).toDateString()) return date.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return date.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const formatEditedDate = (timestamp) => new Date(timestamp).toLocaleString(LOCALE, { dateStyle: "long", timeStyle: "short", hourCycle: "h23" });

export const formatDayMonth = (utcTimestamp) => new Date(utcTimestamp).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export const formatMonth = (month) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });
