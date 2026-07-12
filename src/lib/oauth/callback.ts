import { NextRequest, NextResponse } from "next/server";
import { db } from "../db";
import { oauthState } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { completeOAuthConnection } from "./complete";
import type { Platform } from "./provider";

// Shared "complete OAuth" logic for both platforms.
export async function completeOAuth(
  platform: Platform,
  clientId: string,
  req: NextRequest,
): Promise<NextResponse> {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state" },
      { status: 400 },
    );
  }

  const [stored] = await db
    .select()
    .from(oauthState)
    .where(and(eq(oauthState.state, state), eq(oauthState.provider, platform)));
  if (!stored || stored.clientId !== clientId) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  await completeOAuthConnection({
    platform,
    code,
    state,
    codeVerifier: stored.codeVerifier,
    redirectUri: stored.redirectUri,
  });

  const origin = req.nextUrl.origin;
  return NextResponse.redirect(`${origin}/clients/${clientId}/connections`);
}
