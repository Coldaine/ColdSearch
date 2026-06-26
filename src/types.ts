/**
 * Normalized search result schema.
 * All adapters must normalize their provider-specific responses to this shape.
 */
export interface NormalizedResult {
  title: string;
  url: string;
  snippet: string;
  score: number;
  source: string;
}

export interface ExtractResult {
  content: string;
  url: string;
  title?: string;
  source: string;
}

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
}

export type CapabilityName = "search" | "extract" | "crawl";

export interface AdapterCallOptions {
  providerOptions?: Record<string, unknown>;
}

export interface CrawlCallOptions extends AdapterCallOptions {
  limit?: number;
}

export interface SearchAdapter {
  name: string;
  capabilities: CapabilityName[];
  search(
    query: string,
    apiKey: string,
    options?: AdapterCallOptions
  ): Promise<NormalizedResult[]>;
  extract?(
    url: string,
    apiKey: string,
    options?: AdapterCallOptions
  ): Promise<ExtractResult>;
  crawl?(
    url: string,
    apiKey: string,
    options?: CrawlCallOptions
  ): Promise<CrawlResult[]>;
}

export interface KeyPool {
  /** Explicit key references, e.g. doppler:TAVILY_API_KEY or env:TAVILY_API_KEY */
  keys?: string[];
  /** Override the provider default Doppler secret name when keys is empty */
  defaultSecretName?: string;
  strategy?: "round-robin" | "random";
}

export interface ProviderConfig {
  keyPool: KeyPool;
  options?: Record<string, unknown>;
}

export interface CapabilityConfig {
  providers: string[];
  strategy?: "all" | "random";
}

export interface Config {
  capabilities: Record<string, CapabilityConfig>;
  providers: Record<string, ProviderConfig>;
  logging?: {
    usage?: {
      path?: string;
    };
  };
  cache?: {
    enabled?: boolean;
    search_ttl?: string;
    extract_ttl?: string;
    path?: string;
  };
}

export interface CLIOptions {
  command?: "search" | "extract" | "crawl";
  query: string;
  limit: number;
  pretty: boolean;
  json: boolean;
  config?: string;
  singleProvider?: boolean;
}
