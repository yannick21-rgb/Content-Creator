import type { Publisher, PublishPlatform, PrepareResult, PublishResult, VerifyResult, PublishContext } from "./provider";

export class FakePublisher implements Publisher {
  constructor(public platform: PublishPlatform = "fake") {}

  async prepare(_post: unknown, _target: unknown): Promise<PrepareResult> {
    return { ready: true };
  }

  async publish(_post: unknown, _target: unknown, _context: PublishContext): Promise<PublishResult> {
    return { success: true, platformRef: "fake-ref-123" };
  }

  async verify(_targetId: string, _platformRef: string): Promise<VerifyResult> {
    return { status: "published" };
  }
}
