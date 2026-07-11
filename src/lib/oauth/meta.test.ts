import { describe, it, expect, beforeEach } from "vitest";
import { createAuthedUser, createClientFor, cleanupTestData } from "@/test-utils/clients-helper";
import { db } from "@/lib/db";
import { socialAccount, oauthState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { completeOAuthConnection } from "@/lib/oauth/complete";

describe("Meta OAuth connect (CONN-01, mock)", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("stores an encrypted long-lived token + retrievable account id", async () => {
    const { cookie } = await createAuthedUser("meta-owner@example.com");
    const client = await createClientFor(cookie, "Meta Client");

    const state = "meta-state-1";
    const codeVerifier = "meta-verifier-1";
    const redirectUri = "http://localhost/cb";
    await db.insert(oauthState).values({
      provider: "meta",
      state,
      codeVerifier,
      clientId: client.id,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const result = await completeOAuthConnection({
      platform: "meta",
      code: "MOCK_meta_CODE",
      state,
      codeVerifier,
      redirectUri,
    });

    expect(result.platform).toBe("meta");
    expect(result.platformAccountId).toMatch(/^mock-meta-id-/);

    const [row] = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.id, result.id));
    // DB holds ciphertext, not the plaintext mock token.
    expect(row.accessTokenEnc).toBeTruthy();
    expect(row.iv).toBeTruthy();
    expect(row.tag).toBeTruthy();
    expect(row.accessTokenEnc).not.toMatch(/^mock-access-meta-/);
    expect(row.accessTokenEnc).not.toBe("mock-access-meta-CODE");
  });
});
