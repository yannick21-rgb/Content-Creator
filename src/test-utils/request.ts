import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { user, account, session, client, socialAccount, oauthState } from "@/lib/db/schema";

// Build a NextRequest with a JSON body and optional cookies.
export function jsonRequest(
  url: string,
  body: unknown,
  cookies?: Record<string, string>,
): NextRequest {
  const req = new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  if (cookies) {
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    req.headers.set("cookie", cookieHeader);
  }
  return req;
}

export function cookieRequest(
  url: string,
  cookies: Record<string, string>,
): NextRequest {
  const req = new NextRequest(url, { method: "GET" });
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  req.headers.set("cookie", cookieHeader);
  return req;
}

// Extract a cookie value from a Response's Set-Cookie headers.
export function getCookie(res: Response, name: string): string | undefined {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    const [pair] = c.split(";");
    const [k, v] = pair.split("=");
    if (k.trim() === name) return v;
  }
  return undefined;
}

// The Better Auth session cookie name (default in v1).
export const SESSION_COOKIE = "better-auth.session_token";

// Wipe all application rows so each test starts clean.
export async function cleanupTestData() {
  await db.delete(oauthState);
  await db.delete(socialAccount);
  await db.delete(client);
  await db.delete(account);
  await db.delete(session);
  await db.delete(user);
}
