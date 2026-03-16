import type { KeyPool } from "../types.js";
/**
 * Thread-safe key pool manager with round-robin rotation.
 * Uses atomic index increment for concurrent access.
 */
export declare class KeyPoolManager {
    private pools;
    private indices;
    /**
     * Register a key pool for a provider.
     */
    register(provider: string, pool: KeyPool): void;
    /**
     * Get the next key from a provider's pool using round-robin.
     * Thread-safe under concurrent load.
     */
    getNextKey(provider: string): Promise<string>;
    /**
     * Resolve a key reference to its actual value.
     * Supports: env:VAR_NAME for environment variables.
     */
    private resolveKeyRef;
    /**
     * Get all registered providers.
     */
    getProviders(): string[];
}
/**
 * Global key pool manager instance.
 */
export declare const keyPoolManager: KeyPoolManager;
//# sourceMappingURL=keypool.d.ts.map