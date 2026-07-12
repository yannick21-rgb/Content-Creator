import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import {
  createAuthedUser,
  cleanupTestData,
  jsonRequest,
  cookieRecord,
  type Cookie,
} from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import { ACTIVE_CLIENT_COOKIE } from "@/lib/clients";

vi.mock("@/lib/r2", () => ({
  generateUploadUrl: vi.fn().mockImplementation(({ clientId }: { clientId: string }) =>
    Promise.resolve({
      presignedUrl: "https://r2.example.com/presigned",
      key: `media/${clientId}/uuid.jpeg`,
      clientId,
      contentType: "image/jpeg",
    }),
  ),
}));

const BASE = "http://localhost/api/media/upload";

describe("POST /api/media/upload (MEDA-01)", () => {
  let cookie: Cookie;
  let client: { id: string };

  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanupTestData();
    const auth = await createAuthedUser("media-upload@test.com");
    cookie = auth.cookie;
    client = await createClientFor(cookie, "Media Upload Client");
  });

  it("returns presignedUrl for valid image upload", async () => {
    const req = jsonRequest(BASE, { contentType: "image/jpeg", fileName: "photo.jpg" }, {
      ...cookieRecord(cookie),
      [ACTIVE_CLIENT_COOKIE]: client.id,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.presignedUrl).toBeDefined();
    expect(body.key).toBeDefined();
    expect(body.publicUrl).toBeDefined();
  });

  it("rejects unsupported content type", async () => {
    const req = jsonRequest(BASE, { contentType: "video/mp4", fileName: "video.mp4" }, {
      ...cookieRecord(cookie),
      [ACTIVE_CLIENT_COOKIE]: client.id,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing content-type or fileName", async () => {
    const req = jsonRequest(BASE, {}, {
      ...cookieRecord(cookie),
      [ACTIVE_CLIENT_COOKIE]: client.id,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects unauthenticated request", async () => {
    const req = jsonRequest(BASE, { contentType: "image/jpeg", fileName: "x.jpg" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
