import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./clients";

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input", issues: e.issues },
      { status: 400 },
    );
  }
  console.error(e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
