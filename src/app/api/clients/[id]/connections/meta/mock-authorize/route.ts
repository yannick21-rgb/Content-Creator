import { NextRequest } from "next/server";
import { mockAuthorize } from "@/lib/oauth/completeFlow";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return mockAuthorize(req, "meta", id);
}
