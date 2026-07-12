import { z } from "zod";

export function getTimezoneList(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z.string().refine(isValidTimezone, {
  message: "Invalid IANA timezone identifier",
});

export function localToUtc(localStr: string, timezone: string): Date {
  const normalized = localStr.includes("T") ? localStr : localStr.replace(" ", "T") + ":00";
  const utcCandidate = new Date(normalized + "Z");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });
  const parts = formatter.formatToParts(utcCandidate);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC";
  const offsetMinutes = parseOffsetToMinutes(offsetPart);
  return new Date(utcCandidate.getTime() - offsetMinutes * 60 * 1000);
}

function parseOffsetToMinutes(offset: string): number {
  if (offset === "UTC" || offset === "GMT" || !offset) return 0;
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  return sign * (hours * 60 + minutes);
}

export function formatInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
