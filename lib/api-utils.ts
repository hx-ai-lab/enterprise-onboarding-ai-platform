import { NextResponse } from "next/server";
import { CapabilityDisabledError, CapabilityNotFoundError } from "@/lib/errors";
import { StorageUnavailableError } from "@/lib/storage/runtime-storage";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseJsonBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Maps a thrown capability error to the right HTTP status + message; rethrows anything else. */
export function capabilityErrorResponse(err: unknown): ReturnType<typeof jsonError> | null {
  if (err instanceof CapabilityDisabledError) return jsonError(409, err.message);
  if (err instanceof CapabilityNotFoundError) return jsonError(404, err.message);
  return null;
}

/** Return a safe persistence error without exposing Redis connection details. */
export function storageErrorResponse(err: unknown): ReturnType<typeof jsonError> {
  if (err instanceof StorageUnavailableError) return jsonError(503, err.message);
  throw err;
}
