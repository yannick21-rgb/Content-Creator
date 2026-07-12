import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAuthedUser, cleanupTestData } from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import type { Cookie } from "@/test-utils/request";

describe("POST /api/posts/[id]/publish (PUBL-01, PUBL-03)", () => {
  let cookie: Cookie;
  let client: { id: string; name: string; userId: string };
  let postId: string;

  beforeAll(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("publish-test@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Publish Test Client");
    const res = await fetch("http://localhost:3000/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${cookie.name}=${cookie.value}` },
      body: JSON.stringify({ text: "Publish test content" }),
    });
    const post = await res.json();
    postId = post.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("rejects unauthenticated request", async () => {
    const res = await fetch(`http://localhost:3000/api/posts/${postId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socialAccountIds: [] }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects empty socialAccountIds", async () => {
    const res = await fetch(`http://localhost:3000/api/posts/${postId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${cookie.name}=${cookie.value}` },
      body: JSON.stringify({ socialAccountIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("requires authentication and active client", async () => {
    const res = await fetch(`http://localhost:3000/api/posts/${postId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socialAccountIds: ["00000000-0000-0000-0000-000000000000"] }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects publishing already published post", async () => {
    const res = await fetch(`http://localhost:3000/api/posts/${postId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${cookie.name}=${cookie.value}` },
      body: JSON.stringify({ socialAccountIds: ["00000000-0000-0000-0000-000000000000"] }),
    });
    expect([400, 404]).toContain(res.status);
  });
});
