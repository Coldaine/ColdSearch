import type { Config, KeyPool } from "./types.js";
/**
 * Default config file path.
 */
declare const DEFAULT_CONFIG_PATH: string;
/**
 * Get the next key from a key pool using round-robin rotation.
 * Simple index-based rotation (will be enhanced for concurrency in Phase 5).
 */
export declare function getNextKey(pool: KeyPool, index: number): string;
/**
 * Load and parse configuration from a TOML file.
 */
export declare function loadConfig(configPath?: string): Config;
/**
 * Get providers for a capability from config.
 */
export declare function getProvidersForCapability(config: Config, capability: string): string[];
/**
 * Get provider configuration.
 */
export declare function getProviderConfig(config: Config, provider: string): Config["providers"][string];
export { DEFAULT_CONFIG_PATH };
//# sourceMappingURL=config.d.ts.map