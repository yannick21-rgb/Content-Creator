import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, getActiveClientId } from "@/lib/clients";
import { brandVoice } from "@/lib/db/schema";
import { getAiProvider } from "@/lib/ai";
import { initializeGemini, setGeminiApiKey } from "@/lib/ai/gemini";
import { eq } from "drizzle-orm";
import { z } from "zod";

const generationSchema = z.object({
  post: z.object({
    title: z.string().optional(),
    text: z.string().optional(),
  }),
  platform: z.string().optional(),
  mode: z.enum(["generate", "improve"]).optional().default("generate"),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = generationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { post, platform, mode } = parsed.data;
    const aiMode = process.env.AI_MODE ?? "mock";

    if (aiMode === "gemini") {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return NextResponse.json(
          { error: "Gemini API key not configured" },
          { status: 503 },
        );
      }
      await setGeminiApiKey(geminiApiKey);
    }

    const aiProvider = getAiProvider(aiMode === "gemini" ? "gemini" : "mock");

    const brandVoiceProfile = await db.select().from(brandVoice).where(eq(brandVoice.clientId, activeClientId));
    const voiceData = brandVoiceProfile[0];
    const tone = voiceData?.tone || "professional";

    let result;
    if (mode === "improve") {
      const prompt = post.text || "";
      result = await aiProvider.improve(prompt, { tone, platform });
    } else {
      result = await aiProvider.generate(post, { tone, platform });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.includes("Gemini")) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error("AI generation error:", e);
    throw e;
  }
}

export async function GET() {
  try {
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ status: "error", timestamp: new Date().toISOString() }, { status: 500 });
  }
}
