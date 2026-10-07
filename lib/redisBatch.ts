import { redis } from "@/lib/redis";

export const REDIS_MGET_CHUNK = 500;
export const REDIS_SADD_CHUNK = 500;

export async function redisMgetChunks<T>(keys: string[]): Promise<(T | null)[]> {
  const results: (T | null)[] = [];
  if (!keys.length) return results;

  for (let i = 0; i < keys.length; i += REDIS_MGET_CHUNK) {
    const chunk = keys.slice(i, i + REDIS_MGET_CHUNK);
    const rows = (await redis.mget<(T | null)[]>(...chunk)) || [];
    results.push(...rows);
  }

  return results;
}

export async function redisSaddChunks(indexKey: string, members: string[]) {
  const unique = [...new Set(members.map((m) => String(m || "").trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += REDIS_SADD_CHUNK) {
    const chunk = unique.slice(i, i + REDIS_SADD_CHUNK);
    if (chunk.length) await redis.sadd(indexKey, ...chunk);
  }
}
