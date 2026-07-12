import { db } from "../db";
import { oauthState, socialAccount } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getProvider } from "./index";
import { MetaOAuthProvider } from "./meta";
import { encrypt } from "../crypto";
import type { Platform } from "./provider";

export interface CompleteParams {
  platform: Platform;
  code: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

// Verify the OAuth state (CSRF + client binding), exchange the code, fetch the
// identity, encrypt the token at the boundary, and persist the social account
// bound to the client embedded in the oauth_state row (D-06).
export async function completeOAuthConnection(params: CompleteParams) {
  const { platform, code, state, codeVerifier, redirectUri } = params;

  const [stored] = await db
    .select()
    .from(oauthState)
    .where(
      and(eq(oauthState.state, state), eq(oauthState.provider, platform)),
    );

  if (!stored) {
    throw new Error("OAuth state not found or already consumed");
  }
  if (stored.expiresAt.getTime() < Date.now()) {
    await db.delete(oauthState).where(eq(oauthState.id, stored.id));
    throw new Error("OAuth state expired");
  }
  if (stored.codeVerifier !== codeVerifier) {
    throw new Error("PKCE verifier mismatch");
  }

  const clientId = stored.clientId;

  // Consume the state row immediately (single use).
  await db.delete(oauthState).where(eq(oauthState.id, stored.id));

  const provider = getProvider(platform);
  const token = await provider.exchangeCode({ code, codeVerifier, redirectUri });
  const identity = await provider.fetchIdentity(token.accessToken);

  const accessEnc = encrypt(token.accessToken);
  const refreshEnc = token.refreshToken ? encrypt(token.refreshToken) : null;

  const [row] = await db
    .insert(socialAccount)
    .values({
      clientId,
      platform,
      platformAccountId: identity.platformAccountId,
      name: identity.name,
      accessTokenEnc: accessEnc.ciphertext,
      iv: accessEnc.iv,
      tag: accessEnc.tag,
      refreshTokenEnc: refreshEnc ? refreshEnc.ciphertext : null,
      expiresAt: token.expiresAt ?? null,
      keyVersion: 1,
    })
    .returning();

  if (platform === "meta" && provider instanceof MetaOAuthProvider) {
    try {
      const { pages } = await provider.fetchIdentityWithPages(token.accessToken);
      for (const page of pages) {
        const pageTokenEnc = encrypt(page.pageToken);
        await db
          .insert(socialAccount)
          .values({
            clientId,
            platform,
            platformAccountId: page.id,
            name: page.name,
            accessTokenEnc: pageTokenEnc.ciphertext,
            iv: pageTokenEnc.iv,
            tag: pageTokenEnc.tag,
            expiresAt: token.expiresAt ?? null,
            keyVersion: 1,
          })
          .onConflictDoNothing({
            target: [socialAccount.platformAccountId, socialAccount.platform, socialAccount.clientId],
          });
      }

      // Create Instagram Business Account rows separately
      const igIdentity = await provider.fetchIdentity(token.accessToken);
      if (igIdentity.platformAccountId !== (pages[0]?.id ?? "")) {
        const igTokenEnc = encrypt(token.accessToken);
        await db
          .insert(socialAccount)
          .values({
            clientId,
            platform: "instagram",
            platformAccountId: igIdentity.platformAccountId,
            name: igIdentity.name,
            accessTokenEnc: igTokenEnc.ciphertext,
            iv: igTokenEnc.iv,
            tag: igTokenEnc.tag,
            expiresAt: token.expiresAt ?? null,
            keyVersion: 1,
          })
          .onConflictDoNothing({
            target: [socialAccount.platformAccountId, socialAccount.platform, socialAccount.clientId],
          });
      }
    } catch (e) {
      console.error("Failed to fetch Meta pages/IG during OAuth:", e);
    }
  }

  return {
    id: row.id,
    platform: row.platform,
    platformAccountId: row.platformAccountId,
    name: row.name,
    expiresAt: row.expiresAt,
    keyVersion: row.keyVersion,
  };
}
