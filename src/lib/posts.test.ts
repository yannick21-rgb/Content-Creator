import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { posts, client as clientTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createPost, getPost, updatePost, listPosts } from "./posts";
import { createAuthedUser, cleanupTestData } from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import type { Cookie } from "@/test-utils/request";

describe("posts lib", () => {
  let cookie: Cookie;
  let createdClient: { id: string; name: string; userId: string };
  let secondClient: { id: string; name: string; userId: string };

  beforeAll(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("posts-test@test.com");
    cookie = auth.cookie;
    createdClient = await createClientFor(cookie, "Posts Test Client");
    const auth2 = await createAuthedUser("posts-test-2@test.com");
    secondClient = await createClientFor(auth2.cookie, "Second Client");
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("creates a post with text only", async () => {
    const result = await createPost({
      text: "Hello world",
      clientId: createdClient.id,
    });
    expect(result.id).toBeDefined();
    const [row] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result.id));
    expect(row.text).toBe("Hello world");
    expect(row.title).toBeNull();
    expect(row.clientId).toBe(createdClient.id);
  });

  it("creates a post with title + text", async () => {
    const result = await createPost({
      title: "My Title",
      text: "Body text",
      clientId: createdClient.id,
    });
    const [row] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result.id));
    expect(row.title).toBe("My Title");
    expect(row.text).toBe("Body text");
  });

  it("getPost returns the post scoped to client", async () => {
    const created = await createPost({
      text: "scoped-get",
      clientId: createdClient.id,
    });
    const found = await getPost({
      id: created.id,
      clientId: createdClient.id,
    });
    expect(found).not.toBeNull();
    expect(found!.text).toBe("scoped-get");
  });

  it("getPost returns null for mismatched client", async () => {
    const created = await createPost({
      text: "wrong-client",
      clientId: createdClient.id,
    });
    const found = await getPost({
      id: created.id,
      clientId: secondClient.id,
    });
    expect(found).toBeUndefined();
  });

  it("updatePost updates text and title", async () => {
    const created = await createPost({
      text: "original",
      clientId: createdClient.id,
    });
    await updatePost({
      id: created.id,
      clientId: createdClient.id,
      text: "updated",
      title: "New Title",
    });
    const [row] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, created.id));
    expect(row.text).toBe("updated");
    expect(row.title).toBe("New Title");
  });

  it("listPosts returns only posts for the given client", async () => {
    const all = await listPosts({ clientId: createdClient.id });
    const allSecond = await listPosts({ clientId: secondClient.id });
    // all posts for client A should not intersect with client B
    const aIds = new Set(all.map((p) => p.id));
    const bIds = new Set(allSecond.map((p) => p.id));
    for (const id of aIds) {
      expect(bIds.has(id)).toBe(false);
    }
  });
});
