import { randomBytes, createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "../db";
import { client, oauthState } from "../db/schema";
import { requireClientScope } from "../clients";
import { getProvider } from "./index";
import { errorResponse } from "../http";
import type { Platform } from "./provider";

/**
 * Shared OAuth start: verifies client ownership, stashes PKCE verifier + state
 * (with the active client id bound into the state row — D-06), then redirects
 * to the mock-authorize handler or the real provider authorize URL.
 */
export async function beginOAuthFlow(
  req: NextRequest,
  platform: Platform,
  clientId: string,
) {
  try {
    const userId = await requireClientScope();
    const [owned] = await db
      .select()
      .from(client)
      .where(and(eq(client.id, clientId), eq(client.userId, userId)));
    if (!owned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const origin = req.nextUrl.origin;
    const state = randomBytes(16).toString("hex");
    const codeVerifier = randomBytes(32).toString("hex");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const redirectUri = `${origin}/api/clients/${clientId}/connections/${platform}/callback`;

    await db.insert(oauthState).values({
      provider: platform,
      state,
      codeVerifier,
      clientId,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const mode = process.env.OAUTH_PROVIDER_MODE ?? "mock";
    if (mode === "mock") {
      return NextResponse.redirect(
        `${origin}/api/clients/${clientId}/connections/${platform}/mock-authorize?state=${state}`,
      );
    }
    const provider = getProvider(platform);
    return NextResponse.redirect(
      provider.getAuthorizeUrl({ state, codeChallenge, redirectUri }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
