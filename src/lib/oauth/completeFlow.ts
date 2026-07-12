import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { oauthState } from "../db/schema";
import { completeOAuthConnection } from "./complete";
import { errorResponse } from "../http";
import type { Platform } from "./provider";

/** Shared OAuth callback: verifies state, completes the connection, redirects to the connections page. */
export async function completeOAuthCallback(
  req: NextRequest,
  platform: Platform,
  clientId: string,
) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing code or state" },
        { status: 400 },
      );
    }

    const [stored] = await db
      .select()
      .from(oauthState)
      .where(eq(oauthState.state, state));
    if (!stored) {
      return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }

    await completeOAuthConnection({
      platform,
      code,
      state,
      codeVerifier: stored.codeVerifier,
      redirectUri: stored.redirectUri,
    });

    return NextResponse.redirect(
      `${req.nextUrl.origin}/clients/${clientId}/connections`,
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/** Mock provider redirect: bounces back to the callback with a deterministic code. */
export async function mockAuthorize(
  req: NextRequest,
  platform: Platform,
  clientId: string,
) {
  const state = new URL(req.url).searchParams.get("state");
  const origin = req.nextUrl.origin;
  return NextResponse.redirect(
    `${origin}/api/clients/${clientId}/connections/${platform}/callback?code=MOCK_${platform}_CODE&state=${state}`,
  );
}
