import { describe, it, expect, beforeEach } from "vitest";
import { POST as signUp } from "@/app/api/auth/signup/route";
import { POST as signIn } from "@/app/api/auth/login/route";
import { auth } from "@/lib/auth";
import {
  cleanupTestData,
  jsonRequest,
  getSessionCookie,
  cookieRecord,
  cookieRequest,
} from "@/test-utils/request";

const SIGNUP_URL = "http://localhost/api/auth/signup";
const LOGIN_URL = "http://localhost/api/auth/login";

describe("session survives refresh (AUTH-02)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await signUp(
      jsonRequest(SIGNUP_URL, {
        email: "refresh@example.com",
        password: "supersecret123",
        name: "Refresh User",
      }),
    );
  });

  it("replays the session cookie and stays authenticated", async () => {
    const loginRes = await signIn(
      jsonRequest(LOGIN_URL, {
        email: "refresh@example.com",
        password: "supersecret123",
      }),
    );
    const cookie = getSessionCookie(loginRes);
    expect(cookie).toBeTruthy();

    // A second request reusing the session cookie — simulates a browser refresh.
    const session = await auth.api.getSession({
      headers: cookieRequest("http://localhost/dashboard", cookieRecord(cookie!)).headers,
    });
    expect(session).not.toBeNull();
    expect(session!.user.email).toBe("refresh@example.com");
  });

  it("rejects a request with no/invalid cookie", async () => {
    const session = await auth.api.getSession({
      headers: cookieRequest("http://localhost/dashboard", {
        "better-auth.session_token": "not-a-real-token",
      }).headers,
    });
    expect(session).toBeNull();
  });
});
