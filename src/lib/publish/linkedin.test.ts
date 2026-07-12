import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkedInPublisher } from "./linkedin";

describe("LinkedInPublisher (PUBL-01, PUBL-02)", () => {
  let publisher: LinkedInPublisher;

  beforeEach(() => {
    publisher = new LinkedInPublisher();
    vi.restoreAllMocks();
  });

  describe("prepare", () => {
    it("returns ready for valid text-only post", async () => {
      const result = await publisher.prepare(
        { text: "Valid LinkedIn post", media: [] },
        {},
      );
      expect(result.ready).toBe(true);
    });

    it("returns ready for valid text + single image", async () => {
      const result = await publisher.prepare(
        {
          text: "Post",
          media: [{ contentType: "image/jpeg", publicUrl: "https://r2.example.com/photo.jpg" }],
        },
        {},
      );
      expect(result.ready).toBe(true);
    });

    it("returns ready for valid PNG image", async () => {
      const result = await publisher.prepare(
        {
          text: "Post",
          media: [{ contentType: "image/png", publicUrl: "https://r2.example.com/photo.png" }],
        },
        {},
      );
      expect(result.ready).toBe(true);
    });

    it("returns ready for valid GIF image", async () => {
      const result = await publisher.prepare(
        {
          text: "Post",
          media: [{ contentType: "image/gif", publicUrl: "https://r2.example.com/photo.gif" }],
        },
        {},
      );
      expect(result.ready).toBe(true);
    });

    it("rejects empty post", async () => {
      const result = await publisher.prepare({ text: "", media: [] }, {});
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("Post must have text or media for LinkedIn");
    });

    it("rejects caption over 700 chars", async () => {
      const result = await publisher.prepare(
        { text: "x".repeat(701), media: [] },
        {},
      );
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("LinkedIn caption exceeds 700 character limit");
    });

    it("rejects multi-image (carousel)", async () => {
      const result = await publisher.prepare(
        {
          text: "Post",
          media: [
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/1.jpg" },
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/2.jpg" },
          ],
        },
        {},
      );
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("LinkedIn does not support carousel posts");
    });

    it("rejects single video", async () => {
      const result = await publisher.prepare(
        {
          text: "Post",
          media: [{ contentType: "video/mp4", publicUrl: "https://r2.example.com/vid.mp4" }],
        },
        {},
      );
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("LinkedIn video publishing not supported in this phase");
    });

    it("rejects unsupported image format", async () => {
      const result = await publisher.prepare(
        {
          text: "Post",
          media: [{ contentType: "image/webp", publicUrl: "https://r2.example.com/photo.webp" }],
        },
        {},
      );
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("LinkedIn image must be JPEG, PNG, or GIF");
    });

    it("rejects 3+ media items", async () => {
      const result = await publisher.prepare(
        {
          text: "Post",
          media: [
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/1.jpg" },
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/2.jpg" },
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/3.jpg" },
          ],
        },
        {},
      );
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("LinkedIn does not support carousel posts");
    });
  });

  describe("publish", () => {
    it("publishes text-only post successfully", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: new Map([["x-restli-id", "urn:li:share:abc123"]]),
      });

      const result = await publisher.publish(
        { text: "Hello LinkedIn", media: [] },
        { socialAccount: { platformAccountId: "user_123" } },
        { accessToken: "valid_token", platform: "linkedin" },
      );
      expect(result.success).toBe(true);
      expect(result.platformRef).toBe("urn:li:share:abc123");
    });

    it("publishes text + single image successfully", async () => {
      const mockImageData = new ArrayBuffer(8);
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            value: {
              uploadUrl: "https://www.linkedin.com/dms-uploads/test",
              image: "urn:li:image:img123",
            },
          }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(mockImageData) })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([["x-restli-id", "urn:li:share:abc456"]]),
        });

      const result = await publisher.publish(
        {
          text: "Post with image",
          media: [{ contentType: "image/jpeg", publicUrl: "https://r2.example.com/photo.jpg" }],
        },
        { socialAccount: { platformAccountId: "user_123" } },
        { accessToken: "valid_token", platform: "linkedin" },
      );
      expect(result.success).toBe(true);
      expect(result.platformRef).toBe("urn:li:share:abc456");
    });

    it("returns error for invalid token", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Invalid access token", serviceErrorCode: 65604 }),
      });

      const result = await publisher.publish(
        { text: "Hello", media: [] },
        { socialAccount: { platformAccountId: "user_123" } },
        { accessToken: "bad_token", platform: "linkedin" },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("401");
    });

    it("returns text-only fallback when image upload fails", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ message: "Bad request" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([["x-restli-id", "urn:li:share:fallback789"]]),
        });

      const result = await publisher.publish(
        {
          text: "Post with failed image",
          media: [{ contentType: "image/jpeg", publicUrl: "https://r2.example.com/photo.jpg" }],
        },
        { socialAccount: { platformAccountId: "user_123" } },
        { accessToken: "valid_token", platform: "linkedin" },
      );
      expect(result.success).toBe(true);
      expect(result.platformRef).toBe("urn:li:share:fallback789");
      expect(result.error).toBe("published (media failed)");
    });

    it("returns error when LinkedIn user ID is missing", async () => {
      const result = await publisher.publish(
        { text: "Hello", media: [] },
        { socialAccount: {} },
        { accessToken: "valid_token", platform: "linkedin" },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("No LinkedIn user ID");
    });
  });

  describe("verify", () => {
    it("returns published status", async () => {
      const result = await publisher.verify("target-1", "urn:li:share:abc123");
      expect(result.status).toBe("published");
      expect(result.platformRef).toBe("urn:li:share:abc123");
    });
  });
});
