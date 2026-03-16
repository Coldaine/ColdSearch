import type { SearchAdapter, NormalizedResult } from "../types.js";
/**
 * Tavily search adapter.
 * Implements the SearchAdapter interface for Tavily's search API.
 */
export declare class TavilyAdapter implements SearchAdapter {
    name: string;
    capabilities: string[];
    search(query: string, apiKey: string): Promise<NormalizedResult[]>;
}
//# sourceMappingURL=tavily.d.ts.map