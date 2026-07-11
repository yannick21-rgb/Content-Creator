// src/app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId } from "@/lib/clients";
import { getPost, updatePost } from "@/lib/posts";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    const { id } = await params;
    const post = await getPost({ id, clientId: activeClientId });

    if (!post) {
      return NextResponse.json({ error: "Post not found or access denied" }, { status: 404 });
    }

    return NextResponse.json(post, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    const { id } = await params;
    const { text, title, mediaIds } = await req.json();

    const updated = await updatePost({ id, clientId: activeClientId, text, title, mediaIds });
    if (!updated) {
      return NextResponse.json({ error: "Post not found or access denied" }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
