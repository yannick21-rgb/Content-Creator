import { describe, it, expect, vi, beforeEach } from "vitest";
import { MetaPublisher } from "./meta";

describe("MetaPublisher (PUBL-01, PUBL-02)", () => {
  let publisher: MetaPublisher;

  beforeEach(() => {
    publisher = new MetaPublisher();
    vi.restoreAllMocks();
  });

  describe("prepare", () => {
    it("returns ready for valid text-only post", async () => {
      const result = await publisher.prepare(
        { text: "Hello Facebook", media: [] },
        {},
      );
      expect(result.ready).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("returns ready for valid post with media", async () => {
      const result = await publisher.prepare(
        {
          text: "Hello Facebook",
          media: [{ contentType: "image/jpeg", publicUrl: "https://r2.example.com/photo.jpg" }],
        },
        {},
      );
      expect(result.ready).toBe(true);
    });

    it("rejects empty post with no text and no media", async () => {
      const result = await publisher.prepare({ text: "", media: [] }, {});
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("Post must have text or media");
    });

    it("rejects over-length caption", async () => {
      const result = await publisher.prepare(
        { text: "x".repeat(63207), media: [] },
        {},
      );
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("Facebook caption exceeds 63,206 character limit");
    });

    it("rejects video without public URL", async () => {
      const result = await publisher.prepare(
        {
          text: "Video post",
          media: [{ contentType: "video/mp4", publicUrl: "" }],
        },
        {},
      );
      expect(result.ready).toBe(false);
    });
  });

  describe("publish", () => {
    it("returns success for text-only post with valid token", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ id: "fb_post_id_123" }),
      });
      const result = await publisher.publish(
        { text: "Hello Facebook", media: [] },
        { socialAccount: { platformAccountId: "page_123" } },
        { accessToken: "valid_token", platform: "meta" },
      );
      expect(result.success).toBe(true);
      expect(result.platformRef).toBe("fb_post_id_123");
    });

    it("returns error when Meta API returns error", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ error: { message: "Invalid page token" } }),
      });
      const result = await publisher.publish(
        { text: "Hello", media: [] },
        { socialAccount: { platformAccountId: "page_123" } },
        { accessToken: "bad_token", platform: "meta" },
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid page token");
    });
  });

  describe("verify", () => {
    it("returns published status", async () => {
      const result = await publisher.verify("target-1", "fb_ref_123");
      expect(result.status).toBe("published");
      expect(result.platformRef).toBe("fb_ref_123");
    });
  });
});
