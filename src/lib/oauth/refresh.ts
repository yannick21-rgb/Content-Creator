import { db } from "../db";
import { socialAccount } from "../db/schema";
import { eq } from "drizzle-orm";
import { decrypt, encryptTokenPair } from "../crypto";
import { getProvider } from "./index";
import type { Platform } from "./provider";

// Refresh tokens that are within this window (or already expired) are proactively
// refreshed before use (CONN-04). 7 days keeps Meta (60d) and LinkedIn (~60d)
// tokens healthy without hammering the providers.
export const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export interface ValidToken {
  accessToken: string;
  refreshed: boolean;
  expiresAt: Date | null;
}

// Returns a usable access token for the given account, transparently refreshing
// it if the stored token is within the refresh threshold or already expired.
export async function getValidAccessToken(
  accountId: string,
): Promise<ValidToken> {
  const [account] = await db
    .select()
    .from(socialAccount)
    .where(eq(socialAccount.id, accountId));
  if (!account) throw new Error(`Social account ${accountId} not found`);

  const now = Date.now();
  const exp = account.expiresAt?.getTime() ?? 0;
  const needsRefresh = !account.expiresAt || exp - now <= REFRESH_THRESHOLD_MS;

  if (!needsRefresh) {
    return {
      accessToken: decrypt({
        iv: account.iv,
        tag: account.tag,
        ciphertext: account.accessTokenEnc,
      }),
      refreshed: false,
      expiresAt: account.expiresAt,
    };
  }

  const refreshed = await refreshSocialAccount(accountId);
  if (!refreshed) {
    // Refresh not possible (no refresh path / expired beyond window): fall back
    // to the existing token and let the publish attempt surface the failure.
    return {
      accessToken: decrypt({
        iv: account.iv,
        tag: account.tag,
        ciphertext: account.accessTokenEnc,
      }),
      refreshed: false,
      expiresAt: account.expiresAt,
    };
  }

  const [updated] = await db
    .select()
    .from(socialAccount)
    .where(eq(socialAccount.id, accountId));
  return {
    accessToken: decrypt({
      iv: updated.iv,
      tag: updated.tag,
      ciphertext: updated.accessTokenEnc,
    }),
    refreshed: true,
    expiresAt: updated.expiresAt,
  };
}

// Attempts to refresh the account's access token via its provider and persists
// the new token (encrypted, shared IV). Returns true if the row was updated.
export async function refreshSocialAccount(accountId: string): Promise<boolean> {
  const [account] = await db
    .select()
    .from(socialAccount)
    .where(eq(socialAccount.id, accountId));
  if (!account) return false;

  const platform = account.platform as Platform;
  const provider = getProvider(platform);

  const currentAccessToken = decrypt({
    iv: account.iv,
    tag: account.tag,
    ciphertext: account.accessTokenEnc,
  });
  const refreshToken = account.refreshTokenEnc
    ? decrypt({
        iv: account.refreshTokenIv ?? account.iv,
        tag: account.refreshTokenTag ?? account.tag,
        ciphertext: account.refreshTokenEnc,
      })
    : undefined;

  let token: Awaited<ReturnType<typeof provider.refreshToken>> = null;
  try {
    token = await provider.refreshToken({
      accessToken: currentAccessToken,
      refreshToken,
      platform,
      platformAccountId: account.platformAccountId,
    });
  } catch (e) {
    console.error(`[refresh] ${platform} refresh failed for ${accountId}:`, e);
    return false;
  }
  if (!token?.accessToken) return false;

  const enc = encryptTokenPair(
    token.accessToken,
    token.refreshToken ?? (account.refreshTokenEnc ? refreshToken : null),
  );

  await db
    .update(socialAccount)
    .set({
      accessTokenEnc: enc.accessTokenEnc,
      refreshTokenEnc: enc.refreshTokenEnc,
      iv: enc.iv,
      tag: enc.tag,
      refreshTokenIv: enc.refreshTokenIv,
      refreshTokenTag: enc.refreshTokenTag,
      expiresAt: token.expiresAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(socialAccount.id, accountId));

  return true;
}

// Sweep used by the recurring worker job: refresh every account whose token is
// within `withinMs` of expiry (default: twice the refresh threshold) so tokens
// stay healthy and "reconnect required" becomes rare.
export async function refreshExpiringAccounts(
  withinMs: number = REFRESH_THRESHOLD_MS * 2,
): Promise<{ checked: number; refreshed: number; failed: number }> {
  const all = await db.select().from(socialAccount);
  const now = Date.now();
  let refreshed = 0;
  let failed = 0;
  let checked = 0;

  for (const account of all) {
    if (account.expiresAt && account.expiresAt.getTime() - now > withinMs) {
      continue;
    }
    checked += 1;
    const ok = await refreshSocialAccount(account.id);
    if (ok) refreshed += 1;
    else failed += 1;
  }
  return { checked, refreshed, failed };
}
