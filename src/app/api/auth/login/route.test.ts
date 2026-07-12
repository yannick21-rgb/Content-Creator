import { describe, it, expect, beforeEach } from "vitest";
import { POST as POST_LOGIN } from "./route";
import { auth } from "@/lib/auth";
import { cleanupTestData, jsonRequest, getSessionCookie } from "@/test-utils/request";

const LOGIN_URL = "http://localhost/api/auth/login";

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const h = new Headers({ "content-type": "application/json" });
    const res = await auth.api.signUpEmail({
      body: { email: "login@example.com", password: "supersecret123", name: "Login User" },
      headers: h,
      asResponse: true,
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Signup failed: ${res.status}`);
    }
  });

  it("returns a session cookie for correct credentials", async () => {
    const res = await POST_LOGIN(
      jsonRequest(LOGIN_URL, {
        email: "login@example.com",
        password: "supersecret123",
      }),
    );
    expect(res.status).toBe(200);
    expect(getSessionCookie(res)).toBeTruthy();
  });

  it("returns 401 for a wrong password", async () => {
    const res = await POST_LOGIN(
      jsonRequest(LOGIN_URL, {
        email: "login@example.com",
        password: "wrongpassword",
      }),
    );
    expect(res.status).toBe(401);
    expect(getSessionCookie(res)).toBeFalsy();
  });

  it("returns 401 for an unknown email", async () => {
    const res = await POST_LOGIN(
      jsonRequest(LOGIN_URL, {
        email: "nobody@example.com",
        password: "supersecret123",
      }),
    );
    expect(res.status).toBe(401);
    expect(getSessionCookie(res)).toBeFalsy();
  });
});
