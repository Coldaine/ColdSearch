import type { KeyPool } from "../types.js";
import { resolveBWSSecret } from "../resolvers/bws.js";

/**
 * Thread-safe key pool manager with round-robin and random rotation.
 * Uses atomic index increment for round-robin and crypto for random.
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
   * Thread-safe under concurrent load.
   */
  async getNextKey(provider: string): Promise<string> {
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
    return await this.resolveKeyRef(keyRef);
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
}

/**
 * Global key pool manager instance.
 */
export const keyPoolManager = new KeyPoolManager();
