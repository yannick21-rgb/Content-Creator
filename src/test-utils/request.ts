import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { user, account, session, client, socialAccount, oauthState } from "@/lib/db/schema";
import { POST as POST_SIGNUP } from "@/app/api/auth/signup/route";
import { POST as POST_LOGIN } from "@/app/api/auth/login/route";

const SIGNUP_URL = "http://localhost/api/auth/signup";
const LOGIN_URL = "http://localhost/api/auth/login";

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
  await db.delete(oauthState);
  await db.delete(socialAccount);
  await db.delete(client);
  await db.delete(account);
  await db.delete(session);
  await db.delete(user);
}

// Create a user + return a valid session cookie and the user id (for tests).
export async function createAuthedUser(email: string, password = "supersecret123") {
  await POST_SIGNUP(jsonRequest(SIGNUP_URL, { email, password, name: email }));
  const loginRes = await POST_LOGIN(
    jsonRequest(LOGIN_URL, { email, password }),
  );
  const cookie = getSessionCookie(loginRes)!;
  const [u] = await db.select().from(user).where(eq(user.email, email));
  return { cookie, userId: u.id };
}

