import { promises as fs } from "node:fs";
import path from "node:path";

/** Read a bundled demo collection. Seed JSON is intentionally read-only. */
export async function readCollection<T>(filename: string): Promise<T[]> {
  const raw = await fs.readFile(path.join(process.cwd(), "mock-data", filename), "utf-8");
  return JSON.parse(raw) as T[];
}

/** Read a bundled demo document. Seed JSON is intentionally read-only. */
export async function readDocument<T>(filename: string): Promise<T> {
  const raw = await fs.readFile(path.join(process.cwd(), "mock-data", filename), "utf-8");
  return JSON.parse(raw) as T;
}
