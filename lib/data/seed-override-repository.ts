import { readCollection } from "@/lib/data/json-store";
import { getRuntimeStorage, storageKey } from "@/lib/storage/runtime-storage";

type Entity = { id: string; created_at: string; updated_at: string };

export class SeedOverrideRepository<T extends Entity> {
  private readonly overridesKey: string;
  private readonly customKey: string;
  private readonly tombstonesKey: string;

  constructor(private readonly filename: string, namespace: string) {
    this.overridesKey = storageKey(`${namespace}:overrides`);
    this.customKey = storageKey(`${namespace}:custom`);
    this.tombstonesKey = storageKey(`${namespace}:tombstones`);
  }

  private seed(): Promise<T[]> {
    return readCollection<T>(this.filename);
  }

  async getAll(): Promise<T[]> {
    const storage = getRuntimeStorage();
    const [seed, overrides, custom, tombstones] = await Promise.all([
      this.seed(),
      storage.hashGetAll<T>(this.overridesKey),
      storage.hashGetAll<T>(this.customKey),
      storage.setMembers(this.tombstonesKey),
    ]);
    const deleted = new Set(tombstones);
    const seedIds = new Set(seed.map((item) => item.id));
    const merged = seed
      .filter((item) => !deleted.has(item.id))
      .map((item) => ({ ...item, ...overrides[item.id], id: item.id }));
    const additions = Object.values(custom)
      .filter((item) => !seedIds.has(item.id) && !deleted.has(item.id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return [...merged, ...additions];
  }

  async getById(id: string): Promise<T | null> {
    return (await this.getAll()).find((item) => item.id === id) ?? null;
  }

  async create(entity: T): Promise<T> {
    const storage = getRuntimeStorage();
    if (await this.getById(entity.id)) throw new Error(`对象 ID 已存在:${entity.id}`);
    await storage.hashSet(this.customKey, entity.id, entity);
    return entity;
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const [existing, seed] = await Promise.all([this.getById(id), this.seed()]);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id, updated_at: new Date().toISOString() } as T;
    const storage = getRuntimeStorage();
    const isSeed = seed.some((item) => item.id === id);
    if (isSeed) {
      await storage.saveAndRestore(this.overridesKey, this.tombstonesKey, id, updated);
    } else {
      await storage.hashSet(this.customKey, id, updated);
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const [existing, seed] = await Promise.all([this.getById(id), this.seed()]);
    if (!existing) return false;
    const storage = getRuntimeStorage();
    if (seed.some((item) => item.id === id)) {
      await storage.deleteOverrideAndMark(this.overridesKey, this.tombstonesKey, id);
    } else {
      await storage.hashDelete(this.customKey, id);
    }
    return true;
  }
}
