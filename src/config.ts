import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import TOML from "@iarna/toml";
import { DEFAULT_CONFIG_DIR_NAME, LEGACY_CONFIG_DIR_NAME } from "./app.js";
import type { Config } from "./types.js";

/**
 * Default config file path.
 */
const DEFAULT_CONFIG_PATH = join(
  homedir(),
  ".config",
  DEFAULT_CONFIG_DIR_NAME,
  "config.toml"
);
const LEGACY_CONFIG_PATH = join(
  homedir(),
  ".config",
  LEGACY_CONFIG_DIR_NAME,
  "config.toml"
);

function resolveConfigPath(configPath?: string): string {
  if (configPath) {
    return configPath;
  }

  if (existsSync(DEFAULT_CONFIG_PATH)) {
    return DEFAULT_CONFIG_PATH;
  }

  if (existsSync(LEGACY_CONFIG_PATH)) {
    return LEGACY_CONFIG_PATH;
  }

  // Neither config exists — use default path for error messaging so guidance
  // points users at the new brand, not the legacy name.
  return DEFAULT_CONFIG_PATH;
}

/**
 * Load and parse configuration from a TOML file.
 */
export function loadConfig(configPath?: string): Config {
  const path = resolveConfigPath(configPath);
  
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const defaultPath = `~/.config/${DEFAULT_CONFIG_DIR_NAME}/config.toml`;
      const guidance = path === DEFAULT_CONFIG_PATH
        ? `Create one at ${defaultPath} or specify with --config`
        : `Verify the --config path or create the file at ${path}`;

      throw new Error(`Config file not found: ${path}\n${guidance}`);
    }
    throw error;
  }

  try {
    const parsed = TOML.parse(content);
    return parsed as unknown as Config;
  } catch (error) {
    throw new Error(
      `Failed to parse config file ${path}: ${(error as Error).message}`
    );
  }
}

/**
 * Get providers for a capability from config.
 */
export function getProvidersForCapability(
  config: Config,
  capability: string
): string[] {
  const capConfig = config.capabilities[capability];
  if (!capConfig) {
    throw new Error(`Capability '${capability}' not found in config`);
  }
  return capConfig.providers;
}

/**
 * Get provider configuration.
 */
export function getProviderConfig(
  config: Config,
  provider: string
): Config["providers"][string] {
  const providerConfig = config.providers[provider];
  if (!providerConfig) {
    throw new Error(`Provider '${provider}' not found in config`);
  }
  return providerConfig;
}

export { DEFAULT_CONFIG_PATH, LEGACY_CONFIG_PATH };
