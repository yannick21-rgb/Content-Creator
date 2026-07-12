import type { AiProvider, AiModel } from "./provider";
import { MockAiProvider, GeminiAiProvider, getAiProvider as getGeminiAiProvider, initializeGemini, setGeminiApiKey } from "./gemini";
import type { PublishPlatform } from "@/lib/publish/provider";

export function getAiProvider(model?: AiModel): AiProvider {
  const aiMode = process.env.AI_MODE ?? "mock";

  if (aiMode === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key required when AI_MODE=gemini. Set GEMINI_API_KEY env var.");
    }
    return new GeminiAiProvider();
  }

  return new MockAiProvider();
}

export { MockAiProvider, GeminiAiProvider, initializeGemini, setGeminiApiKey };
