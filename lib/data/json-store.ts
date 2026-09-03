import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "mock-data");

// Per-file promise chain so concurrent API requests never interleave a
// read-modify-write cycle against the same JSON file.
const queues = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const settled = prev.then(fn, fn);
  // Keep the queue alive even if this step rejected, so later callers aren't stuck.
  queues.set(
    key,
    settled.catch(() => undefined),
  );
  return settled;
}

async function readFile<T>(filename: string): Promise<T> {
  const filePath = path.join(DATA_DIR, filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function writeFile<T>(filename: string, data: T): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/** Read the full contents of a mock-data JSON collection file. */
export function readCollection<T>(filename: string): Promise<T[]> {
  return withLock(filename, () => readFile<T[]>(filename));
}

/** Read a single mock-data JSON object file (non-array). */
export function readDocument<T>(filename: string): Promise<T> {
  return withLock(filename, () => readFile<T>(filename));
}

/**
 * Read-modify-write a collection file under the file's lock, so the update
 * always applies to the latest data even under concurrent requests.
 */
export function updateCollection<T>(
  filename: string,
  updater: (data: T[]) => T[] | Promise<T[]>,
): Promise<T[]> {
  return withLock(filename, async () => {
    const data = await readFile<T[]>(filename);
    const next = await updater(data);
    await writeFile(filename, next);
    return next;
  });
}
