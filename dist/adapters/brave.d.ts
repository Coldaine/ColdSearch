import type { SearchAdapter, NormalizedResult } from "../types.js";
/**
 * Brave Search adapter.
 * Uses Brave's Web Search API directly.
 * @see https://api.search.brave.com/app/documentation/web-search/get-started
 */
export declare class BraveAdapter implements SearchAdapter {
    name: string;
    capabilities: string[];
    search(query: string, apiKey: string): Promise<NormalizedResult[]>;
}
//# sourceMappingURL=brave.d.ts.map