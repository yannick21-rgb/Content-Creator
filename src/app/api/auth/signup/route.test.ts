import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { db } from "@/lib/db";
import { user as userTable, account as accountTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cleanupTestData, jsonRequest } from "@/test-utils/request";

const URL = "http://localhost/api/auth/signup";

describe("POST /api/auth/signup", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("creates a user with a non-plaintext password and returns 200", async () => {
    const res = await POST(
      jsonRequest(URL, {
        email: "team@example.com",
        password: "supersecret123",
        name: "Team Member",
      }),
    );
    expect(res.status).toBe(200);

    const created = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, "team@example.com"));
    expect(created.length).toBe(1);

    const accounts = await db
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, created[0].id));
    expect(accounts.length).toBeGreaterThan(0);

    // The hashed password is stored on the account row (providerId "credential").
    const cred = accounts.find((a) => a.providerId === "credential");
    expect(cred).toBeDefined();
    expect(cred!.password).not.toBe("supersecret123");
    expect(cred!.password).toBeTruthy(); // better-auth hashes the password (format varies by version)
  });

  it("rejects a duplicate email", async () => {
    await POST(
      jsonRequest(URL, {
        email: "dup@example.com",
        password: "supersecret123",
        name: "First",
      }),
    );
    const res = await POST(
      jsonRequest(URL, {
        email: "dup@example.com",
        password: "supersecret123",
        name: "Second",
      }),
    );
    // Better Auth returns 403 for duplicate; accept 4xx.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const rows = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, "dup@example.com"));
    expect(rows.length).toBe(1);
  });
});
