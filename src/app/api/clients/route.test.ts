import { describe, it, expect, beforeEach } from "vitest";
import { POST, GET } from "./route";
import { createAuthedUser, cleanupTestData, jsonRequest, cookieRecord } from "@/test-utils/request";

const BASE = "http://localhost/api/clients";

describe("POST /api/clients (CLNT-01)", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("creates a client owned by the authenticated user", async () => {
    const { cookie, userId } = await createAuthedUser("clients-owner@example.com");
    const res = await POST(
      jsonRequest(BASE, { name: "Acme" }, cookieRecord(cookie)),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Acme");
    expect(body.userId).toBe(userId);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await POST(jsonRequest(BASE, { name: "Acme" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/clients (CLNT-01)", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("returns only the authenticated user's clients", async () => {
    const { cookie } = await createAuthedUser("list-owner@example.com");
    await POST(jsonRequest(BASE, { name: "Acme" }, cookieRecord(cookie)));

    const res = await GET(
      jsonRequest(BASE, {}, cookieRecord(cookie)),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].name).toBe("Acme");
    // Connection summary is present and starts at zero.
    expect(body[0].connected_count).toBe(0);
    expect(body[0].reconnect_required_count).toBe(0);
  });

  it("rejects an unauthenticated GET with 401", async () => {
    const res = await GET(jsonRequest(BASE, {}));
    expect(res.status).toBe(401);
  });
});
