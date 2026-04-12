import type { SearchAdapter, NormalizedResult } from "../types.js";

/**
 * SearXNG search adapter.
 * Implements the SearchAdapter interface for a local SearXNG instance.
 * No API key is required as we host it ourselves via Docker.
 */
export class SearXNGAdapter implements SearchAdapter {
  name = "searxng";
  capabilities = ["search"];

  async search(query: string, baseUrl?: string): Promise<NormalizedResult[]> {
    // Default to localhost if no URL is provided in the keyPool
    const url = baseUrl || "http://localhost:8889";
    const searchUrl = new URL("/search", url);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "json");

    try {
      const response = await fetch(searchUrl.toString());
      if (!response.ok) {
        throw new Error(`SearXNG search failed: ${response.statusText}`);
      }

      const data = await response.json() as {
        results?: Array<{
          title?: string;
          url?: string;
          content?: string;
          score?: number;
          engine?: string;
        }>;
      };

      // Normalize SearXNG results to the shared schema
      return (data.results || []).map((result, index) => ({
        title: result.title || "",
        url: result.url || "",
        snippet: result.content || "",
        // SearXNG scores are relative; we normalize to 0-1 if possible
        // or just use a default descending score if not available
        score: result.score ?? (1 - index * 0.05),
        source: this.name,
      }));
    } catch (error) {
      console.error(`SearXNG error: ${(error as Error).message}`);
      throw error;
    }
  }
}
