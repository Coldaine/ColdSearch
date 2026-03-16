/**
 * Brave Search adapter.
 * Uses Brave's Web Search API directly.
 * @see https://api.search.brave.com/app/documentation/web-search/get-started
 */
export class BraveAdapter {
    name = "brave";
    capabilities = ["basic_search"];
    async search(query, apiKey) {
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        url.searchParams.set("q", query);
        url.searchParams.set("count", "10");
        url.searchParams.set("offset", "0");
        const response = await fetch(url.toString(), {
            headers: {
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": apiKey,
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Brave API error: ${response.status} - ${errorText}`);
        }
        const data = (await response.json());
        // Normalize Brave results to shared schema
        return (data.web?.results || []).map((result, index) => ({
            title: result.title || "",
            url: result.url || "",
            snippet: result.description || "",
            // Brave scores are 0-1 when available, otherwise fall back to position-based
            score: result.relevance_score ?? (1 - index * 0.1),
            source: this.name,
        }));
    }
}
//# sourceMappingURL=brave.js.map