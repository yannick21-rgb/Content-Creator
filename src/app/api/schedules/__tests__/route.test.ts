import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import {
  createAuthedUser,
  cleanupTestData,
  cookieRecord,
  type Cookie,
} from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import { ACTIVE_CLIENT_COOKIE } from "@/lib/clients";

describe("GET /api/schedules (SCHD-03)", () => {
  let cookie: Cookie;
  let client: { id: string };

  beforeAll(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("schedules-test@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Schedules Test Client");
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  function authedRequest() {
    return new NextRequest("http://localhost/api/schedules", {
      headers: {
        Cookie: Object.entries({
          ...cookieRecord(cookie),
          [ACTIVE_CLIENT_COOKIE]: client.id,
        })
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
    });
  }

  it("returns empty list when no scheduled posts", async () => {
    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("requires authentication", async () => {
    const req = new NextRequest("http://localhost/api/schedules");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
