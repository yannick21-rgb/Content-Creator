import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId, HttpError } from "@/lib/clients";
import { getScheduledPosts } from "@/lib/posts";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }
    const posts = await getScheduledPosts(activeClientId);
    return NextResponse.json(posts, { status: 200 });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
