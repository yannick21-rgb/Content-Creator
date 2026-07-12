// src/app/api/media/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId, HttpError } from "@/lib/clients";
import { generateUploadUrl } from "@/lib/r2";
import { insertMedia } from "@/lib/media";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }

    const { contentType, fileName } = await req.json();
    if (!contentType || !fileName) {
      return NextResponse.json({ error: "Missing content-type or filename" }, { status: 400 });
    }

    const allowed = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
    ];
    if (!allowed.includes(contentType)) {
      return NextResponse.json({ error: `Unsupported media type ${contentType}` }, { status: 400 });
    }

    const { presignedUrl, key, clientId, contentType: resultContentType } = await generateUploadUrl({
      clientId: activeClientId,
      contentType,
      fileName,
      userId,
    });

    const mediaRow = await insertMedia({
      clientId,
      key,
      publicUrl: `https://pub-${clientId}.r2.dev/${key}`,
      contentType: resultContentType,
      userId,
    });

    return NextResponse.json({
      success: true,
      presignedUrl,
      key,
      publicUrl: mediaRow.publicUrl,
      clientId: mediaRow.clientId,
      contentType: mediaRow.contentType,
    }, { status: 200 });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
