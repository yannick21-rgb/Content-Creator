import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId } from "@/lib/clients";
import { getPostWithTargets } from "@/lib/posts";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(_req.headers);
    const activeClientId = await getActiveClientId(_req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }
    const { id } = await params;
    const post = await getPostWithTargets(id, activeClientId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const targets = (post.publishTargets || []).map((t: any) => ({
      id: t.id,
      socialAccountId: t.socialAccountId,
      socialAccountName: t.socialAccount?.name ?? null,
      status: t.status,
      errorMessage: t.errorMessage,
      publishedAt: t.publishedAt?.toISOString() ?? null,
    }));
    return NextResponse.json({
      id: post.id,
      status: post.status,
      targets,
      allPublished: targets.every((t: any) => t.status === "published"),
      anyFailed: targets.some((t: any) => t.status === "failed"),
    }, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
