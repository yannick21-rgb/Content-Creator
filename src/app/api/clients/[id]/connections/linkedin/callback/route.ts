import { NextRequest } from "next/server";
import { completeOAuthCallback } from "@/lib/oauth/completeFlow";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return completeOAuthCallback(req, "linkedin", id);
}
