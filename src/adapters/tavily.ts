import { tavily } from "@tavily/core";
import type { SearchAdapter, NormalizedResult, ExtractResult, CrawlResult } from "../types.js";

/**
 * Tavily search adapter.
 * Implements the SearchAdapter interface for Tavily's search API.
 * Also supports extract and crawl capabilities.
 */
export class TavilyAdapter implements SearchAdapter {
  name = "tavily";
  capabilities = ["search", "extract", "crawl"];

  async search(query: string, apiKey: string): Promise<NormalizedResult[]> {
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

  async extract(url: string, apiKey: string): Promise<ExtractResult> {
    const client = tavily({ apiKey });

    // Tavily has an extract API
    const response = await client.extract([url], {
      includeImages: false,
    });

    const result = response.results?.[0];
    if (!result) {
      throw new Error(`Failed to extract content from ${url}`);
    }

    return {
      content: result.rawContent || "",
      url: result.url || url,
      title: result.title || "",
      source: this.name,
    };
  }

  async crawl(url: string, apiKey: string, options?: { limit?: number }): Promise<CrawlResult[]> {
    // Validate URL
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    // For crawl, we use Tavily's extract on the URL and linked pages
    // First, get the main page content
    const client = tavily({ apiKey });
    
    const limit = options?.limit ?? 10;
    
    // Use search to find related pages from the same domain
    const domain = new URL(url.trim()).hostname;
    const searchResponse = await client.search(`site:${domain}`, {
      searchDepth: "basic",
      includeAnswer: false,
      maxResults: limit,
    });

    const urls = (searchResponse.results || [])
      .map(r => r.url)
      .filter((u): u is string => !!u)
      .slice(0, limit - 1);  // Leave room for original URL

    // Add the original URL if not present
    const normalizedUrl = url.trim();
    if (!urls.includes(normalizedUrl)) {
      urls.unshift(normalizedUrl);
    }

    // Extract content from all URLs
    const extractResponse = await client.extract(urls.slice(0, limit), {
      includeImages: false,
    });

    return (extractResponse.results || []).map(result => ({
      url: result.url || "",
      title: result.title || "",
      content: result.rawContent || "",
    }));
  }
}
