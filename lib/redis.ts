import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function getRedisClient(): Redis {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Missing Upstash Redis environment variables.");
  }

  client = new Redis({ url, token });
  return client;
}

/** Lazy Redis client — avoids throwing during `next build` module evaluation. */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    const instance = getRedisClient();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});
