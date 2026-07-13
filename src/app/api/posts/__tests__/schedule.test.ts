import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST as schedulePost } from "../[id]/schedule/route";
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

describe("POST /api/posts/[id]/schedule (SCHD-01)", () => {
  let cookie: Cookie;
  let client: { id: string };
  let postId: string;

  beforeAll(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("schedule-test@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Schedule Test Client");

    const createReq = jsonRequest(BASE, { text: "Scheduled post content" }, {
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

  function authedScheduleReq(body: unknown) {
    return new NextRequest(`http://localhost/api/posts/${postId}/schedule`, {
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
    const req = new NextRequest(`http://localhost/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scheduledAt: "2026-08-01 09:00",
        timezone: "America/New_York",
        socialAccountIds: [],
      }),
    });
    const res = await schedulePost(req, { params: Promise.resolve({ id: postId }) });
    expect(res.status).toBe(401);
  });

  it("rejects past datetime", async () => {
    const res = await schedulePost(
      authedScheduleReq({
        scheduledAt: "2020-01-01 00:00",
        timezone: "America/New_York",
        socialAccountIds: [],
      }),
      { params: Promise.resolve({ id: postId }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid timezone", async () => {
    const res = await schedulePost(
      authedScheduleReq({
        scheduledAt: "2026-08-01 09:00",
        timezone: "Invalid/Zone",
        socialAccountIds: [],
      }),
      { params: Promise.resolve({ id: postId }) },
    );
    expect(res.status).toBe(400);
  });
});
