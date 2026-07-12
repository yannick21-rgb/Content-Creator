import type { PublishPlatform } from "@/lib/publish/provider";

export interface AiProvider {
  generate(post: unknown, options: unknown): Promise<unknown>;
  improve(text: string, options: unknown): Promise<unknown>;
  platform?: PublishPlatform;
}

export type AiModel = "mock" | "gemini";
