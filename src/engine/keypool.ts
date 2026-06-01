import type { KeyPool } from "../types.js";
import { safeKeyRef } from "../logging/usage.js";

/**
 * Result of resolving a key from the pool.
 */
export interface KeyResult {
  /** The resolved secret value */
  value: string;
  /** The key reference (e.g. "env:TAVILY_API_KEY", "doppler:TAVILY_API_KEY", or literal) */
  ref: string;
}

/**
 * Process-local key pool manager with round-robin and random rotation.
 * Rotation state is safe within a single Node.js process.
 */
export class KeyPoolManager {
  private pools: Map<string, KeyPool> = new Map();
  private indices: Map<string, number> = new Map();

  /**
   * Register a key pool for a provider.
   */
  register(provider: string, pool: KeyPool): void {
    this.pools.set(provider, pool);
    this.indices.set(provider, 0);
  }

  /**
   * Get the next key from a provider's pool.
   * Uses round-robin or random selection based on pool strategy.
   * @throws Error if pool is empty
   */
  async getNextKey(provider: string): Promise<string> {
    const result = await this.getNextKeyWithRef(provider);
    return result.value;
  }

  /**
   * Get the next key from a provider's pool, returning both the
   * resolved value and the key reference for safe logging.
   * Uses round-robin or random selection based on pool strategy.
   * @throws Error if pool is empty
   */
  async getNextKeyWithRef(provider: string): Promise<KeyResult> {
    const pool = this.pools.get(provider);
    if (!pool) {
      throw new Error(`No key pool registered for provider: ${provider}`);
    }

    if (!pool.keys.length) {
      throw new Error(`Key pool for ${provider} is empty`);
    }

    const strategy = pool.strategy || "round-robin";
    let keyIndex: number;

    if (strategy === "random") {
      keyIndex = Math.floor(Math.random() * pool.keys.length);
    } else {
      const currentIndex = this.indices.get(provider) || 0;
      keyIndex = currentIndex;
      const nextIndex = (currentIndex + 1) % pool.keys.length;
      this.indices.set(provider, nextIndex);
    }

    const keyRef = pool.keys[keyIndex];
    const value = await this.resolveKeyRef(keyRef);
    return { value, ref: safeKeyRef(keyRef, provider) };
  }

  /**
   * Supported secret reference schemes:
   *   env:VAR_NAME           → environment variable
   *   doppler:SECRET_NAME    → Doppler secrets (value fetched at runtime from Doppler CLI)
   *   bws:SECRET_NAME|UUID   → Bitwarden Secrets Manager (deprecated — migrate to Doppler)
   *   Literal string         → used as-is (for keys embedded in config, discouraged)
   */
  private async resolveKeyRef(keyRef: string): Promise<string> {
    if (keyRef.startsWith("env:")) {
      const varName = keyRef.slice(4);
      const value = process.env[varName];
      if (!value) {
        throw new Error(`Environment variable ${varName} is not set`);
      }
      return value;
    }

    if (keyRef.startsWith("doppler:")) {
      const secretName = keyRef.slice(8);
      return this.resolveDopplerSecret(secretName);
    }

    if (keyRef.startsWith("bws:")) {
      const secretRef = keyRef.slice(4);
      return this.resolveBwsSecret(secretRef);
    }

    return keyRef;
  }

  /**
   * Fetch a secret from Doppler at runtime using the Doppler CLI.
   * Requires `doppler secrets get SECRET_NAME --plain` to succeed in the
   * current environment (i.e., Doppler is authenticated via `doppler login`,
   * or DOPPLER_TOKEN is set in the process environment).
   *
   * Secrets are fetched fresh per request — no caching at this layer.
   * Doppler handles cross-process token management via its own daemon,
   * so no long-lived token needs to be stored by ColdSearch.
   */
  private async resolveDopplerSecret(secretName: string): Promise<string> {
    const { execSync } = await import("node:child_process");

    try {
      // Doppler CLI must be on PATH; `doppler secrets get` fetches the
      // secret value from the Doppler backend using the authenticated
      // session (dev: browser login; CI/prod: service token in process env).
      const value = execSync(`doppler secrets get ${secretName} --plain`, {
        encoding: "utf8",
        timeout: 10_000,
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();

      if (!value) {
        throw new Error(`Doppler secret "${secretName}" resolved to empty value`);
      }
      return value;
    } catch (err) {
      const cmd = `doppler secrets get ${secretName} --plain`;
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `Doppler CLI not found on PATH. Install from https://doppler.com/docs/cli`
        );
      }
      throw new Error(
        `Failed to resolve Doppler secret "${secretName}". ` +
          `Ensure Doppler is authenticated (run 'doppler login') or DOPPLER_TOKEN ` +
          `is set in the environment. Command: ${cmd}`
      );
    }
  }

  /**
   * Fetch a secret from Bitwarden Secrets Manager (BWS) at runtime.
   * DEPRECATED: Migrate to Doppler. This resolver remains for migration
   * continuity but may be removed in a future release.
   */
  private async resolveBwsSecret(secretRef: string): Promise<string> {
    const { resolveBWSSecret } = await import("../resolvers/bws.js");
    return resolveBWSSecret(secretRef);
  }

  /**
   * Get all registered providers.
   */
  getProviders(): string[] {
    return Array.from(this.pools.keys());
  }

  /**
   * Check if a provider has any keys configured.
   */
  hasKeys(provider: string): boolean {
    const pool = this.pools.get(provider);
    return !!pool && pool.keys.length > 0;
  }

  /**
   * Get the next key from a provider's pool, or empty string if no keys.
   * Safe for keyless providers like Jina.
   */
  async getNextKeyOrEmpty(provider: string): Promise<string> {
    if (!this.hasKeys(provider)) {
      return "";
    }
    return this.getNextKey(provider);
  }

  /**
   * Get the next key with reference from a provider's pool, or keyless result if no keys.
   * Safe for keyless providers like Jina and SearXNG.
   */
  async getNextKeyWithRefOrEmpty(provider: string): Promise<KeyResult> {
    if (!this.hasKeys(provider)) {
      return { value: "", ref: `${provider}:keyless` };
    }
    return this.getNextKeyWithRef(provider);
  }
}

/**
 * Create a fresh KeyPoolManager instance.
 * Use this instead of a global singleton so that each FanoutEngine
 * owns its own pool state without cross-instance leakage.
 */
export function createKeyPoolManager(): KeyPoolManager {
  return new KeyPoolManager();
}