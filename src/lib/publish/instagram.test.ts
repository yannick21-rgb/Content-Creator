import { describe, it, expect, vi, beforeEach } from "vitest";
import { InstagramPublisher } from "./instagram";

describe("InstagramPublisher (PUBL-01, PUBL-02)", () => {
  let publisher: InstagramPublisher;

  beforeEach(() => {
    publisher = new InstagramPublisher();
    vi.restoreAllMocks();
  });

  describe("prepare", () => {
    it("returns ready for valid image post", async () => {
      const result = await publisher.prepare(
        {
          text: "Hello Instagram",
          media: [{ contentType: "image/jpeg", publicUrl: "https://r2.example.com/ig.jpg" }],
        },
        {},
      );
      expect(result.ready).toBe(true);
    });

    it("returns ready for valid carousel (3 images)", async () => {
      const result = await publisher.prepare(
        {
          text: "Carousel post",
          media: [
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/1.jpg" },
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/2.jpg" },
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/3.jpg" },
          ],
        },
        {},
      );
      expect(result.ready).toBe(true);
    });

    it("rejects caption over 2200 chars", async () => {
      const result = await publisher.prepare(
        {
          text: "x".repeat(2201),
          media: [{ contentType: "image/jpeg", publicUrl: "https://r2.example.com/ig.jpg" }],
        },
        {},
      );
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("Instagram caption exceeds 2,200 character limit");
    });

    it("rejects carousel with 11 items", async () => {
      const media = Array.from({ length: 11 }, (_, i) => ({
        contentType: "image/jpeg",
        publicUrl: `https://r2.example.com/${i}.jpg`,
      }));
      const result = await publisher.prepare({ text: "Carousel", media }, {});
      expect(result.ready).toBe(false);
      expect(result.errors).toContain("IG carousel supports 2-10 items");
    });

    it("rejects carousel with non-image items", async () => {
      const result = await publisher.prepare(
        {
          text: "Carousel",
          media: [
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/1.jpg" },
            { contentType: "video/mp4", publicUrl: "https://r2.example.com/vid.mp4" },
          ],
        },
        {},
      );
      expect(result.ready).toBe(false);
    });

    it("rejects post without media on IG", async () => {
      const result = await publisher.prepare(
        { text: "Text only", media: [] },
        {},
      );
      expect(result.ready).toBe(false);
    });
  });

  describe("publish", () => {
    it("publishes single image successfully", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ json: () => Promise.resolve({ id: "container_123" }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ id: "ig_media_456" }) });

      const result = await publisher.publish(
        {
          text: "IG post",
          media: [{ contentType: "image/jpeg", publicUrl: "https://r2.example.com/ig.jpg" }],
        },
        { socialAccount: { platformAccountId: "ig_user_123" } },
        { accessToken: "valid_token", platform: "instagram" },
      );
      expect(result.success).toBe(true);
      expect(result.platformRef).toBe("ig_media_456");
    });

    it("publishes carousel successfully", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ json: () => Promise.resolve({ id: "child_1" }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ id: "child_2" }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ id: "child_3" }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ id: "carousel_container" }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ id: "ig_media_789" }) });

      const result = await publisher.publish(
        {
          text: "Carousel post",
          media: [
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/1.jpg" },
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/2.jpg" },
            { contentType: "image/jpeg", publicUrl: "https://r2.example.com/3.jpg" },
          ],
        },
        { socialAccount: { platformAccountId: "ig_user_123" } },
        { accessToken: "valid_token", platform: "instagram" },
      );
      expect(result.success).toBe(true);
      expect(result.platformRef).toBe("ig_media_789");
    });

    it("returns error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ error: { message: "Invalid token" } }),
      });
      const result = await publisher.publish(
        {
          text: "IG post",
          media: [{ contentType: "image/jpeg", publicUrl: "https://r2.example.com/ig.jpg" }],
        },
        { socialAccount: { platformAccountId: "ig_user_123" } },
        { accessToken: "bad_token", platform: "instagram" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("verify", () => {
    it("returns published status", async () => {
      const result = await publisher.verify("target-1", "ig_ref_123");
      expect(result.status).toBe("published");
      expect(result.platformRef).toBe("ig_ref_123");
    });
  });
});
