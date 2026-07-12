import type { AiProvider, AiModel } from "./provider";

let genai: any = null;
let apiKey: string | undefined = undefined;
let baseUrl: string | undefined = undefined;

export async function initializeGemini(apiKeyParam?: string, baseUrlParam?: string) {
  try {
    if (apiKeyParam && genai === null) {
      const { GoogleGenAI } = await import("@google/genai");
      genai = new GoogleGenAI({ apiKey: apiKeyParam });
      apiKey = apiKeyParam;
      baseUrl = baseUrlParam;
    }
  } catch (e) {
    console.error("Failed to initialize Gemini:", e);
    throw e;
  }
}

export async function setGeminiApiKey(apiKeyParam: string) {
  apiKey = apiKeyParam;
  await initializeGemini(apiKeyParam);
}

class MockAiProvider implements AiProvider {
  platform: string = "mock";

  async generate(post: any, options: any): Promise<any> {
    const { platform = "meta", tone = "professional", maxLength = 1000 } = options;
    const platformLimits = {
      meta: 63206,
      instagram: 2200,
      linkedin: 700,
    };
    const finalMaxLength = maxLength || platformLimits[platform as keyof typeof platformLimits] || 1000;

    let seed = 0;
    const shuffle = (arr: string[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    };

    const prompts = {
      professional: [
        "Write a professional LinkedIn post about career growth and industry trends.",
        "Create a formal business announcement for a company update.",
        "Draft a corporate email introducing a new product feature.",
      ],
      casual: [
        "Write a casual Instagram post about daily life and experiences.",
        "Create a friendly Facebook post about personal achievements.",
        "Draft a relaxed tweet about weekend plans.",
      ],
      humorous: [
        "Write a funny LinkedIn post about office humor.",
        "Create a humorous Instagram caption for a weird cat photo.",
        "Draft a joke-filled Facebook status about Mondays.",
      ],
    };

    const selectedPrompts = prompts[tone as keyof typeof prompts] || prompts.professional;
    const prompt = selectedPrompts[Math.floor(Math.random() * selectedPrompts.length)];
    const words = prompt.split(" ");
    let result = words[seed] || "Generated content here";

    for (let i = 1; i < Math.min(words.length, 20); i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const insertPos = Math.floor((seed / 233280) * i);
      words.splice(insertPos, 0, words[i]);
    }

    result = words.join(" ").substring(0, finalMaxLength);

    return {
      content: result,
      platform: platform as string,
      tone,
      length: result.length,
      generatedAt: new Date().toISOString(),
    };
  }

  async improve(text: string, options: any): Promise<any> {
    const { tone = "professional" } = options;
    const improvements = {
      professional: [
        " Enhanced with industry-specific terminology and formal language.",
        " Improved with data-driven insights and professional tone.",
        " Polished with business-oriented vocabulary and structure.",
      ],
      casual: [
        " Made more conversational and relatable.",
        " Added personality and casual tone.",
        " Made it sound like a friend talking.",
      ],
      humorous: [
        " Added clever wordplay and jokes.",
        " Made it funnier and more engaging.",
        " Injecting humor and wit.",
      ],
    };

    const selectedImprovements = improvements[tone as keyof typeof improvements] || improvements.professional;
    const seed = Math.floor(Math.random() * selectedImprovements.length);

    let improvedText = text;
    if (text.length > 10) {
      const middlePos = Math.floor(text.length / 2);
      improvedText = text.substring(0, middlePos) + selectedImprovements[seed] + text.substring(middlePos);
    }

    return {
      content: improvedText,
      original: text,
      improvement: selectedImprovements[seed],
      generatedAt: new Date().toISOString(),
    };
  }
}

class GeminiAiProvider implements AiProvider {
  platform: string = "gemini";

  async generate(post: any, options: any): Promise<any> {
    const { platform = "meta", tone = "professional", length = "medium", characterLimit } = options;
    const platformLimits = {
      meta: 63206,
      instagram: 2200,
      linkedin: 700,
      fake: 1000,
    };
    const finalMaxLength = characterLimit || platformLimits[platform as keyof typeof platformLimits] || 1000;
    const targetModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const systemPrompt = `You are an AI assistant that creates social media posts. Tonalité: ${tone}. Plateforme cible: ${platform}. Longueur : ${length}. Limite de caractères : ${finalMaxLength}. Le texte d'entrée peut inclure un titre et un contenu principal (post text). Créez un seul bloc de texte cohérent adapté à la plateforme, respectant à la fois le ton et la limite de caractères. Répondez uniquement avec le texte final.`,
      userPrompt = `Titre: ${post.title || ""}
Texte: ${post.text || ""}

Générez un seul bloc de contenu optimal pour ${platform} (${tone}, ${length}, max ${finalMaxLength} caractères).`;

    if (!genai) {
      throw new Error("Gemini API not initialized. Call setGeminiApiKey() first.");
    }

    let resultText: string;
    let platformRef: string | undefined;

    try {
      const response = await genai.models.generateContent({
        model: targetModel,
        contents: [{ parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: Math.floor(finalMaxLength / 4),
        },
      });

      resultText = response.text?.trim() || "";

      if (!resultText) {
        throw new Error("Gemini returned empty response");
      }

      if (resultText.length > finalMaxLength) {
        resultText = resultText.substring(0, finalMaxLength).trim();
      }

      platformRef = `${platform}-gemini-${Date.now()}`;

      return {
        content: resultText,
        platform: platform as string,
        tone,
        length: resultText.length,
        model: targetModel,
        platformRef,
        generatedAt: new Date().toISOString(),
      };
    } catch (e: any) {
      if (e.message.includes("API key")) {
        throw new Error("Gemini API key missing or invalid");
      }
      if (e.message.includes("permission")) {
        throw new Error("Gemini API permission denied");
      }
      throw new Error(`Gemini generation failed: ${e.message}`);
    }
  }

  async improve(text: string, options: any): Promise<any> {
    const { platform = "meta", tone = "professional", characterLimit } = options;
    const platformLimits = {
      meta: 63206,
      instagram: 2200,
      linkedin: 700,
      fake: 1000,
    };
    const finalMaxLength = characterLimit || platformLimits[platform as keyof typeof platformLimits] || 1000;
    const targetModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const systemPrompt = `You are an AI assistant that improves existing text. Tonalité: ${tone}. Plateforme cible: ${platform}. Limite de caractères: ${finalMaxLength}. Améliorez le texte fourni en le reformulant avec le même sens mais avec un meilleur ton, plus de clarté, et une meilleure adaptation à la plateforme, tout en restant sous la limite. Répondez uniquement avec le texte amélioré.`,
      userPrompt = `Texte original: ${text}

Améliorez et reformulez ce texte (ton: ${tone}, plateforme: ${platform}, max ${finalMaxLength} caractères). Assurez-vous que le résultat est optimisé pour cette plateforme spécifique.`;

    if (!genai) {
      throw new Error("Gemini API not initialized. Call setGeminiApiKey() first.");
    }

    try {
      const response = await genai.models.generateContent({
        model: targetModel,
        contents: [{ parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: Math.floor(finalMaxLength / 4),
        },
      });

      let resultText = response.text?.trim() || "";

      if (!resultText) {
        throw new Error("Gemini returned empty response");
      }

      if (resultText.length > finalMaxLength) {
        resultText = resultText.substring(0, finalMaxLength).trim();
      }

      return {
        content: resultText,
        original: text,
        improvement: "Reformulated by Gemini AI",
        platform: platform as string,
        tone,
        length: resultText.length,
        model: targetModel,
        generatedAt: new Date().toISOString(),
      };
    } catch (e: any) {
      if (e.message.includes("API key")) {
        throw new Error("Gemini API key missing or invalid");
      }
      if (e.message.includes("permission")) {
        throw new Error("Gemini API permission denied");
      }
      throw new Error(`Gemini improvement failed: ${e.message}`);
    }
  }
}

export const MockAiProvider = MockAiProvider;
export const GeminiAiProvider = GeminiAiProvider;

export function getAiProvider(model?: AiModel): AiProvider {
  const aiMode = process.env.AI_MODE ?? "mock";

  if (aiMode === "gemini") {
    if (!apiKey) {
      throw new Error("Gemini API key required when AI_MODE=gemini. Set GEMINI_API_KEY env var.");
    }
    return new GeminiAiProvider();
  }

  return new MockAiProvider();
}
