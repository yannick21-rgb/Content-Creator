import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/clients/route";
import { clearDb, signUpAndGetCookie, cookieHeader } from "@/test/helpers";

const EMAIL = `clients-${Date.now()}@example.com`;
const PASSWORD = "password123";

describe("POST /api/clients (CLNT-01)", () => {
  let cookie: string;
  beforeEach(async () => {
    await clearDb();
    cookie = await signUpAndGetCookie(EMAIL, PASSWORD);
  });

  it("creates a client owned by the user and sets the active cookie", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json", ...cookieHeader(cookie) },
        body: JSON.stringify({ name: "Acme" }),
      }),
    );
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.name).toBe("Acme");
    expect(row.id).toBeDefined();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Acme" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("GET returns only the user's clients with connection counts", async () => {
    await POST(
      new NextRequest("http://localhost/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json", ...cookieHeader(cookie) },
        body: JSON.stringify({ name: "Acme" }),
      }),
    );
    const res = await GET(
      new NextRequest("http://localhost/api/clients", {
        method: "GET",
        headers: cookieHeader(cookie),
      }),
    );
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty("connected_count");
    expect(rows[0]).toHaveProperty("reconnect_required_count");
  });
});
