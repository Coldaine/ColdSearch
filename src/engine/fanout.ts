import { createAdapter } from "../adapters/index.js";
import { keyPoolManager } from "./keypool.js";
import { rerank, type RerankerOptions } from "./reranker.js";
import type { Config, NormalizedResult } from "../types.js";

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

  constructor(config: Config) {
    this.config = config;
    this.initializeKeyPools();
  }

  /**
   * Initialize key pools from config.
   */
  private initializeKeyPools(): void {
    for (const [provider, providerConfig] of Object.entries(
      this.config.providers
    )) {
      keyPoolManager.register(provider, providerConfig.keyPool);
    }
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
    const capabilityProviders =
      this.config.capabilities.basic_search?.providers || [];
    const providers = options.providers || capabilityProviders;

    if (providers.length === 0) {
      throw new Error("No providers configured for basic_search");
    }

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
   * Search a single provider.
   */
  private async searchProvider(
    provider: string,
    query: string
  ): Promise<ProviderResult> {
    try {
      const apiKey = await keyPoolManager.getNextKey(provider);
      const adapter = createAdapter(provider);
      const results = await adapter.search(query, apiKey);

      return {
        provider,
        results,
      };
    } catch (error) {
      return {
        provider,
        results: [],
        error: (error as Error).message,
      };
    }
  }
}
