import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { ExecutionRecord } from "./types.js";

function defaultHistoryPath(): string {
  return join(homedir(), ".config", "coldsearch", "history.jsonl");
}

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return join(homedir(), p.slice(2));
  }
  return p;
}

/**
 * Durable execution-history store: one JSONL file, one top-level
 * `ExecutionRecord` per line, appended in invocation order.
 *
 * History is deliberately independent of the replay cache: cache TTL expiry
 * and `cache clear` never touch this file, and `history clear --all` never
 * touches cache entries.
 *
 * Unlike the cache (best-effort, failures swallowed), history is the audit
 * trail that an execution occurred — `append` THROWS on I/O failure so the
 * caller can surface an observable warning instead of silently dropping the
 * record.
 */
export class HistoryStore {
  private readonly path: string;

  constructor(options?: { path?: string }) {
    // Guard against a non-string [history].path from unvalidated TOML.
    const rawPath = typeof options?.path === "string" ? options.path : undefined;
    this.path = expandHome(rawPath || defaultHistoryPath());
  }

  getPath(): string {
    return this.path;
  }

  /**
   * Append one execution record. A single-line appendFileSync is the atomic
   * unit (no partial records). Throws on failure — callers must catch and
   * surface a non-secret warning.
   */
  append(record: ExecutionRecord): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    // mode applies on creation; the chmod below tightens pre-existing files.
    appendFileSync(this.path, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    try {
      chmodSync(this.path, 0o600);
    } catch {
      // Permissions are restrictive where supported; tolerate platforms
      // (e.g. some Windows ACLs) where chmod is a no-op or unsupported.
    }
  }

  /**
   * Read every record, oldest first. Corrupt lines are skipped — one bad line
   * must not make the whole history unreadable.
   */
  list(): ExecutionRecord[] {
    if (!existsSync(this.path)) return [];

    let raw: string;
    try {
      raw = readFileSync(this.path, "utf8");
    } catch {
      return [];
    }

    const records: ExecutionRecord[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const record = JSON.parse(trimmed) as ExecutionRecord;
        if (record && typeof record.id === "string" && typeof record.timestamp === "string") {
          records.push(record);
        }
      } catch {
        // skip corrupt line
      }
    }
    return records;
  }

  /** Newest-first listing, bounded. */
  recent(limit = 20): ExecutionRecord[] {
    return this.list().reverse().slice(0, Math.max(0, limit));
  }

  get(id: string): ExecutionRecord | null {
    return this.list().find((record) => record.id === id) ?? null;
  }

  /**
   * Delete all history records. Returns how many were removed.
   * Replay-cache material is never touched.
   */
  clear(): number {
    const count = this.list().length;
    if (existsSync(this.path)) {
      unlinkSync(this.path);
    }
    return count;
  }
}
