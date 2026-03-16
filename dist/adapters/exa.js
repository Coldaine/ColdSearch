/**
 * Exa (formerly Metaphor) search adapter.
 * Uses Exa's REST API directly.
 * @see https://docs.exa.ai/reference/getting-started
 */
export class ExaAdapter {
    name = "exa";
    capabilities = ["basic_search"];
    async search(query, apiKey) {
        const response = await fetch("https://api.exa.ai/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify({
                query,
                numResults: 10,
                useAutoprompt: true,
                contents: {
                    text: true,
                },
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Exa API error: ${response.status} - ${errorText}`);
        }
        const data = (await response.json());
        // Normalize Exa results to shared schema
        return (data.results || []).map((result, index) => ({
            title: result.title || "",
            url: result.url || "",
            snippet: result.text || "",
            // Exa scores are 0-1, higher is better
            score: result.score ?? (1 - index * 0.1),
            source: this.name,
        }));
    }
}
//# sourceMappingURL=exa.js.map