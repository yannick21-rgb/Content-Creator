import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function GET() {
  try {
    const userId = "health-check"; // Note: This endpoint should be protected
    const redisPing = await redis.ping();
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      redis: redisPing === "PONG" ? "connected" : "disconnected",
      version: process.env.npm_package_version || "0.1.0",
      uptime: Math.floor(process.uptime ? process.uptime() : Date.now()),
    };
    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    const health = {
      status: "error",
      timestamp: new Date().toISOString(),
      redis: "unknown",
      error: "Health check failed",
    };
    return NextResponse.json(health, { status: 500 });
  }
}
