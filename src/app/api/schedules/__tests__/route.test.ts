import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAuthedUser, cleanupTestData } from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import type { Cookie } from "@/test-utils/request";

describe("GET /api/schedules (SCHD-03)", () => {
  let cookie: Cookie;
  let client: { id: string; name: string; userId: string };

  beforeAll(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("schedules-test@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Schedules Test Client");
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("returns empty list when no scheduled posts", async () => {
    const res = await fetch("http://localhost:3000/api/schedules", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("requires authentication", async () => {
    const res = await fetch("http://localhost:3000/api/schedules");
    expect(res.status).toBe(401);
  });
});
