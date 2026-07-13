import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { sql } from "drizzle-orm";

export async function GET() {
  const checks: Record<string, string> = {};
  let overallStatus = "ok";

  // Redis health
  try {
    const ping = await redis.ping();
    checks.redis = ping === "PONG" ? "connected" : "disconnected";
    if (checks.redis !== "connected") overallStatus = "degraded";
  } catch {
    checks.redis = "unreachable";
    overallStatus = "degraded";
  }

  // Postgres health
  try {
    await db.execute(sql`SELECT 1`);
    checks.postgres = "connected";
  } catch {
    checks.postgres = "unreachable";
    overallStatus = "degraded";
  }

  const body = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version ?? "0.1.0",
    checks,
  };

  return NextResponse.json(body, {
    status: overallStatus === "ok" ? 200 : 503,
  });
}
