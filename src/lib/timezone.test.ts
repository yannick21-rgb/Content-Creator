import { describe, it, expect } from "vitest";
import { localToUtc, isValidTimezone, formatInTimezone } from "./timezone";

describe("timezone utilities (SCHD-04)", () => {
  it("converts America/New_York 09:00 to 13:00 UTC", () => {
    const result = localToUtc("2026-08-01 09:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-08-01T13:00:00.000Z");
  });

  it("converts America/Los_Angeles 09:00 to 16:00 UTC", () => {
    const result = localToUtc("2026-08-01 09:00", "America/Los_Angeles");
    expect(result.toISOString()).toBe("2026-08-01T16:00:00.000Z");
  });

  it("validates valid IANA timezone", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
  });

  it("rejects invalid IANA timezone", () => {
    expect(isValidTimezone("Invalid/Zone")).toBe(false);
  });

  it("formats date in timezone", () => {
    const date = new Date("2026-08-01T13:00:00.000Z");
    const formatted = formatInTimezone(date, "America/New_York");
    expect(formatted).toContain("Aug 1");
  });
});
