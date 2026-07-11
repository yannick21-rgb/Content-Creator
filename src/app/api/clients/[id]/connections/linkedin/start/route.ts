import { NextRequest } from "next/server";
import { beginOAuthFlow } from "@/lib/oauth/beginFlow";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return beginOAuthFlow(req, "linkedin", id);
}
