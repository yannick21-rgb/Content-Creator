export interface AiProvider {
  generate(post: unknown, options: unknown): Promise<unknown>;
  improve(text: string, options: unknown): Promise<unknown>;
  platform?: string;
}

export type AiModel = "mock" | "gemini";
