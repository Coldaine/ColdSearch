import type { NormalizedResult } from "../types.js";
/**
 * Reranker configuration options.
 */
export interface RerankerOptions {
    /** Maximum results to return */
    limit: number;
    /** Reranking strategy */
    strategy: "rrf" | "score" | "none";
    /** RRF constant k (default: 60) */
    rrfK?: number;
}
/**
 * Rerank results from multiple providers.
 */
export declare function rerank(resultsByProvider: Map<string, NormalizedResult[]>, options: RerankerOptions): NormalizedResult[];
//# sourceMappingURL=reranker.d.ts.map