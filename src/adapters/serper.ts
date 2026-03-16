import type { SearchAdapter, NormalizedResult } from "../types.js";

/**
 * Serper.dev (Google Search API) response types
 */
interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

interface SerperSearchResponse {
  organic?: SerperOrganicResult[];
}

/**
 * Serper.dev Google Search adapter.
 * Uses Serper's REST API for Google search results.
 * @see https://serper.dev/docs
 */
export class SerperAdapter implements SearchAdapter {
  name = "serper";
  capabilities = ["basic_search"];

  async search(query: string, apiKey: string): Promise<NormalizedResult[]> {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serper API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as SerperSearchResponse;

    // Normalize Serper results to shared schema
    return (data.organic || []).map((result, index) => ({
      title: result.title || "",
      url: result.link || "",
      snippet: result.snippet || "",
      // Serper doesn't provide relevance scores, use position-based
      score: 1 / (result.position || index + 1),
      source: this.name,
    }));
  }
}
