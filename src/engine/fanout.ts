import { createAdapter } from "../adapters/index.js";
import { KeyPoolManager, createKeyPoolManager } from "./keypool.js";
import { rerank, type RerankerOptions } from "./reranker.js";
import { resolveCapabilityProviders } from "../providers.js";
import { UsageLogger } from "../logging/usage.js";
import type {
  CapabilityName,
  Config,
  NormalizedResult,
  ExtractResult,
  CrawlResult,
} from "../types.js";
import { performance } from "node:perf_hooks";

/**
 * Fanout operation type.
 */
export type OperationType = "search" | "extract" | "crawl";

/**
 * Fanout search options.
 */
export interface FanoutOptions {
  /** Maximum results to return */
  limit: number;
  /** Specific providers to use (defaults to all configured) */
  providers?: string[];
  /** Reranker strategy */
  rerankStrategy?: "rrf" | "score" | "none";
  /** Operation type */
  operation?: OperationType;
  /** Force single provider mode (random selection) */
  singleProvider?: boolean;
}

/**
 * Result from a single provider.
 */
interface ProviderResult {
  provider: string;
  results: NormalizedResult[];
  error?: string;
}

/**
 * Fanout search engine.
 * Executes search across multiple providers in parallel,
 * then reranks and returns combined results.
 */
export class FanoutEngine {
  private config: Config;
  private usageLogger: UsageLogger;
  private keyPool: KeyPoolManager;

  constructor(config: Config) {
    this.config = config;
    this.usageLogger = new UsageLogger({ path: config.logging?.usage?.path });
    this.keyPool = createKeyPoolManager();
    this.initializeKeyPools();
  }

  /**
   * Initialize key pools from config.
   */
  private initializeKeyPools(): void {
    for (const [provider, providerConfig] of Object.entries(
      this.config.providers
    )) {
      this.keyPool.register(provider, providerConfig.keyPool);
    }
  }

  /**
   * Get providers for a capability, applying strategy.
   * Delegates to the shared resolveCapabilityProviders() so that
   * dry-run and actual execution use the same selection logic.
   */
  private getProvidersForCapability(
    capability: CapabilityName,
    options: FanoutOptions
  ): string[] {
    const { providers } = resolveCapabilityProviders(
      this.config,
      capability,
      { providers: options.providers, singleProvider: options.singleProvider }
    );
    return providers;
  }

  /**
   * Execute search across all configured providers.
   */
  async search(query: string, options: FanoutOptions): Promise<{
    results: NormalizedResult[];
    providersUsed: string[];
    errors: Record<string, string>;
  }> {
    // Get providers to use
    const providers = this.getProvidersForCapability("search", options);

    // Execute searches in parallel
    const results = await Promise.allSettled(
      providers.map((provider) => this.searchProvider(provider, query))
    );

    // Collect results and errors
    const resultsByProvider = new Map<string, NormalizedResult[]>();
    const errors: Record<string, string> = {};
    const providersUsed: string[] = [];

    results.forEach((result, index) => {
      const provider = providers[index];
      
      if (result.status === "fulfilled") {
        if (result.value.error) {
          errors[provider] = result.value.error;
        } else {
          resultsByProvider.set(provider, result.value.results);
          providersUsed.push(provider);
        }
      } else {
        errors[provider] = result.reason?.message || "Unknown error";
      }
    });

    // If all providers failed, throw error
    if (providersUsed.length === 0) {
      throw new Error(
        `All providers failed: ${JSON.stringify(errors)}`
      );
    }

    // Rerank results
    const rerankOptions: RerankerOptions = {
      limit: options.limit,
      strategy: options.rerankStrategy || "rrf",
      rrfK: 60,
    };

    const rankedResults = rerank(resultsByProvider, rerankOptions);

    return {
      results: rankedResults,
      providersUsed,
      errors,
    };
  }

  /**
   * Extract content from a URL.
   */
  async extract(url: string, options: FanoutOptions): Promise<{
    result: ExtractResult | null;
    provider: string;
    errors?: Record<string, string>;
  }> {
    const providers = this.getProvidersForCapability("extract", options);
    const errors: Record<string, string> = {};

    // Try providers in order (or single random provider)
    for (const provider of providers) {
      const start = performance.now();
      let keyRef = "none";
      try {
        const adapter = createAdapter(provider);

        if (!adapter.extract) {
          errors[provider] = "Adapter does not support extract";
          continue;
        }

        // Get API key + safe logging reference (keyless providers like Jina return empty string)
        const keyResult = await this.keyPool.getNextKeyWithRefOrEmpty(provider);
        const apiKey = keyResult.value;
        keyRef = keyResult.ref;
        const result = await adapter.extract(url, apiKey, {
          providerOptions: this.config.providers[provider]?.options,
        });

        this.usageLogger.write({
          timestamp: new Date().toISOString(),
          provider,
          capability: "extract",
          key: keyRef,
          success: true,
          response_time_ms: Math.round(performance.now() - start),
        });
        return {
          result,
          provider,
          errors: Object.keys(errors).length > 0 ? errors : undefined,
        };
      } catch (error) {
        errors[provider] = (error as Error).message;
        this.usageLogger.write({
          timestamp: new Date().toISOString(),
          provider,
          capability: "extract",
          key: keyRef,
          success: false,
          response_time_ms: Math.round(performance.now() - start),
          error: (error as Error).message,
        });
      }
    }

    throw new Error(`All providers failed: ${JSON.stringify(errors)}`);
  }

  /**
   * Crawl a website.
   */
  async crawl(url: string, options: FanoutOptions): Promise<{
    results: CrawlResult[];
    provider: string;
    errors?: Record<string, string>;
  }> {
    const providers = this.getProvidersForCapability("crawl", options);
    const errors: Record<string, string> = {};

    // Try providers in order (or single random provider)
    for (const provider of providers) {
      const start = performance.now();
      let keyRef = "none";
      try {
        const adapter = createAdapter(provider);

        if (!adapter.crawl) {
          errors[provider] = "Adapter does not support crawl";
          continue;
        }

        // Get API key + safe logging reference (keyless providers return empty string)
        const keyResult = await this.keyPool.getNextKeyWithRefOrEmpty(provider);
        const apiKey = keyResult.value;
        keyRef = keyResult.ref;
        const results = await adapter.crawl(url, apiKey, {
          limit: options.limit,
          providerOptions: this.config.providers[provider]?.options,
        });

        this.usageLogger.write({
          timestamp: new Date().toISOString(),
          provider,
          capability: "crawl",
          key: keyRef,
          success: true,
          response_time_ms: Math.round(performance.now() - start),
        });
        return {
          results: results,
          provider,
          errors: Object.keys(errors).length > 0 ? errors : undefined,
        };
      } catch (error) {
        errors[provider] = (error as Error).message;
        this.usageLogger.write({
          timestamp: new Date().toISOString(),
          provider,
          capability: "crawl",
          key: keyRef,
          success: false,
          response_time_ms: Math.round(performance.now() - start),
          error: (error as Error).message,
        });
      }
    }

    throw new Error(`All providers failed: ${JSON.stringify(errors)}`);
  }

  /**
   * Search a single provider.
   */
  private async searchProvider(
    provider: string,
    query: string
  ): Promise<ProviderResult> {
    const start = performance.now();
    let keyRef = "none";
    try {
      const keyResult = await this.keyPool.getNextKeyWithRefOrEmpty(provider);
      const apiKey = keyResult.value;
      keyRef = keyResult.ref;
      const adapter = createAdapter(provider);
      const results = await adapter.search(query, apiKey, {
        providerOptions: this.config.providers[provider]?.options,
      });

      this.usageLogger.write({
        timestamp: new Date().toISOString(),
        provider,
        capability: "search",
        key: keyRef,
        success: true,
        response_time_ms: Math.round(performance.now() - start),
      });

      return {
        provider,
        results,
      };
    } catch (error) {
      this.usageLogger.write({
        timestamp: new Date().toISOString(),
        provider,
        capability: "search",
        key: keyRef,
        success: false,
        response_time_ms: Math.round(performance.now() - start),
        error: (error as Error).message,
      });
      return {
        provider,
        results: [],
        error: (error as Error).message,
      };
    }
  }
}
