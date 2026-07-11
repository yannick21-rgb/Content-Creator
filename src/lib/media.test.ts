import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { insertMedia, getClientMedia } from "./media";
import { createAuthedUser, cleanupTestData } from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import type { Cookie } from "@/test-utils/request";

describe("media lib", () => {
  let cookie: Cookie;
  let createdClient: { id: string; name: string; userId: string };
  let secondClient: { id: string; name: string; userId: string };

  beforeAll(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("media-test@test.com");
    cookie = auth.cookie;
    createdClient = await createClientFor(cookie, "Media Test Client");
    const auth2 = await createAuthedUser("media-test-2@test.com");
    secondClient = await createClientFor(auth2.cookie, "Media Second");
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("insertMedia creates a media row with key and publicUrl", async () => {
    const row = await insertMedia({
      clientId: createdClient.id,
      key: "media/test/uuid.jpeg",
      publicUrl: "https://pub.r2.dev/media/test/uuid.jpeg",
      contentType: "image/jpeg",
      userId: createdClient.userId,
    });
    expect(row.id).toBeDefined();
    expect(row.key).toBe("media/test/uuid.jpeg");
    expect(row.publicUrl).toContain("r2.dev");
    expect(row.clientId).toBe(createdClient.id);
  });

  it("getClientMedia returns only media for the given client", async () => {
    const clientAMedia = await getClientMedia({ clientId: createdClient.id });
    const clientBMedia = await getClientMedia({ clientId: secondClient.id });
    const aKeys = new Set(clientAMedia.map((m) => m.id));
    for (const m of clientBMedia) {
      expect(aKeys.has(m.id)).toBe(false);
    }
  });
});
