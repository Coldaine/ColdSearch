import { tavily } from "@tavily/core";
/**
 * Tavily search adapter.
 * Implements the SearchAdapter interface for Tavily's search API.
 */
export class TavilyAdapter {
    name = "tavily";
    capabilities = ["basic_search"];
    async search(query, apiKey) {
        const client = tavily({ apiKey });
        const response = await client.search(query, {
            searchDepth: "basic",
            includeAnswer: false,
        });
        // Normalize Tavily results to the shared schema
        return (response.results || []).map((result, index) => ({
            title: result.title || "",
            url: result.url || "",
            snippet: result.content || "",
            // Tavily scores are 0-1, higher is better
            score: result.score ?? (1 - index * 0.1),
            source: this.name,
        }));
    }
}
//# sourceMappingURL=tavily.js.map