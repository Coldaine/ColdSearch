/**
 * Normalized search result schema.
 * All adapters must normalize their provider-specific responses to this shape.
 */
export interface NormalizedResult {
  /** Result title */
  title: string;
  /** Result URL */
  url: string;
  /** Snippet/summary of the content */
  snippet: string;
  /** Normalized relevance score (0-1) */
  score: number;
  /** Provider name (e.g. "tavily", "brave") — included in output for traceability */
  source: string;
}

/**
 * Extract result schema.
 */
export interface ExtractResult {
  /** Extracted content */
  content: string;
  /** Source URL */
  url: string;
  /** Title of the page */
  title?: string;
  /** Provider name (e.g. "jina", "firecrawl") — included in output for traceability */
  source: string;
}

/**
 * Crawl result item schema.
 */
export interface CrawlResult {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Page content */
  content: string;
}

export type CapabilityName = "search" | "extract" | "crawl";

export interface AdapterCallOptions {
  /** Provider-specific options from config */
  providerOptions?: Record<string, unknown>;
}

export interface CrawlCallOptions extends AdapterCallOptions {
  /** Maximum crawl results */
  limit?: number;
}

/**
 * Search adapter interface.
 * Each provider implements this interface.
 */
export interface SearchAdapter {
  /** Adapter name (matches provider key in config) */
  name: string;
  /** Capabilities this adapter supports */
  capabilities: CapabilityName[];
  /** Execute a basic search */
  search(
    query: string,
    apiKey: string,
    options?: AdapterCallOptions
  ): Promise<NormalizedResult[]>;
  /** Extract content from a URL */
  extract?(
    url: string,
    apiKey: string,
    options?: AdapterCallOptions
  ): Promise<ExtractResult>;
  /** Crawl a website */
  crawl?(
    url: string,
    apiKey: string,
    options?: CrawlCallOptions
  ): Promise<CrawlResult[]>;
}

/**
 * Key pool configuration for a provider.
 */
export interface KeyPool {
  /** Key references (e.g., "env:TAVILY_API_KEY") */
  keys: string[];
  /** Rotation strategy (defaults to round-robin) */
  strategy?: "round-robin" | "random";
}

/**
 * Provider configuration.
 */
export interface ProviderConfig {
  /** Key pool for this provider */
  keyPool: KeyPool;
  /** Provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Capability mapping configuration.
 */
export interface CapabilityConfig {
  /** Providers that back this capability, in preference order */
  providers: string[];
  /** Provider selection strategy: "all" (fanout) or "random" (single provider) */
  strategy?: "all" | "random";
}

/**
 * Full configuration schema.
 */
export interface Config {
  /** Capability mappings */
  capabilities: Record<string, CapabilityConfig>;
  /** Provider configurations */
  providers: Record<string, ProviderConfig>;
  /** Optional operational logging configuration */
  logging?: {
    usage?: {
      /** Usage log path (JSONL) */
      path?: string;
    };
  };
}

/**
 * CLI options parsed from command line arguments.
 */
export interface CLIOptions {
  /** Command type */
  command?: "search" | "extract" | "crawl";
  /** Search query or URL */
  query: string;
  /** Maximum results to return */
  limit: number;
  /** Pretty print JSON output */
  pretty: boolean;
  /** Raw JSON output (no formatting) */
  json: boolean;
  /** Custom config file path */
  config?: string;
  /** Use single random provider instead of fanout */
  singleProvider?: boolean;
}
