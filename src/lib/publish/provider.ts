export type PublishPlatform = "meta" | "linkedin" | "instagram" | "fake";

export interface PublishContext {
  accessToken: string;
  platform: PublishPlatform;
  [key: string]: unknown;
}

export interface PrepareResult {
  ready: boolean;
  errors?: string[];
}

export interface PublishResult {
  success: boolean;
  platformRef?: string;
  error?: string;
}

export interface VerifyResult {
  status: "published" | "pending" | "failed";
  platformRef?: string;
}

export interface Publisher {
  platform: PublishPlatform;
  prepare(post: unknown, target: unknown): Promise<PrepareResult>;
  publish(post: unknown, target: unknown, context: PublishContext): Promise<PublishResult>;
  verify(targetId: string, platformRef: string): Promise<VerifyResult>;
}
