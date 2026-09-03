import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// Serverless platforms (e.g. Vercel) deploy the project directory read-only
// at runtime, so writing straight to `mock-data/*.json` throws EROFS/EPERM.
// We probe once per warm instance: if the bundled directory isn't writable,
// fall back to a scratch copy under the OS tmp dir so reads/writes still
// work for the lifetime of that instance (mutations won't survive a cold
// start there — there is no real persistence without a real database — but
// the app no longer 500s on every action).
//
// The bundled-path branch below deliberately keeps `path.join(process.cwd(),
// "mock-data", filename)` written out as a literal expression right next to
// the fs call (rather than through a variable) so Next's build tracer can
// statically scope the deployed bundle to just that folder; the scratch
// branch reads/writes an OS tmp dir created at runtime, which isn't part of
// the source tree and needs no tracing.
let resolved = false;
let usingScratch = false;
let scratchDir: string | null = null;
let resolvingPromise: Promise<void> | null = null;

async function ensureResolved(): Promise<void> {
  if (resolved) return;
  if (resolvingPromise) return resolvingPromise;

  resolvingPromise = (async () => {
    const bundledDir = path.join(process.cwd(), "mock-data");
    const probePath = path.join(bundledDir, ".write-probe");
    try {
      await fs.writeFile(probePath, "ok", "utf-8");
      await fs.rm(probePath, { force: true });
    } catch {
      const dir = path.join(os.tmpdir(), "onboardops-mock-data");
      await fs.mkdir(dir, { recursive: true });
      const entries = await fs.readdir(bundledDir);
      await Promise.all(
        entries.map(async (name) => {
          const dest = path.join(dir, name);
          try {
            await fs.access(dest);
          } catch {
            await fs.copyFile(path.join(bundledDir, name), dest);
          }
        }),
      );
      console.warn(
        `[mock-data] "${bundledDir}" is not writable at runtime; using scratch copy at "${dir}" for this instance. Changes will not persist across cold starts.`,
      );
      usingScratch = true;
      scratchDir = dir;
    } finally {
      resolved = true;
    }
  })();

  return resolvingPromise;
}

async function readFile<T>(filename: string): Promise<T> {
  await ensureResolved();
  if (usingScratch && scratchDir) {
    // Runtime-only tmp path — nothing here needs to be in the deployed bundle.
    const raw = await fs.readFile(/*turbopackIgnore: true*/ path.join(scratchDir, filename), "utf-8");
    return JSON.parse(raw) as T;
  }
  const raw = await fs.readFile(path.join(process.cwd(), "mock-data", filename), "utf-8");
  return JSON.parse(raw) as T;
}

async function writeFile<T>(filename: string, data: T): Promise<void> {
  await ensureResolved();
  const content = JSON.stringify(data, null, 2) + "\n";
  if (usingScratch && scratchDir) {
    await fs.writeFile(/*turbopackIgnore: true*/ path.join(scratchDir, filename), content, "utf-8");
    return;
  }
  await fs.writeFile(path.join(process.cwd(), "mock-data", filename), content, "utf-8");
}

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
