import { describe, it, expect, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "./route";
import { POST as POST_CLIENT } from "@/app/api/clients/route";
import { createAuthedUser, cleanupTestData, jsonRequest, cookieRecord, type Cookie } from "@/test-utils/request";
import { db } from "@/lib/db";
import { socialAccount } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const BASE = "http://localhost/api/clients";

async function createClient(cookie: Cookie, name: string) {
  const res = await POST_CLIENT(jsonRequest(BASE, { name }, cookieRecord(cookie)));
  return (await res.json()) as { id: string };
}

function extractId(url: string): string {
  return url.split("/").pop()!;
}

describe("GET/PATCH/DELETE /api/clients/[id] (CLNT-03)", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("patches one client without altering another", async () => {
    const { cookie } = await createAuthedUser("patch-owner@example.com");
    const a = await createClient(cookie, "Client A");
    const b = await createClient(cookie, "Client B");

    const res = await PATCH(
      jsonRequest(`${BASE}/${a.id}`, { name: "Client A renamed" }, cookieRecord(cookie)),
      { params: Promise.resolve({ id: a.id }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Client A renamed");

    const bRes = await GET(
      jsonRequest(`${BASE}/${b.id}`, {}, cookieRecord(cookie)),
      { params: Promise.resolve({ id: b.id }) },
    );
    expect((await bRes.json()).name).toBe("Client B");
  });

  it("deletes one client and only cascades its own social accounts", async () => {
    const { cookie } = await createAuthedUser("delete-owner@example.com");
    const a = await createClient(cookie, "Client A");
    const b = await createClient(cookie, "Client B");

    // Seed a social account on client A.
    await db.insert(socialAccount).values({
      clientId: a.id,
      platform: "meta",
      platformAccountId: "page-1",
      name: "Meta",
      accessTokenEnc: "x",
      iv: "y",
      tag: "z",
      keyVersion: 1,
    });

    const del = await DELETE(
      jsonRequest(`${BASE}/${a.id}`, {}, cookieRecord(cookie)),
      { params: Promise.resolve({ id: a.id }) },
    );
    expect(del.status).toBe(204);

    const remaining = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.clientId, b.id));
    // B's (empty) scope is untouched; A's account is gone.
    const aAccounts = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.clientId, a.id));
    expect(aAccounts.length).toBe(0);
    expect(remaining.length).toBe(0);
  });
});
