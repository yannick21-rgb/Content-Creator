import IORedis from "ioredis";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return url;
}

const globalForRedis = globalThis as unknown as {
  __redis?: IORedis;
};

const redis =
  globalForRedis.__redis ??
  new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.__redis = redis;
}

export { redis };
export default redis;
