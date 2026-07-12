import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId } from "@/lib/clients";
import { getScheduledPosts } from "@/lib/posts";

export async function GET(_req: NextRequest) {
  try {
    const userId = await requireUser();
    const activeClientId = await getActiveClientId();
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }
    const posts = await getScheduledPosts(activeClientId);
    return NextResponse.json(posts, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
