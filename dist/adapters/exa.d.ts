import type { SearchAdapter, NormalizedResult } from "../types.js";
/**
 * Exa (formerly Metaphor) search adapter.
 * Uses Exa's REST API directly.
 * @see https://docs.exa.ai/reference/getting-started
 */
export declare class ExaAdapter implements SearchAdapter {
    name: string;
    capabilities: string[];
    search(query: string, apiKey: string): Promise<NormalizedResult[]>;
}
//# sourceMappingURL=exa.d.ts.map