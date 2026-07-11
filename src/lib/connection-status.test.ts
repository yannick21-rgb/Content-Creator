import { describe, it, expect } from "vitest";
import { statusFor } from "@/lib/connection-status";

const DAY = 24 * 60 * 60 * 1000;

describe("connection status (CONN-04)", () => {
  it("flags reconnect_required when expires within 7 days", () => {
    const expiresAt = new Date(Date.now() + 3 * DAY);
    expect(statusFor(expiresAt)).toBe("reconnect_required");
  });

  it("flags connected when expires beyond 7 days", () => {
    const expiresAt = new Date(Date.now() + 10 * DAY);
    expect(statusFor(expiresAt)).toBe("connected");
  });

  it("flags reconnect_required at exactly the 7-day threshold", () => {
    const expiresAt = new Date(Date.now() + 7 * DAY);
    expect(statusFor(expiresAt)).toBe("reconnect_required");
  });

  it("flags reconnect_required when null/expired", () => {
    expect(statusFor(null)).toBe("reconnect_required");
    expect(statusFor(new Date(Date.now() - DAY))).toBe("reconnect_required");
  });
});
