import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { client, socialAccount } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listConnections } from "@/lib/clients";
import { clearDb, signUpAndGetCookie } from "@/test/helpers";

const EMAIL = `scope-${Date.now()}@example.com`;
const PASSWORD = "password123";

describe("client isolation (CLNT-02)", () => {
  let userId: string;
  let clientX: string;
  let clientY: string;

  beforeEach(async () => {
    await clearDb();
    const cookie = await signUpAndGetCookie(EMAIL, PASSWORD);
    const sess = await (
      await import("@/lib/auth")
    ).auth.api.getSession({ headers: cookieHeaderFor(cookie) });
    userId = sess!.user.id;

    const [x] = await db
      .insert(client)
      .values({ userId, name: "X" })
      .returning();
    const [y] = await db
      .insert(client)
      .values({ userId, name: "Y" })
      .returning();
    clientX = x.id;
    clientY = y.id;

    await db.insert(socialAccount).values({
      clientId: clientX,
      platform: "meta",
      platformAccountId: "ig-x",
      name: "Meta X",
      accessTokenEnc: "enc",
      iv: "iv",
      tag: "tag",
      keyVersion: 1,
    });
  });

  it("cross-client read returns no rows for the other client", async () => {
    const rows = await listConnections(clientY);
    expect(rows.length).toBe(0);
  });

  it("FK rejects a social account without a valid client", async () => {
    await expect(
      db.insert(socialAccount).values({
        clientId: "00000000-0000-0000-0000-000000000000",
        platform: "meta",
        platformAccountId: "ig-bad",
        name: "Bad",
        accessTokenEnc: "enc",
        iv: "iv",
        tag: "tag",
        keyVersion: 1,
      }),
    ).rejects.toThrow();
  });
});

function cookieHeaderFor(cookie: string): Headers {
  const h = new Headers();
  if (cookie) h.set("cookie", cookie);
  return h;
}
