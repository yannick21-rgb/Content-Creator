import { describe, it, expect } from "vitest";
import { statusFor } from "@/lib/connection-status";

const DAY = 24 * 60 * 60 * 1000;

describe("connection-status (CONN-04)", () => {
  it("flags reconnect_required when expiring in 3 days", () => {
    expect(statusFor(new Date(Date.now() + 3 * DAY))).toBe("reconnect_required");
  });

  it("flags connected when expiring in 10 days", () => {
    expect(statusFor(new Date(Date.now() + 10 * DAY))).toBe("connected");
  });

  it("flags reconnect_required at exactly the 7-day threshold", () => {
    expect(statusFor(new Date(Date.now() + 7 * DAY))).toBe("reconnect_required");
  });

  it("flags reconnect_required when expired", () => {
    expect(statusFor(new Date(Date.now() - DAY))).toBe("reconnect_required");
  });

  it("flags reconnect_required when expiresAt is null", () => {
    expect(statusFor(null)).toBe("reconnect_required");
  });
});
