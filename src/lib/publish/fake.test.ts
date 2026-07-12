import { describe, it, expect } from "vitest";
import { FakePublisher } from "./fake";

describe("FakePublisher (SCHD-02)", () => {
  const publisher = new FakePublisher();

  it("prepare returns ready", async () => {
    const result = await publisher.prepare({}, {});
    expect(result.ready).toBe(true);
  });

  it("publish returns success", async () => {
    const result = await publisher.publish({}, {}, { accessToken: "fake", platform: "fake" });
    expect(result.success).toBe(true);
    expect(result.platformRef).toBe("fake-ref-123");
  });

  it("verify returns published", async () => {
    const result = await publisher.verify("target-1", "fake-ref-123");
    expect(result.status).toBe("published");
  });
});
