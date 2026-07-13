import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { client, socialAccount, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encryptTokenPair, decrypt } from "@/lib/crypto";
import {
  getValidAccessToken,
  refreshSocialAccount,
  refreshExpiringAccounts,
} from "./refresh";
import { clearDb } from "@/test/helpers";

const DAY = 24 * 60 * 60 * 1000;

async function seedAccount(opts: { expiresAt: Date | null; platform?: string }) {
  const userId = randomUUID();
  await db.insert(user).values({
    id: userId,
    name: "Test User",
    email: `${userId}@example.com`,
  });
  const [c] = await db
    .insert(client)
    .values({ id: randomUUID(), userId, name: "Test Client" })
    .returning();
  const pair = encryptTokenPair("old-access-token", "old-refresh-token");
  const [acc] = await db
    .insert(socialAccount)
    .values({
      id: randomUUID(),
      clientId: c.id,
      platform: opts.platform ?? "meta",
      platformAccountId: "page-123",
      name: "Test Account",
      ...pair,
      expiresAt: opts.expiresAt,
      keyVersion: 1,
    })
    .returning();
  return acc;
}

describe("token refresh (CONN-04)", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("refreshes a token within the expiry threshold", async () => {
    const acc = await seedAccount({ expiresAt: new Date(Date.now() + 1 * DAY) });
    const token = await getValidAccessToken(acc.id);
    expect(token.refreshed).toBe(true);
    expect(token.accessToken).toContain("refreshed");
  });

  it("does not refresh a token far from expiry", async () => {
    const acc = await seedAccount({ expiresAt: new Date(Date.now() + 90 * DAY) });
    const token = await getValidAccessToken(acc.id);
    expect(token.refreshed).toBe(false);
    expect(token.accessToken).toBe("old-access-token");
  });

  it("refreshSocialAccount persists a new encrypted token", async () => {
    const acc = await seedAccount({ expiresAt: new Date(Date.now() + 1000) });
    const ok = await refreshSocialAccount(acc.id);
    expect(ok).toBe(true);
    const [updated] = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.id, acc.id));
    const decrypted = decrypt({
      iv: updated.iv,
      tag: updated.tag,
      ciphertext: updated.accessTokenEnc,
    });
    expect(decrypted).toContain("refreshed");
    // refresh token stored under its own IV/tag is still decryptable
    expect(updated.refreshTokenEnc).toBeTruthy();
    const refreshed = decrypt({
      iv: updated.refreshTokenIv!,
      tag: updated.refreshTokenTag!,
      ciphertext: updated.refreshTokenEnc!,
    });
    expect(refreshed).toContain("mock-refresh");
  });

  it("refreshExpiringAccounts sweeps near-expiry accounts", async () => {
    await seedAccount({ expiresAt: new Date(Date.now() + 1000), platform: "linkedin" });
    const summary = await refreshExpiringAccounts(30 * DAY);
    expect(summary.checked).toBeGreaterThanOrEqual(1);
    expect(summary.refreshed).toBeGreaterThanOrEqual(1);
  });
});
