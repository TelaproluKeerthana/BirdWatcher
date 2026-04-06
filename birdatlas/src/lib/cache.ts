import fs from "node:fs/promises";
import path from "node:path";

// Keep cache small and predictable. Adjust TTL/version if you want refresh behavior.
const CACHE_DIR = path.join(process.cwd(), ".birdatlas-cache");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Bump when API payload shape or ranking semantics change (invalidates disk cache).
const CACHE_VERSION = 2;

export function makeCacheKey(parts: {
  stateCode: string;
  backDays: number;
}) {
  return `v${CACHE_VERSION}|state=${parts.stateCode}|backDays=${parts.backDays}`;
}

function cachePathForKey(key: string) {
  // Very simple filename normalization for cross-platform safety.
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export async function readCacheJson<T>(key: string): Promise<T | null> {
  const filePath = cachePathForKey(key);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed: { updatedAt: number; value: T } = JSON.parse(raw);
    const ageMs = Date.now() - parsed.updatedAt;
    if (ageMs > CACHE_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export async function writeCacheJson<T>(key: string, value: T): Promise<void> {
  const filePath = cachePathForKey(key);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const payload = {
    updatedAt: Date.now(),
    value,
  };
  await fs.writeFile(filePath, JSON.stringify(payload), "utf-8");
}

