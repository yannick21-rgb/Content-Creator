import { describe, it, expect, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "./route";
import { POST as POST_CLIENT } from "@/app/api/clients/route";
import { createAuthedUser, cleanupTestData, jsonRequest, SESSION_COOKIE } from "@/test-utils/request";
import { db } from "@/lib/db";
import { client, socialAccount } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const BASE = "http://localhost/api/clients";

async function createClient(cookie: string, name: string) {
  const res = await POST_CLIENT(jsonRequest(BASE, { name }, { [SESSION_COOKIE]: cookie }));
  return (await res.json()) as { id: string };
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
      jsonRequest(`${BASE}/${a.id}`, { name: "Client A renamed" }, {
        [SESSION_COOKIE]: cookie,
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Client A renamed");

    const bRes = await GET(
      jsonRequest(`${BASE}/${b.id}`, {}, { [SESSION_COOKIE]: cookie }),
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
      jsonRequest(`${BASE}/${a.id}`, {}, { [SESSION_COOKIE]: cookie }),
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
