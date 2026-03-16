import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import TOML from "@iarna/toml";
/**
 * Default config file path.
 */
const DEFAULT_CONFIG_PATH = join(homedir(), ".config", "usearch", "config.toml");
/**
 * Resolve a key reference to its actual value.
 * Supports: env:VAR_NAME for environment variables.
 */
function resolveKeyRef(keyRef) {
    if (keyRef.startsWith("env:")) {
        const varName = keyRef.slice(4);
        const value = process.env[varName];
        if (!value) {
            throw new Error(`Environment variable ${varName} is not set`);
        }
        return value;
    }
    // For now, only env: prefix is supported
    // Could add file:, vault:, etc. later
    return keyRef;
}
/**
 * Get the next key from a key pool using round-robin rotation.
 * Simple index-based rotation (will be enhanced for concurrency in Phase 5).
 */
export function getNextKey(pool, index) {
    if (!pool.keys.length) {
        throw new Error("Key pool is empty");
    }
    const keyRef = pool.keys[index % pool.keys.length];
    return resolveKeyRef(keyRef);
}
/**
 * Load and parse configuration from a TOML file.
 */
export function loadConfig(configPath) {
    const path = configPath || DEFAULT_CONFIG_PATH;
    let content;
    try {
        content = readFileSync(path, "utf-8");
    }
    catch (error) {
        if (error.code === "ENOENT") {
            throw new Error(`Config file not found: ${path}\n` +
                `Create one at ~/.config/usearch/config.toml or specify with --config`);
        }
        throw error;
    }
    try {
        const parsed = TOML.parse(content);
        return parsed;
    }
    catch (error) {
        throw new Error(`Failed to parse config file ${path}: ${error.message}`);
    }
}
/**
 * Get providers for a capability from config.
 */
export function getProvidersForCapability(config, capability) {
    const capConfig = config.capabilities[capability];
    if (!capConfig) {
        throw new Error(`Capability '${capability}' not found in config`);
    }
    return capConfig.providers;
}
/**
 * Get provider configuration.
 */
export function getProviderConfig(config, provider) {
    const providerConfig = config.providers[provider];
    if (!providerConfig) {
        throw new Error(`Provider '${provider}' not found in config`);
    }
    return providerConfig;
}
export { DEFAULT_CONFIG_PATH };
//# sourceMappingURL=config.js.map