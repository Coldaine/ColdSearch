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
 * Fanout search engine.
 * Executes search across multiple providers in parallel,
 * then reranks and returns combined results.
 */
export declare class FanoutEngine {
    private config;
    constructor(config: Config);
    /**
     * Initialize key pools from config.
     */
    private initializeKeyPools;
    /**
     * Execute search across all configured providers.
     */
    search(query: string, options: FanoutOptions): Promise<{
        results: NormalizedResult[];
        providersUsed: string[];
        errors: Record<string, string>;
    }>;
    /**
     * Search a single provider.
     */
    private searchProvider;
}
//# sourceMappingURL=fanout.d.ts.map