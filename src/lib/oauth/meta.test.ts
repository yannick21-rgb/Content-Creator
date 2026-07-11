import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { client, oauthState, socialAccount } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { completeOAuthConnection } from "@/lib/oauth/complete";
import { decrypt } from "@/lib/crypto";
import { statusFor } from "@/lib/connection-status";
import {
  GET as reconnectRoute,
} from "@/app/api/clients/[id]/connections/[accountId]/reconnect/route";
import { clearDb, signUpAndGetCookie, cookieHeader } from "@/test/helpers";

const EMAIL = `meta-${Date.now()}@example.com`;
const PASSWORD = "password123";

describe("Meta OAuth connect (CONN-01/03) — mock", () => {
  let userId: string;
  let clientId: string;
  let authCookie: string;
  const state = "test-state-meta";
  const codeVerifier = "test-verifier-meta";
  const redirectUri = "http://localhost/api/clients/x/connections/meta/callback";

  beforeEach(async () => {
    await clearDb();
    authCookie = await signUpAndGetCookie(EMAIL, PASSWORD);
    const sess = await (
      await import("@/lib/auth")
    ).auth.api.getSession({ headers: cookieHeader(authCookie) });
    userId = sess!.user.id;
    const [c] = await db
      .insert(client)
      .values({ userId, name: "Acme" })
      .returning();
    clientId = c.id;
    await db.insert(oauthState).values({
      provider: "meta",
      state,
      codeVerifier,
      clientId,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
  });

  it("persists an encrypted token + retrievable identity", async () => {
    await completeOAuthConnection("meta", {
      code: "MOCK_meta_CODE",
      state,
      codeVerifier,
      redirectUri,
    });

    const [row] = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.clientId, clientId));
    expect(row).toBeDefined();
    expect(row.platform).toBe("meta");
    expect(row.platformAccountId).toMatch(/^mock-meta-id-/);

    // CONN-03: stored token is ciphertext, never plaintext.
    expect(row.accessTokenEnc).not.toMatch(/^mock-access-meta-/);
    const plaintext = decrypt({
      iv: row.iv,
      tag: row.tag,
      ciphertext: row.accessTokenEnc,
    });
    expect(plaintext).toMatch(/^mock-access-meta-/);
  });

  it("oauthState is consumed after completion", async () => {
    await completeOAuthConnection("meta", {
      code: "MOCK_meta_CODE",
      state,
      codeVerifier,
      redirectUri,
    });
    const remaining = await db
      .select()
      .from(oauthState)
      .where(eq(oauthState.state, state));
    expect(remaining.length).toBe(0);
  });

  it("reconnect URL re-initiates the OAuth flow (CONN-04)", async () => {
    const [row] = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.clientId, clientId));
    const res = await reconnectRoute(
      new NextRequest(
        `http://localhost/api/clients/${clientId}/connections/${row.id}/reconnect`,
        { method: "GET", headers: cookieHeader(authCookie) },
      ),
      { params: Promise.resolve({ id: clientId, accountId: row.id }) },
    );
    const location = res.headers.get("location") ?? "";
    expect(location).toContain(`/connections/meta/start`);
  });

  it("flags reconnect_required within 7 days (CONN-04)", () => {
    expect(statusFor(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))).toBe(
      "reconnect_required",
    );
  });
});
