import { eq } from "drizzle-orm";
import { db } from "../db";
import { oauthState, socialAccount } from "../db/schema";
import { encrypt } from "../crypto";
import { getProvider } from "./index";
import type { Platform } from "./provider";

export interface CompleteParams {
  code: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

/**
 * Verifies the OAuth state, exchanges the code, fetches identity, encrypts the
 * token at the boundary, and persists the social_account bound to the client
 * embedded in the state (D-06 target-confusion safe). No plaintext token is
 * ever returned. (CONN-01/02/03)
 */
export async function completeOAuthConnection(platform: Platform, p: CompleteParams) {
  const [stored] = await db
    .select()
    .from(oauthState)
    .where(eq(oauthState.state, p.state));

  if (!stored) throw new Error("Invalid or expired OAuth state");
  if (stored.expiresAt < new Date()) throw new Error("OAuth state expired");
  if (stored.provider !== platform) throw new Error("Provider mismatch");

  const clientId = stored.clientId;
  const provider = getProvider(platform);
  const token = await provider.exchangeCode({
    code: p.code,
    codeVerifier: p.codeVerifier,
    redirectUri: p.redirectUri,
  });
  const identity = await provider.fetchIdentity(token.accessToken);

  const enc = encrypt(token.accessToken);
  const refreshEnc = token.refreshToken ? encrypt(token.refreshToken) : null;

  // Consume the one-time OAuth state.
  await db.delete(oauthState).where(eq(oauthState.state, p.state));

  const [row] = await db
    .insert(socialAccount)
    .values({
      clientId,
      platform,
      platformAccountId: identity.platformAccountId,
      name: identity.name,
      accessTokenEnc: enc.ciphertext,
      refreshTokenEnc: refreshEnc ? refreshEnc.ciphertext : null,
      iv: enc.iv,
      tag: enc.tag,
      expiresAt: token.expiresAt ?? null,
      keyVersion: 1,
    })
    .returning();

  return row;
}
