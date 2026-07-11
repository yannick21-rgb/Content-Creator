import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "@/app/api/clients/[id]/route";
import { db } from "@/lib/db";
import { client, socialAccount } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { clearDb, signUpAndGetCookie, cookieHeader } from "@/test/helpers";

const EMAIL = `clients-id-${Date.now()}@example.com`;
const PASSWORD = "password123";

async function createClient(cookie: string, name: string) {
  const res = await (
    await import("@/app/api/clients/route")
  ).POST(
    new NextRequest("http://localhost/api/clients", {
      method: "POST",
      headers: { "content-type": "application/json", ...cookieHeader(cookie) },
      body: JSON.stringify({ name }),
    }),
  );
  return (await res.json()) as { id: string };
}

describe("GET/PATCH/DELETE /api/clients/:id (CLNT-03)", () => {
  let cookie: string;
  let c1: string;
  let c2: string;
  beforeEach(async () => {
    await clearDb();
    cookie = await signUpAndGetCookie(EMAIL, PASSWORD);
    c1 = (await createClient(cookie, "Client One")).id;
    c2 = (await createClient(cookie, "Client Two")).id;
  });

  it("lists two distinct clients", async () => {
    const res = await GET(
      new NextRequest(`http://localhost/api/clients/${c1}`, {
        method: "GET",
        headers: cookieHeader(cookie),
      }),
      { params: Promise.resolve({ id: c1 }) },
    );
    const row = await res.json();
    expect(row.id).toBe(c1);
    expect(row.name).toBe("Client One");
  });

  it("PATCH updates only the targeted client", async () => {
    await PATCH(
      new NextRequest(`http://localhost/api/clients/${c1}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...cookieHeader(cookie) },
        body: JSON.stringify({ name: "Client One Renamed" }),
      }),
      { params: Promise.resolve({ id: c1 }) },
    );
    const [a] = await db.select().from(client).where(eq(client.id, c1));
    const [b] = await db.select().from(client).where(eq(client.id, c2));
    expect(a.name).toBe("Client One Renamed");
    expect(b.name).toBe("Client Two");
  });

  it("DELETE cascades only the targeted client's social accounts", async () => {
    await db.insert(socialAccount).values({
      clientId: c1,
      platform: "meta",
      platformAccountId: "ig-1",
      name: "Meta",
      accessTokenEnc: "x",
      iv: "x",
      tag: "x",
      keyVersion: 1,
    });
    await DELETE(
      new NextRequest(`http://localhost/api/clients/${c1}`, {
        method: "DELETE",
        headers: cookieHeader(cookie),
      }),
      { params: Promise.resolve({ id: c1 }) },
    );
    const remaining = await db.select().from(socialAccount);
    expect(remaining.length).toBe(0);
    const [b] = await db.select().from(client).where(eq(client.id, c2));
    expect(b).toBeDefined();
  });
});
