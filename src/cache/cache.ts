import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * On-disk shape of a single cache entry.
 */
interface CacheEntry<T = unknown> {
  key: string;
  payload: T;
  created_at: number;
  ttl_seconds: number;
}

function defaultCachePath(): string {
  return join(homedir(), ".config", "coldsearch", "cache");
}

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return join(homedir(), p.slice(2));
  }
  return p;
}

/**
 * File-based read-through cache.
 *
 * One JSON file per entry at `<path>/<capability>/<key>.json`. Reads are lazy:
 * expiry is checked on `get` (no background sweep). All disk operations are
 * best-effort — a cache failure must never break a request, mirroring the
 * `UsageLogger.write` try/catch contract in `src/logging/usage.ts`.
 */
export class CacheStore {
  private readonly enabled: boolean;
  private readonly path: string;

  constructor(options?: { enabled?: boolean; path?: string }) {
    this.enabled = options?.enabled !== false;
    // Guard against a non-string [cache].path from unvalidated TOML.
    const rawPath = typeof options?.path === "string" ? options.path : undefined;
    this.path = expandHome(rawPath || defaultCachePath());
  }

  private entryPath(capability: string, key: string): string {
    return join(this.path, capability, `${key}.json`);
  }

  /**
   * Return the stored payload for a key, or null on miss / expiry / corruption.
   * Never throws.
   */
  get<T = unknown>(capability: string, key: string): T | null {
    if (!this.enabled) return null;

    const file = this.entryPath(capability, key);
    try {
      if (!existsSync(file)) return null;

      const raw = readFileSync(file, "utf8");
      const entry = JSON.parse(raw) as CacheEntry<T>;

      if (
        !entry ||
        typeof entry.created_at !== "number" ||
        typeof entry.ttl_seconds !== "number"
      ) {
        return null;
      }

      const expiresAt = entry.created_at + entry.ttl_seconds * 1000;
      if (expiresAt < Date.now()) {
        // Lazy eviction: best-effort unlink of the expired entry.
        try {
          unlinkSync(file);
        } catch {
          // Ignore — expiry is still honored by returning null below.
        }
        return null;
      }

      return entry.payload;
    } catch {
      // Missing / corrupt / unreadable — treat as a miss.
      return null;
    }
  }

  /**
   * Best-effort write of a cache entry. No-op when disabled; swallows all
   * errors so a cache write can never break a request.
   */
  set<T = unknown>(
    capability: string,
    key: string,
    payload: T,
    ttlSeconds: number
  ): void {
    if (!this.enabled) return;

    try {
      const dir = join(this.path, capability);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const entry: CacheEntry<T> = {
        key,
        payload,
        created_at: Date.now(),
        ttl_seconds: ttlSeconds,
      };

      writeFileSync(this.entryPath(capability, key), JSON.stringify(entry), "utf8");
    } catch {
      // Best-effort: cache write failures must never break core operations.
    }
  }
}
