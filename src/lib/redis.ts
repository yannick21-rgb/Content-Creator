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

function ensureRedis(): IORedis {
  if (!globalForRedis.__redis) {
    globalForRedis.__redis = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      // Avoid infinite reconnection floods when Redis is down.
      // BullMQ handles its own retries; IORedis should not queue forever.
      retryStrategy(times: number) {
        if (times > 20) return null; // give up after ~20 retries
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
      ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
    });
  }
  return globalForRedis.__redis;
}

// Lazy proxy: connection is established on the first property access, not at
// import time. This allows `next build` to succeed without a running Redis.
export const redis = new Proxy<IORedis>({} as IORedis, {
  get(_, prop) {
    const real = ensureRedis();
    const value = (real as any)[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export default redis;
