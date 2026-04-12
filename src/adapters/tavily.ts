import { fetchJson } from "../http.js";
import type {
  SearchAdapter,
  NormalizedResult,
  ExtractResult,
  CrawlResult,
  AdapterCallOptions,
  CrawlCallOptions,
} from "../types.js";

interface TavilySearchResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
}

interface TavilyExtractResponse {
  results?: Array<{
    title?: string;
    url?: string;
    rawContent?: string;
    raw_content?: string;
  }>;
}

/**
 * Tavily search adapter.
 * Implements the SearchAdapter interface for Tavily's search API.
 * Also supports extract and crawl capabilities.
 */
export class TavilyAdapter implements SearchAdapter {
  name = "tavily";
  capabilities: SearchAdapter["capabilities"] = ["search", "extract", "crawl"];
  private readonly baseUrl = "https://api.tavily.com";

  private sanitizeLimit(limit?: number): number {
    if (typeof limit !== "number" || !Number.isFinite(limit)) {
      return 10;
    }

    return Math.max(1, Math.floor(limit));
  }

  async search(
    query: string,
    apiKey: string,
    _options?: AdapterCallOptions
  ): Promise<NormalizedResult[]> {
    const response = await fetchJson<TavilySearchResponse>(
      `${this.baseUrl}/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: "basic",
          include_answer: false,
        }),
      },
      { label: "Tavily search" }
    );

    // Normalize Tavily results to the shared schema
    return (response.results || []).map((result, index) => ({
      title: result.title || "",
      url: result.url || "",
      snippet: result.content || "",
      // Tavily scores are 0-1, higher is better
      score: result.score ?? Math.max(0.1, 1 - index * 0.1),
      source: this.name,
    }));
  }

  async extract(
    url: string,
    apiKey: string,
    _options?: AdapterCallOptions
  ): Promise<ExtractResult> {
    const response = await fetchJson<TavilyExtractResponse>(
      `${this.baseUrl}/extract`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          urls: [url],
          include_images: false,
        }),
      },
      { label: "Tavily extract" }
    );

    const result = response.results?.[0];
    if (!result) {
      throw new Error(`Failed to extract content from ${url}`);
    }

    return {
      content: result.rawContent || result.raw_content || "",
      url: result.url || url,
      title: result.title || "",
      source: this.name,
    };
  }

  async crawl(
    url: string,
    apiKey: string,
    options?: CrawlCallOptions
  ): Promise<CrawlResult[]> {
    // Validate URL
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    const limit = this.sanitizeLimit(options?.limit);
    
    // Use search to find related pages from the same domain
    const domain = new URL(url.trim()).hostname;
    const searchResponse = await fetchJson<TavilySearchResponse>(
      `${this.baseUrl}/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: `site:${domain}`,
          search_depth: "basic",
          include_answer: false,
          max_results: limit,
        }),
      },
      { label: "Tavily crawl search" }
    );

    const normalizedUrl = url.trim();
    const uniqueUrls = [
      normalizedUrl,
      ...(searchResponse.results || [])
        .map((result) => result.url)
        .filter((candidate): candidate is string => !!candidate),
    ].filter((candidate, index, allCandidates) => allCandidates.indexOf(candidate) === index)
      .slice(0, limit);

    // Extract content from all URLs
    const extractResponse = await fetchJson<TavilyExtractResponse>(
      `${this.baseUrl}/extract`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          urls: uniqueUrls,
          include_images: false,
        }),
      },
      { label: "Tavily crawl extract" }
    );

    return (extractResponse.results || []).map(result => ({
      url: result.url || "",
      title: result.title || "",
      content: result.rawContent || result.raw_content || "",
    }));
  }
}
