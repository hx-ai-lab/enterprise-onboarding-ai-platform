import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { AgentRunLog } from "@/lib/types";

export type StorageMode = "redis" | "demo-file";

export class StorageUnavailableError extends Error {
  constructor(message = "持久化存储当前不可用,本次操作未保存,请稍后重试。") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

export interface RuntimeStorage {
  readonly mode: StorageMode;
  hashGetAll<T>(key: string): Promise<Record<string, T>>;
  hashSet<T>(key: string, field: string, value: T): Promise<void>;
  hashDelete(key: string, field: string): Promise<void>;
  setMembers(key: string): Promise<string[]>;
  saveAndRestore<T>(hashKey: string, tombstonesKey: string, field: string, value: T): Promise<void>;
  deleteOverrideAndMark(hashKey: string, tombstonesKey: string, field: string): Promise<void>;
  appendRunLog(keys: RunLogKeys, log: AgentRunLog, maxLogs: number): Promise<void>;
  getRunLogs(keys: RunLogKeys, agentId?: string): Promise<AgentRunLog[]>;
}

export type RunLogKeys = {
  items: string;
  all: string;
  byAgent: (agentId: string) => string;
};

function environmentName(): string {
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  if (process.env.STORAGE_NAMESPACE?.trim()) return process.env.STORAGE_NAMESPACE.trim();
  return "development";
}

export function storageKey(suffix: string): string {
  return `onboardops:v1:${environmentName()}:${suffix}`;
}

function storageCause(): StorageUnavailableError {
  return new StorageUnavailableError();
}

class RedisStorage implements RuntimeStorage {
  readonly mode = "redis" as const;
  constructor(private readonly redis: Redis) {}

  async hashGetAll<T>(key: string): Promise<Record<string, T>> {
    try {
      return (await this.redis.hgetall<Record<string, T>>(key)) ?? {};
    } catch {
      throw storageCause();
    }
  }

  async hashSet<T>(key: string, field: string, value: T): Promise<void> {
    try {
      await this.redis.hset(key, { [field]: value });
    } catch {
      throw storageCause();
    }
  }

  async hashDelete(key: string, field: string): Promise<void> {
    try {
      await this.redis.hdel(key, field);
    } catch {
      throw storageCause();
    }
  }

  async setMembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key);
    } catch {
      throw storageCause();
    }
  }

  async saveAndRestore<T>(hashKey: string, tombstonesKey: string, field: string, value: T): Promise<void> {
    try {
      await this.redis.multi().hset(hashKey, { [field]: value }).srem(tombstonesKey, field).exec();
    } catch {
      throw storageCause();
    }
  }

  async deleteOverrideAndMark(hashKey: string, tombstonesKey: string, field: string): Promise<void> {
    try {
      await this.redis.multi().hdel(hashKey, field).sadd(tombstonesKey, field).exec();
    } catch {
      throw storageCause();
    }
  }

  async appendRunLog(keys: RunLogKeys, log: AgentRunLog, maxLogs: number): Promise<void> {
    try {
      const score = Date.parse(log.created_at);
      await this.redis
        .multi()
        .hset(keys.items, { [log.id]: log })
        .zadd(keys.all, { score, member: log.id })
        .zadd(keys.byAgent(log.agent_id), { score, member: log.id })
        .exec();

      const overflow = await this.redis.zrange<string[]>(keys.all, 0, -(maxLogs + 1));
      if (overflow.length === 0) return;

      const stored =
        (await this.redis.hmget<Record<string, AgentRunLog>>(keys.items, ...overflow)) ?? {};
      const tx = this.redis.multi().hdel(keys.items, ...overflow).zrem(keys.all, ...overflow);
      for (const id of overflow) {
        const entry = stored[id];
        if (entry) tx.zrem(keys.byAgent(entry.agent_id), id);
      }
      await tx.exec();
    } catch {
      throw storageCause();
    }
  }

  async getRunLogs(keys: RunLogKeys, agentId?: string): Promise<AgentRunLog[]> {
    try {
      const index = agentId ? keys.byAgent(agentId) : keys.all;
      const ids = await this.redis.zrange<string[]>(index, 0, -1, { rev: true });
      if (ids.length === 0) return [];
      const logs = (await this.redis.hmget<Record<string, AgentRunLog>>(keys.items, ...ids)) ?? {};
      return ids.flatMap((id) => (logs[id] ? [logs[id]] : []));
    } catch {
      throw storageCause();
    }
  }
}

type DemoState = {
  hashes: Record<string, Record<string, unknown>>;
  sets: Record<string, string[]>;
  logs: Record<string, AgentRunLog>;
};

const EMPTY_STATE: DemoState = { hashes: {}, sets: {}, logs: {} };

class DemoFileStorage implements RuntimeStorage {
  readonly mode = "demo-file" as const;
  private readonly filename = path.join(process.cwd(), ".data", "runtime-state.json");
  private queue: Promise<unknown> = Promise.resolve();

  private locked<T>(operation: (state: DemoState) => Promise<T> | T): Promise<T> {
    const next = this.queue.then(async () => {
      let state: DemoState;
      try {
        state = JSON.parse(await fs.readFile(this.filename, "utf-8")) as DemoState;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        state = structuredClone(EMPTY_STATE);
      }
      const result = await operation(state);
      await fs.mkdir(path.dirname(this.filename), { recursive: true });
      await fs.writeFile(this.filename, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  hashGetAll<T>(key: string): Promise<Record<string, T>> {
    return this.locked((state) => ({ ...(state.hashes[key] ?? {}) }) as Record<string, T>);
  }
  hashSet<T>(key: string, field: string, value: T): Promise<void> {
    return this.locked((state) => {
      (state.hashes[key] ??= {})[field] = value;
    });
  }
  hashDelete(key: string, field: string): Promise<void> {
    return this.locked((state) => {
      delete (state.hashes[key] ?? {})[field];
    });
  }
  setMembers(key: string): Promise<string[]> {
    return this.locked((state) => [...(state.sets[key] ?? [])]);
  }
  saveAndRestore<T>(hashKey: string, tombstonesKey: string, field: string, value: T): Promise<void> {
    return this.locked((state) => {
      (state.hashes[hashKey] ??= {})[field] = value;
      state.sets[tombstonesKey] = (state.sets[tombstonesKey] ?? []).filter((item) => item !== field);
    });
  }
  deleteOverrideAndMark(hashKey: string, tombstonesKey: string, field: string): Promise<void> {
    return this.locked((state) => {
      delete (state.hashes[hashKey] ?? {})[field];
      const members = new Set(state.sets[tombstonesKey] ?? []);
      members.add(field);
      state.sets[tombstonesKey] = [...members];
    });
  }
  appendRunLog(_keys: RunLogKeys, log: AgentRunLog, maxLogs: number): Promise<void> {
    return this.locked((state) => {
      state.logs[log.id] = log;
      const sorted = Object.values(state.logs).sort((a, b) => b.created_at.localeCompare(a.created_at));
      for (const stale of sorted.slice(maxLogs)) delete state.logs[stale.id];
    });
  }
  getRunLogs(_keys: RunLogKeys, agentId?: string): Promise<AgentRunLog[]> {
    return this.locked((state) =>
      Object.values(state.logs)
        .filter((log) => !agentId || log.agent_id === agentId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }
}

let singleton: RuntimeStorage | null = null;

export function getRuntimeStorage(): RuntimeStorage {
  if (singleton) return singleton;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    singleton = new RedisStorage(new Redis({ url, token }));
    return singleton;
  }

  if (process.env.VERCEL || process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    throw new StorageUnavailableError("持久化存储未正确配置,Production/Preview 环境拒绝使用临时存储。");
  }

  console.warn("[storage] Redis is not configured; using local demo-file storage (.data/runtime-state.json).");
  singleton = new DemoFileStorage();
  return singleton;
}
