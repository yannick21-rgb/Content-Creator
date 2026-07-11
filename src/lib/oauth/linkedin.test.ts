import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { client, oauthState, socialAccount } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { completeOAuthConnection } from "@/lib/oauth/complete";
import { decrypt } from "@/lib/crypto";
import { clearDb, signUpAndGetCookie } from "@/test/helpers";

const EMAIL = `linkedin-${Date.now()}@example.com`;
const PASSWORD = "password123";

describe("LinkedIn OAuth connect (CONN-02/03) — mock", () => {
  let userId: string;
  let clientId: string;
  const state = "test-state-linkedin";
  const codeVerifier = "test-verifier-linkedin";
  const redirectUri =
    "http://localhost/api/clients/x/connections/linkedin/callback";

  beforeEach(async () => {
    await clearDb();
    const cookie = await signUpAndGetCookie(EMAIL, PASSWORD);
    const sess = await (
      await import("@/lib/auth")
    ).auth.api.getSession({ headers: cookieHeaderLinkedin(cookie) });
    userId = sess!.user.id;
    const [c] = await db
      .insert(client)
      .values({ userId, name: "Acme" })
      .returning();
    clientId = c.id;
    await db.insert(oauthState).values({
      provider: "linkedin",
      state,
      codeVerifier,
      clientId,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
  });

  it("persists an encrypted token + retrievable profile id", async () => {
    await completeOAuthConnection("linkedin", {
      code: "MOCK_linkedin_CODE",
      state,
      codeVerifier,
      redirectUri,
    });

    const [row] = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.clientId, clientId));
    expect(row).toBeDefined();
    expect(row.platform).toBe("linkedin");
    expect(row.platformAccountId).toMatch(/^mock-linkedin-id-/);

    // CONN-03: stored token is ciphertext, never plaintext.
    expect(row.accessTokenEnc).not.toMatch(/^mock-access-linkedin-/);
    const plaintext = decrypt({
      iv: row.iv,
      tag: row.tag,
      ciphertext: row.accessTokenEnc,
    });
    expect(plaintext).toMatch(/^mock-access-linkedin-/);
  });
});

function cookieHeaderLinkedin(cookie: string): Headers {
  const h = new Headers();
  if (cookie) h.set("cookie", cookie);
  return h;
}
