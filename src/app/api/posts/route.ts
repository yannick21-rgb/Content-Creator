// src/app/api/posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId } from "@/lib/clients";
import { createPost, listPosts } from "@/lib/posts";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    const posts = await listPosts({ clientId: activeClientId });
    return NextResponse.json(posts, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    const { text, title } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Post text is required" }, { status: 400 });
    }

    const post = await createPost({ text, title, clientId: activeClientId, mediaIds: [] });
    return NextResponse.json(post, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
