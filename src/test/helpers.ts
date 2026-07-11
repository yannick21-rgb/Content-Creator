import { db } from "@/lib/db";
import {
  account,
  client,
  media,
  oauthState,
  posts,
  session,
  socialAccount,
  user,
  verification,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";

/** Clears all tables between tests (depends on FK cascade order). */
export async function clearDb() {
  await db.delete(media);
  await db.delete(posts);
  await db.delete(oauthState);
  await db.delete(socialAccount);
  await db.delete(session);
  await db.delete(account);
  await db.delete(client);
  await db.delete(verification);
  await db.delete(user);
}

/** Signs a user up via Better Auth and returns the session set-cookie header. */
export async function signUpAndGetCookie(email: string, password: string) {
  const res = await auth.api.signUpEmail({
    body: { email, password, name: "Test User" },
    headers: new Headers(),
    asResponse: true,
  });
  return res.headers.get("set-cookie") ?? "";
}

export function cookieHeader(cookie: string): Headers {
  const h = new Headers();
  if (cookie) h.set("cookie", cookie);
  return h;
}
