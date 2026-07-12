// src/app/api/posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId, HttpError } from "@/lib/clients";
import { createPost, listPosts } from "@/lib/posts";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }
    const posts = await listPosts({ clientId: activeClientId });
    return NextResponse.json(posts, { status: 200 });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }
    const { text, title } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Post text is required" }, { status: 400 });
    }

    const post = await createPost({ text, title, clientId: activeClientId, mediaIds: [] });
    return NextResponse.json(post, { status: 201 });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
