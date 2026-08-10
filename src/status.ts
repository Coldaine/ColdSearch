import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  Config,
  ErrorCategory,
  ToolWiringStatus,
} from "./types.js";
import { UsageLogger } from "./logging/usage.js";
import { CacheStore } from "./cache/cache.js";
import {
  HARD_EXCLUDED_TOOLS,
  listToolProfiles,
} from "./registry/tool-profiles.js";
// Side-effect: install Bright Data tool profiles so provider-tool coverage is
// complete without importing src/providers.ts.
import "./registry/brightdata-tool-profiles.js";
import {
  getProviderMetadata,
  listRegisteredProviders,
  providerSupportsCapability,
} from "./providers.js";

/**
 * Status and `config doctor` output builders.
 *
 * Both are pure over a loaded Config + local filesystem state. They never
 * contact providers, never resolve `doppler:` references, and never print
 * secret values — key pools are reported as counts/references only.
 */

const BUILT_IN_CAPABILITIES = new Set(["search", "extract", "crawl"]);

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** A provider needs no credential refs when SearXNG or all its tools are keyless. */
function isKeylessProvider(provider: string): boolean {
  if (provider === "searxng") return true;
  return listToolProfiles({ provider }).some((p) => p.features.keyless === true);
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Read the usage JSONL (last 5000 lines, trailing 7 days) into a per-provider
 * call/success summary. Best-effort: parse or I/O failures yield an empty map.
 */
function readUsageSummary(
  usagePath: string
): Record<string, { calls: number; successes: number; success_rate: number }> {
  const summary: Record<string, { calls: number; successes: number; success_rate: number }> = {};
  try {
    const resolved = expandHome(usagePath);
    if (resolved && fs.existsSync(resolved)) {
      const allLines = fs.readFileSync(resolved, "utf8").split("\n").filter(Boolean);
      const lines = allLines.length > 5000 ? allLines.slice(-5000) : allLines;
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const line of lines) {
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        const ts = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : NaN;
        if (!Number.isFinite(ts) || ts < cutoff) continue;
        const provider = entry.provider;
        if (typeof provider !== "string") continue;
        if (!summary[provider]) {
          summary[provider] = { calls: 0, successes: 0, success_rate: 0 };
        }
        summary[provider].calls += 1;
        if (entry.success === true) summary[provider].successes += 1;
      }

      for (const value of Object.values(summary)) {
        value.success_rate = value.calls > 0 ? value.successes / value.calls : 0;
      }
    }
  } catch {
    // best-effort: ignore usage parsing errors
  }
  return summary;
}

/**
 * Locally-detectable missing credential env vars: `env:` key-pool references
 * whose variable is not set. `doppler:` refs are never resolved or probed here.
 */
export function collectMissingEnvVars(
  config: Config
): Array<{ provider: string; var: string }> {
  const missing: Array<{ provider: string; var: string }> = [];
  for (const [provider, cfg] of Object.entries(config.providers ?? {})) {
    const refs = Array.isArray(cfg?.keyPool?.keys) ? cfg.keyPool.keys : [];
    for (const ref of refs) {
      if (typeof ref === "string" && ref.startsWith("env:")) {
        const varName = ref.slice(4).trim();
        if (varName && !process.env[varName]) {
          missing.push({ provider, var: varName });
        }
      }
    }
  }
  return missing;
}

/** Adapter-backed capability surface per registered provider (registry state). */
export function buildProviderCapabilities(
  config: Config
): Record<string, { capabilities: string[]; configured: boolean }> {
  const out: Record<string, { capabilities: string[]; configured: boolean }> = {};
  for (const name of listRegisteredProviders()) {
    out[name] = {
      capabilities: [...getProviderMetadata(name).capabilities],
      configured: (config.providers ?? {})[name] !== undefined,
    };
  }
  return out;
}

/**
 * Provider-tool coverage from the registry: counts and listing of tool
 * profiles by wiring status. This is registry state only — never live provider
 * health, and no provider is contacted.
 */
export function buildToolCoverage(): {
  wired: number;
  direct: number;
  available: number;
  deferred: number;
  total: number;
  hard_excluded: number;
  by_provider: Record<string, Record<ToolWiringStatus, number>>;
  tools: Array<{
    id: string;
    provider: string;
    tool: string;
    status: ToolWiringStatus;
    categories: string[];
  }>;
} {
  const counts: Record<ToolWiringStatus, number> = {
    wired: 0,
    direct: 0,
    available: 0,
    deferred: 0,
  };
  const byProvider: Record<string, Record<ToolWiringStatus, number>> = {};
  const tools: Array<{
    id: string;
    provider: string;
    tool: string;
    status: ToolWiringStatus;
    categories: string[];
  }> = [];

  for (const profile of listToolProfiles()) {
    counts[profile.status] += 1;
    const perProvider = (byProvider[profile.provider] ??= {
      wired: 0,
      direct: 0,
      available: 0,
      deferred: 0,
    });
    perProvider[profile.status] += 1;
    tools.push({
      id: `${profile.provider}.${profile.tool}`,
      provider: profile.provider,
      tool: profile.tool,
      status: profile.status,
      categories: profile.categories,
    });
  }
  tools.sort((a, b) => a.id.localeCompare(b.id));

  return {
    ...counts,
    total: tools.length,
    hard_excluded: HARD_EXCLUDED_TOOLS.size,
    by_provider: byProvider,
    tools,
  };
}

/**
 * Build the `coldsearch status` machine-readable payload.
 *
 * `config_path` is the effective config file path (display only). Cache state
 * and usage path come from the same stores the runtime uses, so the reported
 * paths match what actually runs.
 */
export function buildStatus(config: Config, configPath: string): Record<string, unknown> {
  const byCapability = Object.fromEntries(
    Object.entries(config.capabilities ?? {}).map(([capability, cfg]) => [
      capability,
      {
        providers: cfg?.providers ?? [],
        strategy: cfg?.strategy ?? null,
        effective_strategy: cfg?.strategy ?? "all",
      },
    ])
  );

  const keyPools = Object.fromEntries(
    Object.entries(config.providers ?? {}).map(([provider, cfg]) => [
      provider,
      {
        keys: cfg?.keyPool?.keys?.length ?? 0,
        strategy: cfg?.keyPool?.strategy || "round-robin",
      },
    ])
  );

  const cachePath = new CacheStore({
    enabled: config.cache?.enabled !== false,
    path: config.cache?.path,
  }).getPath();
  const usagePath = new UsageLogger({ path: config.logging?.usage?.path }).getPath();
  const usageSummary = readUsageSummary(usagePath);

  return {
    config_path: configPath,
    capabilities: byCapability,
    key_pools: keyPools,
    cache: {
      enabled: config.cache?.enabled !== false,
      path: cachePath,
    },
    usage_log: usagePath,
    recent_usage_summary_7d: Object.keys(usageSummary).length ? usageSummary : undefined,
    missing_env_vars: collectMissingEnvVars(config),
    provider_capabilities: buildProviderCapabilities(config),
    tool_coverage: buildToolCoverage(),
  };
}

// ---------------------------------------------------------------------------
// config doctor
// ---------------------------------------------------------------------------

export interface DoctorIssue {
  category: ErrorCategory;
  message: string;
}

export interface DoctorReport {
  config_path: string;
  valid: boolean;
  errors: DoctorIssue[];
  warnings: DoctorIssue[];
}

/**
 * Local diagnostics over a parsed Config. Never contacts provider APIs, never
 * consumes provider credits, never resolves `doppler:` references (syntax and
 * presence only), and the SearXNG base URL check is presence/format only — no
 * liveness probe. Secret values are never echoed.
 *
 * Structural problems are `errors` (invalid config); operational gaps (missing
 * env vars, empty key pools, unpopulated capability pools) are `warnings` so a
 * structurally valid starter config still reports `valid: true`.
 */
export function buildDoctorReport(config: Config, configPath: string): DoctorReport {
  const errors: DoctorIssue[] = [];
  const warnings: DoctorIssue[] = [];

  // Required sections.
  const caps = config.capabilities;
  const provs = config.providers;
  if (!caps || typeof caps !== "object") {
    errors.push({ category: "config", message: "Missing [capabilities] section" });
  }
  if (!provs || typeof provs !== "object") {
    errors.push({ category: "config", message: "Missing [providers] section" });
  }
  if (!caps || !provs) {
    return { config_path: configPath, valid: errors.length === 0, errors, warnings };
  }

  // Provider names must be recognized.
  const knownProviders = new Set<string>(listRegisteredProviders());
  for (const name of Object.keys(provs)) {
    if (!knownProviders.has(name)) {
      errors.push({
        category: "provider",
        message: `Unknown provider '${name}' in [providers]`,
      });
    }
  }

  // Capability compatibility: configured providers must exist and support the
  // capability they are assigned to.
  for (const [capability, cfg] of Object.entries(caps)) {
    if (!BUILT_IN_CAPABILITIES.has(capability)) {
      warnings.push({
        category: "unsupported_capability",
        message: `Capability '${capability}' is not one of the built-in capabilities (search, extract, crawl)`,
      });
      continue;
    }
    const providers = Array.isArray(cfg?.providers) ? cfg.providers : [];
    if (providers.length === 0) {
      warnings.push({
        category: "config",
        message: `Capability '${capability}' has no providers configured`,
      });
    }
    for (const provider of providers) {
      if (!provs[provider]) {
        errors.push({
          category: "config",
          message: `Capability '${capability}' references provider '${provider}' which is not configured in [providers]`,
        });
        continue;
      }
      if (!knownProviders.has(provider)) {
        // Already reported as unknown; skip capability-specific noise.
        continue;
      }
      if (!providerSupportsCapability(provider, capability as "search" | "extract" | "crawl")) {
        errors.push({
          category: "unsupported_capability",
          message: `Provider '${provider}' does not support capability '${capability}'`,
        });
      }
    }
  }

  // Key references: syntax/presence only. Refs are names (`env:`/`doppler:`),
  // never resolved and never printed.
  for (const [provider, cfg] of Object.entries(provs)) {
    const refs = Array.isArray(cfg?.keyPool?.keys) ? cfg.keyPool.keys : [];
    if (refs.length === 0) {
      if (!isKeylessProvider(provider)) {
        warnings.push({
          category: "credentials",
          message: `Provider '${provider}' has no key references configured`,
        });
      }
      continue;
    }
    for (const ref of refs) {
      if (typeof ref !== "string") {
        errors.push({
          category: "config",
          message: `Provider '${provider}' key pool contains a non-string key reference`,
        });
        continue;
      }
      if (ref.startsWith("bws:")) {
        errors.push({
          category: "credentials",
          message: `Provider '${provider}' uses the removed bws: reference '${ref}' — migrate to doppler: or env:`,
        });
        continue;
      }
      if (ref.startsWith("env:")) {
        const varName = ref.slice(4).trim();
        if (!varName) {
          errors.push({
            category: "credentials",
            message: `Provider '${provider}' has an empty env: key reference`,
          });
        } else if (!process.env[varName]) {
          warnings.push({
            category: "credentials",
            message: `Provider '${provider}' references unset environment variable ${varName}`,
          });
        }
        continue;
      }
      if (ref.startsWith("doppler:")) {
        // Syntax/presence only — never resolved, never contacted.
        if (!ref.slice(8).trim()) {
          errors.push({
            category: "credentials",
            message: `Provider '${provider}' has an empty doppler: key reference`,
          });
        }
        continue;
      }
      // Raw literal — the value is a secret and must never be echoed.
      warnings.push({
        category: "credentials",
        message: `Provider '${provider}' uses a raw literal key reference (discouraged); prefer env: or doppler:`,
      });
    }
  }

  // SearXNG base URL: presence/format only, no liveness probe.
  const searxng = provs["searxng"];
  if (searxng) {
    const options = searxng.options as Record<string, unknown> | undefined;
    const configuredUrl = typeof options?.baseUrl === "string" ? options.baseUrl : undefined;
    const envUrl = process.env.SEARXNG_BASE_URL;
    if (configuredUrl === undefined && !envUrl) {
      warnings.push({
        category: "provider",
        message:
          "Provider 'searxng' has no baseUrl in [providers.searxng.options] and SEARXNG_BASE_URL is not set",
      });
    } else {
      const candidate = configuredUrl ?? envUrl;
      if (!candidate || !isHttpUrl(candidate)) {
        errors.push({
          category: "config",
          message: `Provider 'searxng' baseUrl '${candidate}' is not a valid http(s) URL`,
        });
      }
    }
  }

  return { config_path: configPath, valid: errors.length === 0, errors, warnings };
}
