import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { CapabilityName, KeyPool } from "../types.js";

export interface UsageLogEntry {
  timestamp: string;
  provider: string;
  capability: CapabilityName;
  key: string;
  success: boolean;
  response_time_ms: number;
  error?: string;
}

function defaultUsageLogPath(): string {
  return join(homedir(), ".config", "coldsearch", "usage.jsonl");
}

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return join(homedir(), p.slice(2));
  }
  return p;
}

/**
 * Get a safe key reference string for logging/display.
 * Returns the key reference (e.g. "env:TAVILY_API_KEY", "bws:my-secret")
 * rather than any fragment of the resolved secret value.
 * This avoids leaking stable fragments of live secrets in log files.
 */
export function getKeyReference(keyPool: KeyPool | undefined, provider: string): string {
  if (!keyPool || !keyPool.keys.length) return `${provider}:keyless`;
  // For dry-run preview, show the first key reference as representative.
  // At runtime, FanoutEngine uses KeyResult.ref from the keypool which
  // reflects the actually-selected key slot.
  return keyPool.keys[0];
}


export class UsageLogger {
  private path: string;

  constructor(options?: { path?: string }) {
    this.path = expandHome(options?.path || defaultUsageLogPath());
  }

  getPath(): string {
    return this.path;
  }

  write(entry: UsageLogEntry): void {
    try {
      const dir = dirname(this.path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      appendFileSync(this.path, `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      // Best-effort: logging failures must never break core operations.
    }
  }
}

