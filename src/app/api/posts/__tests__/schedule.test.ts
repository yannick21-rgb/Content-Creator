import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAuthedUser, cleanupTestData } from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import type { Cookie } from "@/test-utils/request";

describe("POST /api/posts/[id]/schedule (SCHD-01)", () => {
  let cookie: Cookie;
  let client: { id: string; name: string; userId: string };
  let postId: string;

  beforeAll(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("schedule-test@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Schedule Test Client");

    const res = await fetch("http://localhost:3000/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${cookie.name}=${cookie.value}` },
      body: JSON.stringify({ text: "Scheduled post content" }),
    });
    const post = await res.json();
    postId = post.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("rejects unauthenticated request", async () => {
    const res = await fetch(`http://localhost:3000/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: "2026-08-01 09:00", timezone: "America/New_York", socialAccountIds: [] }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects past datetime", async () => {
    const res = await fetch(`http://localhost:3000/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${cookie.name}=${cookie.value}` },
      body: JSON.stringify({ scheduledAt: "2020-01-01 00:00", timezone: "America/New_York", socialAccountIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid timezone", async () => {
    const res = await fetch(`http://localhost:3000/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${cookie.name}=${cookie.value}` },
      body: JSON.stringify({ scheduledAt: "2026-08-01 09:00", timezone: "Invalid/Zone", socialAccountIds: [] }),
    });
    expect(res.status).toBe(400);
  });
});
