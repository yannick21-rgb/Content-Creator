import { describe, it, expect, beforeEach } from "vitest";
import { createAuthedUser, createClientFor, cleanupTestData } from "@/test-utils/clients-helper";
import { db } from "@/lib/db";
import { socialAccount, oauthState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { completeOAuthConnection } from "@/lib/oauth/complete";

describe("LinkedIn OAuth connect (CONN-02, mock)", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("stores an encrypted token + retrievable profile id", async () => {
    const { cookie } = await createAuthedUser("li-owner@example.com");
    const client = await createClientFor(cookie, "LinkedIn Client");

    const state = "li-state-1";
    const codeVerifier = "li-verifier-1";
    const redirectUri = "http://localhost/cb";
    await db.insert(oauthState).values({
      provider: "linkedin",
      state,
      codeVerifier,
      clientId: client.id,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const result = await completeOAuthConnection({
      platform: "linkedin",
      code: "MOCK_linkedin_CODE",
      state,
      codeVerifier,
      redirectUri,
    });

    expect(result.platform).toBe("linkedin");
    expect(result.platformAccountId).toMatch(/^mock-linkedin-id-/);

    const [row] = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.id, result.id));
    expect(row.accessTokenEnc).toBeTruthy();
    expect(row.iv).toBeTruthy();
    expect(row.tag).toBeTruthy();
    expect(row.accessTokenEnc).not.toMatch(/^mock-access-linkedin-/);
  });
});
