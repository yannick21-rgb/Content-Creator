import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { GET as GET_POST } from "./[id]/route";
import { PATCH } from "./[id]/route";
import {
  createAuthedUser,
  cleanupTestData,
  jsonRequest,
  cookieRecord,
  type Cookie,
} from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import { ACTIVE_CLIENT_COOKIE } from "@/lib/clients";

const BASE = "http://localhost/api/posts";

function authedRequest(
  body: unknown,
  cookie: Cookie,
  activeClientId: string,
) {
  return jsonRequest(BASE, body, {
    ...cookieRecord(cookie),
    [ACTIVE_CLIENT_COOKIE]: activeClientId,
  });
}

describe("POST /api/posts (COMP-01)", () => {
  let cookie: Cookie;
  let client: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("posts-api@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Post Client");
  });

  it("creates a text-only post", async () => {
    const req = authedRequest({ text: "Hello" }, cookie, client.id);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
  });

  it("rejects missing text with 400", async () => {
    const req = authedRequest({}, cookie, client.id);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects unauthenticated request", async () => {
    const req = jsonRequest(BASE, { text: "Hi" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/posts", () => {
  let cookie: Cookie;
  let client: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("posts-list@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "List Client");
    await POST(authedRequest({ text: "Post 1" }, cookie, client.id));
    await POST(authedRequest({ text: "Post 2" }, cookie, client.id));
  });

  it("lists posts scoped to active client", async () => {
    const req = authedRequest({}, cookie, client.id);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(2);
  });
});

describe("GET /api/posts/[id]", () => {
  let cookie: Cookie;
  let client: { id: string };
  let postId: string;

  beforeEach(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("posts-get@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Get Client");
    const res = await POST(authedRequest({ text: "Target" }, cookie, client.id));
    postId = (await res.json()).id;
  });

  it("returns the post for the owning client", async () => {
    const req = authedRequest({}, cookie, client.id);
    const res = await GET_POST(req, { params: Promise.resolve({ id: postId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Target");
  });

  it("returns 404 for wrong client", async () => {
    const otherCookie = (await createAuthedUser("other@test.com")).cookie;
    const otherClient = await createClientFor(otherCookie, "Other");
    const req = authedRequest({}, cookie, otherClient.id);
    const res = await GET_POST(req, { params: Promise.resolve({ id: postId }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/posts/[id]", () => {
  let cookie: Cookie;
  let client: { id: string };
  let postId: string;

  beforeEach(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("posts-patch@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Patch Client");
    const res = await POST(authedRequest({ text: "Original" }, cookie, client.id));
    postId = (await res.json()).id;
  });

  it("updates post text", async () => {
    const req = jsonRequest(`http://localhost/api/posts/${postId}`, { text: "Updated" }, {
      ...cookieRecord(cookie),
      [ACTIVE_CLIENT_COOKIE]: client.id,
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: postId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Updated");
  });
});
