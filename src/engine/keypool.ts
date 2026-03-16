import type { KeyPool } from "../types.js";

/**
 * Thread-safe key pool manager with round-robin rotation.
 * Uses atomic index increment for concurrent access.
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
   * Get the next key from a provider's pool using round-robin.
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

    // Simple atomic increment for round-robin
    const currentIndex = this.indices.get(provider) || 0;
    const nextIndex = (currentIndex + 1) % pool.keys.length;
    this.indices.set(provider, nextIndex);

    const keyRef = pool.keys[currentIndex];
    return this.resolveKeyRef(keyRef);
  }

  /**
   * Resolve a key reference to its actual value.
   * Supports: env:VAR_NAME for environment variables.
   */
  private resolveKeyRef(keyRef: string): string {
    if (keyRef.startsWith("env:")) {
      const varName = keyRef.slice(4);
      const value = process.env[varName];
      if (!value) {
        throw new Error(`Environment variable ${varName} is not set`);
      }
      return value;
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
