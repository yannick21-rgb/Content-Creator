import { NextRequest, NextResponse } from "next/server";
import { db } from "../db";
import { oauthState } from "../db/schema";
import { generatePkce } from "./pkce";
import { getProvider } from "./index";
import type { Platform } from "./provider";

// Shared "begin OAuth" logic for both platforms (D-06: clientId bound in state).
export async function beginOAuth(
  platform: Platform,
  clientId: string,
  req: NextRequest,
): Promise<NextResponse> {
  const origin = req.nextUrl.origin;
  const { state, codeVerifier, codeChallenge } = generatePkce();
  const redirectUri = `${origin}/api/clients/${clientId}/connections/${platform}/callback`;

  await db.insert(oauthState).values({
    provider: platform,
    state,
    codeVerifier,
    clientId,
    redirectUri,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
  });

  const mode = process.env.OAUTH_PROVIDER_MODE ?? "mock";
  if (mode === "mock") {
    return NextResponse.redirect(
      `${origin}/api/clients/${clientId}/connections/${platform}/mock-authorize?state=${state}`,
    );
  }
  const provider = getProvider(platform);
  const url = provider.getAuthorizeUrl({ state, codeChallenge, redirectUri });
  return NextResponse.redirect(url);
}
