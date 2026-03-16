import { createAdapter } from "../adapters/index.js";
import { keyPoolManager } from "./keypool.js";
import { rerank } from "./reranker.js";
/**
 * Fanout search engine.
 * Executes search across multiple providers in parallel,
 * then reranks and returns combined results.
 */
export class FanoutEngine {
    config;
    constructor(config) {
        this.config = config;
        this.initializeKeyPools();
    }
    /**
     * Initialize key pools from config.
     */
    initializeKeyPools() {
        for (const [provider, providerConfig] of Object.entries(this.config.providers)) {
            keyPoolManager.register(provider, providerConfig.keyPool);
        }
    }
    /**
     * Execute search across all configured providers.
     */
    async search(query, options) {
        // Get providers to use
        const capabilityProviders = this.config.capabilities.basic_search?.providers || [];
        const providers = options.providers || capabilityProviders;
        if (providers.length === 0) {
            throw new Error("No providers configured for basic_search");
        }
        // Execute searches in parallel
        const results = await Promise.allSettled(providers.map((provider) => this.searchProvider(provider, query)));
        // Collect results and errors
        const resultsByProvider = new Map();
        const errors = {};
        const providersUsed = [];
        results.forEach((result, index) => {
            const provider = providers[index];
            if (result.status === "fulfilled") {
                if (result.value.error) {
                    errors[provider] = result.value.error;
                }
                else {
                    resultsByProvider.set(provider, result.value.results);
                    providersUsed.push(provider);
                }
            }
            else {
                errors[provider] = result.reason?.message || "Unknown error";
            }
        });
        // If all providers failed, throw error
        if (providersUsed.length === 0) {
            throw new Error(`All providers failed: ${JSON.stringify(errors)}`);
        }
        // Rerank results
        const rerankOptions = {
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
    async searchProvider(provider, query) {
        try {
            const apiKey = await keyPoolManager.getNextKey(provider);
            const adapter = createAdapter(provider);
            const results = await adapter.search(query, apiKey);
            return {
                provider,
                results,
            };
        }
        catch (error) {
            return {
                provider,
                results: [],
                error: error.message,
            };
        }
    }
}
//# sourceMappingURL=fanout.js.map