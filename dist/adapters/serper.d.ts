import type { SearchAdapter, NormalizedResult } from "../types.js";
/**
 * Serper.dev Google Search adapter.
 * Uses Serper's REST API for Google search results.
 * @see https://serper.dev/docs
 */
export declare class SerperAdapter implements SearchAdapter {
    name: string;
    capabilities: string[];
    search(query: string, apiKey: string): Promise<NormalizedResult[]>;
}
//# sourceMappingURL=serper.d.ts.map