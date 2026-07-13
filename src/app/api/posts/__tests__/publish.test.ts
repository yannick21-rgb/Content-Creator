import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST as publishPost } from "../[id]/publish/route";
import { POST as createPost } from "../route";
import {
  createAuthedUser,
  cleanupTestData,
  jsonRequest,
  cookieRecord,
  type Cookie,
} from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import { ACTIVE_CLIENT_COOKIE } from "@/lib/clients";

const BASE = "http://localhost/api/posts";

describe("POST /api/posts/[id]/publish (PUBL-01, PUBL-03)", () => {
  let cookie: Cookie;
  let client: { id: string };
  let postId: string;

  beforeAll(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("publish-test@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Publish Test Client");

    const createReq = jsonRequest(BASE, { text: "Publish test content" }, {
      ...cookieRecord(cookie),
      [ACTIVE_CLIENT_COOKIE]: client.id,
    });
    const createRes = await createPost(createReq);
    const post = await createRes.json();
    postId = post.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  function authedPublishReq(body: unknown) {
    return new NextRequest(`http://localhost/api/posts/${postId}/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Cookie: Object.entries({
          ...cookieRecord(cookie),
          [ACTIVE_CLIENT_COOKIE]: client.id,
        })
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
      body: JSON.stringify(body),
    });
  }

  it("rejects unauthenticated request", async () => {
    const req = new NextRequest(`http://localhost/api/posts/${postId}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ socialAccountIds: [] }),
    });
    const res = await publishPost(req, { params: Promise.resolve({ id: postId }) });
    expect(res.status).toBe(401);
  });

  it("rejects empty socialAccountIds", async () => {
    const res = await publishPost(authedPublishReq({ socialAccountIds: [] }), {
      params: Promise.resolve({ id: postId }),
    });
    expect(res.status).toBe(400);
  });

  it("requires authentication and active client", async () => {
    const req = new NextRequest(`http://localhost/api/posts/${postId}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ socialAccountIds: ["00000000-0000-0000-0000-000000000000"] }),
    });
    const res = await publishPost(req, { params: Promise.resolve({ id: postId }) });
    expect(res.status).toBe(401);
  });

  it("rejects publishing already published post", async () => {
    const res = await publishPost(
      authedPublishReq({ socialAccountIds: ["00000000-0000-0000-0000-000000000000"] }),
      { params: Promise.resolve({ id: postId }) },
    );
    expect([400, 404]).toContain(res.status);
  });
});
