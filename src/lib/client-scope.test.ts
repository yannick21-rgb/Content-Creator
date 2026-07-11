import { describe, it, expect, beforeEach } from "vitest";
import { createAuthedUser, createClientFor, cleanupTestData } from "@/test-utils/clients-helper";
import { listConnections } from "@/lib/clients";
import { db } from "@/lib/db";
import { socialAccount } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("client isolation (CLNT-02)", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("a request scoped to client Y returns no rows for client X's account", async () => {
    const { cookie } = await createAuthedUser("scope-owner@example.com");
    const x = await createClientFor(cookie, "Client X");
    const y = await createClientFor(cookie, "Client Y");

    await db.insert(socialAccount).values({
      clientId: x.id,
      platform: "meta",
      platformAccountId: "page-x",
      name: "Meta X",
      accessTokenEnc: "enc",
      iv: "iv",
      tag: "tag",
      keyVersion: 1,
    });

    const xRows = await listConnections(x.id);
    const yRows = await listConnections(y.id);
    expect(xRows.length).toBe(1);
    expect(yRows.length).toBe(0); // hard server-side scoping
  });

  it("rejects a social account without a valid client (FK)", async () => {
    await expect(
      db.insert(socialAccount).values({
        clientId: "00000000-0000-0000-0000-000000000000",
        platform: "meta",
        platformAccountId: "page-orphan",
        name: "Orphan",
        accessTokenEnc: "enc",
        iv: "iv",
        tag: "tag",
        keyVersion: 1,
      }),
    ).rejects.toThrow();
  });
});
