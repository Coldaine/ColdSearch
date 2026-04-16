import type { KeyPool } from "../types.js";
import { resolveBWSSecret } from "../resolvers/bws.js";

/**
 * Result of resolving a key from the pool.
 */
export interface KeyResult {
  /** The resolved secret value */
  value: string;
  /** The key reference (e.g. "env:TAVILY_API_KEY", "bws:my-secret", or literal) */
  ref: string;
}

/**
 * Process-local key pool manager with round-robin and random rotation.
 * Rotation state is safe within a single Node.js process and should not be
 * described as cross-process or distributed coordination.
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
      // Random selection
      keyIndex = Math.floor(Math.random() * pool.keys.length);
    } else {
      // Round-robin (default)
      const currentIndex = this.indices.get(provider) || 0;
      keyIndex = currentIndex;
      const nextIndex = (currentIndex + 1) % pool.keys.length;
      this.indices.set(provider, nextIndex);
    }

    const keyRef = pool.keys[keyIndex];
    const value = await this.resolveKeyRef(keyRef);
    return { value, ref: keyRef };
  }

  /**
   * Resolve a key reference to its actual value.
   * Supports:
   *   - env:VAR_NAME for environment variables
   *   - bws:SECRET_NAME or bws:SECRET_ID for Bitwarden Secrets Manager
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

    if (keyRef.startsWith("bws:")) {
      const secretRef = keyRef.slice(4);
      return resolveBWSSecret(secretRef);
    }

    return keyRef;
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

/**
 * Global key pool manager instance.
 * Prefer createKeyPoolManager() for new code; this export exists
 * for backward compatibility during migration.
 */
export const keyPoolManager = new KeyPoolManager();
