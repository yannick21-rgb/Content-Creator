import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { cleanupTestData, jsonRequest, getSessionCookie } from "@/test-utils/request";

const SIGNUP_URL = "http://localhost/api/auth/signup";
const LOGIN_URL = "http://localhost/api/auth/login";

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await POST(
      jsonRequest(SIGNUP_URL, {
        email: "login@example.com",
        password: "supersecret123",
        name: "Login User",
      }),
    );
  });

  it("returns a session cookie for correct credentials", async () => {
    const res = await POST(
      jsonRequest(LOGIN_URL, {
        email: "login@example.com",
        password: "supersecret123",
      }),
    );
    expect(res.status).toBe(200);
    expect(getSessionCookie(res)).toBeTruthy();
  });

  it("returns 401 for a wrong password", async () => {
    const res = await POST(
      jsonRequest(LOGIN_URL, {
        email: "login@example.com",
        password: "wrongpassword",
      }),
    );
    expect(res.status).toBe(401);
    expect(getSessionCookie(res)).toBeFalsy();
  });

  it("returns 401 for an unknown email", async () => {
    const res = await POST(
      jsonRequest(LOGIN_URL, {
        email: "nobody@example.com",
        password: "supersecret123",
      }),
    );
    expect(res.status).toBe(401);
    expect(getSessionCookie(res)).toBeFalsy();
  });
});
