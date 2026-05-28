import { loadConfig } from "../config.js";
import { FanoutEngine, type FanoutOptions } from "../engine/fanout.js";
import { CacheStore } from "../cache/cache.js";
import { cacheKey, parseDuration } from "../cache/key.js";
import type { Config, CrawlResult, ExtractResult, NormalizedResult } from "../types.js";

type SearchResult = {
  results: NormalizedResult[];
  providersUsed: string[];
  errors: Record<string, string>;
};

type ExtractOutcome = {
  result: ExtractResult | null;
  provider: string;
  errors?: Record<string, string>;
};

export interface ExecutionBackend {
  search(query: string, options: FanoutOptions): Promise<SearchResult>;
  extract(url: string, options: FanoutOptions): Promise<ExtractOutcome>;
  crawl(url: string, options: FanoutOptions): Promise<{
    results: CrawlResult[];
    provider: string;
    errors?: Record<string, string>;
  }>;
}

export class LocalExecutionBackend implements ExecutionBackend {
  private readonly config: Config;
  private readonly engine: FanoutEngine;
  private readonly cache: CacheStore;
  private readonly cacheEnabled: boolean;
  private readonly searchTtl: number;
  private readonly extractTtl: number;

  constructor(configPath?: string) {
    this.config = loadConfig(configPath);
    this.engine = new FanoutEngine(this.config);

    // Cache is on by default — enabled unless [cache].enabled is explicitly false.
    this.cacheEnabled = this.config.cache?.enabled !== false;
    this.cache = new CacheStore({
      enabled: this.cacheEnabled,
      path: this.config.cache?.path,
    });
    this.searchTtl = parseDuration(this.config.cache?.search_ttl ?? "6h", 21600);
    this.extractTtl = parseDuration(this.config.cache?.extract_ttl ?? "24h", 86400);
  }

  /**
   * The cache applies only to the default provider pool. An explicit
   * --providers or --single-provider scope is a deliberate per-request choice,
   * so it bypasses the (provider-agnostic) cache rather than risk serving a hit
   * sourced from a different provider set. --no-cache and [cache].enabled=false
   * disable it too.
   */
  private shouldUseCache(options: FanoutOptions): boolean {
    if (!this.cacheEnabled || options.noCache) return false;
    if (options.singleProvider) return false;
    if (Array.isArray(options.providers) && options.providers.length > 0) return false;
    return true;
  }

  async search(query: string, options: FanoutOptions): Promise<SearchResult> {
    const useCache = this.shouldUseCache(options);

    if (useCache) {
      const key = cacheKey("search", query, {
        limit: options.limit,
        rerankStrategy: options.rerankStrategy ?? "rrf",
      });
      const hit = this.cache.get<SearchResult>("search", key);
      if (hit) {
        return hit;
      }

      const result = await this.engine.search(query, options);
      // Only cache non-empty results; drop transient per-provider errors from
      // the stored payload so a 6h hit doesn't replay stale error messages.
      if (result.results.length > 0) {
        this.cache.set(
          "search",
          key,
          { results: result.results, providersUsed: result.providersUsed, errors: {} },
          this.searchTtl
        );
      }
      return result;
    }

    return this.engine.search(query, options);
  }

  async extract(url: string, options: FanoutOptions): Promise<ExtractOutcome> {
    const useCache = this.shouldUseCache(options);

    if (useCache) {
      const key = cacheKey("extract", url, {});
      const hit = this.cache.get<ExtractOutcome>("extract", key);
      if (hit) {
        return hit;
      }

      // extract throws when all providers fail, so a returned value is a success.
      const result = await this.engine.extract(url, options);
      // Only cache when content was actually extracted; omit transient errors
      // from the stored payload so a 24h hit doesn't replay stale error messages.
      if (result.result !== null) {
        this.cache.set(
          "extract",
          key,
          { result: result.result, provider: result.provider },
          this.extractTtl
        );
      }
      return result;
    }

    return this.engine.extract(url, options);
  }

  crawl(url: string, options: FanoutOptions) {
    // Crawl is not cached in Phase A1.
    return this.engine.crawl(url, options);
  }
}
