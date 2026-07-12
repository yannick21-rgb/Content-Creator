import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { user, account, session, client, media, posts, socialAccount, oauthState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

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

// The Better Auth session cookie name (default in v1).
export const SESSION_COOKIE = "better-auth.session_token";

export type Cookie = { name: string; value: string };

// Extract the first set-cookie matching the given name.
export function getCookie(res: Response, name: string): string | undefined {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    const [pair] = c.split(";");
    const [k, v] = pair.split("=");
    if (k.trim() === name) return v;
  }
  return undefined;
}

// Read the session cookie generically (name may vary by Better Auth config).
export function getSessionCookie(res: Response): Cookie | undefined {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    const [pair, ...attrs] = c.split(";");
    const [k, v] = pair.split("=");
    const name = k.trim();
    const isSession =
      name === SESSION_COOKIE ||
      name.toLowerCase().includes("session_token") ||
      name.toLowerCase().includes("session");
    if (isSession) {
      return { name, value: v };
    }
  }
  return undefined;
}

// Build a cookie record from a session cookie.
export function cookieRecord(session: Cookie): Record<string, string> {
  return { [session.name]: session.value };
}

// Wipe all application rows so each test starts clean.
export async function cleanupTestData() {
  await db.delete(media);
  await db.delete(posts);
  await db.delete(oauthState);
  await db.delete(socialAccount);
  await db.delete(client);
  await db.delete(account);
  await db.delete(session);
  await db.delete(user);
}

// Create a user + return a valid session cookie and the user id (for tests).
// Uses Better Auth API directly (not route handlers) to avoid response-forwarding issues.
export async function createAuthedUser(email: string, password = "supersecret123") {
  const h = new Headers({ "content-type": "application/json" });

  const signupRes = await auth.api.signUpEmail({
    body: { email, password, name: email },
    headers: h,
    asResponse: true,
  });
  if (signupRes.status !== 200 && signupRes.status !== 201) {
    const body = signupRes.body ? await signupRes.json() : null;
    throw new Error(`Signup failed (${signupRes.status}): ${JSON.stringify(body)}`);
  }

  const loginRes = await auth.api.signInEmail({
    body: { email, password },
    headers: h,
    asResponse: true,
  });
  if (loginRes.status !== 200) {
    const body = loginRes.body ? await loginRes.json() : null;
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(body)}`);
  }

  const cookie = getSessionCookie(loginRes)!;
  const [u] = await db.select().from(user).where(eq(user.email, email));
  return { cookie, userId: u.id };
}

