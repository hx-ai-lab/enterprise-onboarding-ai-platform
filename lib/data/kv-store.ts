import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import { readCollection as readJsonCollection, updateCollection as updateJsonCollection } from "@/lib/data/json-store";

// Runtime-mutable collections (Skills/Tools/Agents/logs) need real
// cross-request persistence, which the local-JSON approach in json-store.ts
// cannot provide on Vercel's serverless platform: different requests can be
// routed to different execution instances that don't share `/tmp`, so a
// write from one instance is invisible to a read served by another, even
// without a redeploy.
//
// This module stores those collections in Upstash Redis (via the Vercel
// Marketplace "Upstash for Redis" integration, or a standalone Upstash
// database) when credentials are present, and transparently falls back to
// the existing local-JSON behavior (lib/data/json-store.ts) when they are
// not — so local dev with no Redis configured keeps working exactly as
// before. Read-only reference data (employees/tasks/contacts/policies/
// trainings) intentionally stays on json-store.ts directly and never goes
// through this module.

// Vercel's "Upstash for Redis" Marketplace integration injects
// KV_REST_API_URL / KV_REST_API_TOKEN (the legacy Vercel KV env var names,
// kept for compatibility). A standalone Upstash database instead uses
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. Accept either.
function resolveRedisConfig(): { url: string; token: string } | null {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)?.trim();
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)?.trim();
  return url && token ? { url, token } : null;
}

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const config = resolveRedisConfig();
  redisClient = config ? new Redis(config) : null;
  return redisClient;
}

export function isKvConfigured(): boolean {
  return getRedis() !== null;
}

const KEY_PREFIX = "onboardops:";

// Seed content for a Redis key that doesn't exist yet comes from the
// committed mock-data/*.json file bundled with the deployment (read-only,
// same file the json-store fallback would have used).
async function readSeed<T>(filename: string): Promise<T> {
  const raw = await fs.readFile(path.join(process.cwd(), "mock-data", filename), "utf-8");
  return JSON.parse(raw) as T;
}

async function loadCollection<T>(redis: Redis, filename: string): Promise<T[]> {
  const key = KEY_PREFIX + filename;
  const existing = await redis.get<T[]>(key);
  if (existing !== null && existing !== undefined) return existing;
  const seed = await readSeed<T[]>(filename);
  await redis.set(key, seed);
  return seed;
}

// Per-file promise chain so concurrent requests served by the *same*
// instance never interleave a read-modify-write cycle. This does not
// protect against two different instances writing concurrently (Redis has
// no equivalent of the old in-process lock across instances), but for this
// app's scale a plain last-write-wins is an acceptable tradeoff, and it is
// strictly better than the previous per-instance-only persistence.
const queues = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const settled = prev.then(fn, fn);
  queues.set(
    key,
    settled.catch(() => undefined),
  );
  return settled;
}

/** Read the full contents of a runtime-mutable collection (Skills/Tools/Agents/logs). */
export function readCollection<T>(filename: string): Promise<T[]> {
  const redis = getRedis();
  if (!redis) return readJsonCollection<T>(filename);
  return withLock(filename, () => loadCollection<T>(redis, filename));
}

/**
 * Read-modify-write a collection under the file's lock, so the update
 * always applies to the latest data available to this instance.
 */
export function updateCollection<T>(
  filename: string,
  updater: (data: T[]) => T[] | Promise<T[]>,
): Promise<T[]> {
  const redis = getRedis();
  if (!redis) return updateJsonCollection<T>(filename, updater);
  return withLock(filename, async () => {
    const data = await loadCollection<T>(redis, filename);
    const next = await updater(data);
    await redis.set(KEY_PREFIX + filename, next);
    return next;
  });
}
