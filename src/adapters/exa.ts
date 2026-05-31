import { fetchJson } from "../http.js";
import type {
  SearchAdapter,
  NormalizedResult,
  ExtractResult,
  AdapterCallOptions,
  CrawlResult,
  CrawlCallOptions,
} from "../types.js";

/**
 * Exa API response types
 */
interface ExaSearchResult {
  title?: string;
  url?: string;
  text?: string;
  score?: number;
  highlights?: string[];
  publishedDate?: string;
  author?: string;
}

interface ExaSearchResponse {
  results?: ExaSearchResult[];
  costDollars?: {
    total: number;
    breakDown: Record<string, number>;
  };
}

interface ExaContentsResult {
  title?: string;
  url?: string;
  text?: string;
  publishedDate?: string;
  author?: string;
}

interface ExaContentsResponse {
  results?: ExaContentsResult[];
}

interface ExaFindSimilarResponse {
  results?: Array<{
    title?: string;
    url?: string;
    score?: number;
  }>;
}

/**
 * Exa (formerly Metaphor) search adapter.
 * Uses Exa's REST API directly.
 * @see https://docs.exa.ai/reference/getting-started
 * @see https://docs.exa.ai/reference/search-best-practices
 */
export class ExaAdapter implements SearchAdapter {
  name = "exa";
  capabilities: SearchAdapter["capabilities"] = ["search", "extract", "crawl"];

  /**
   * Execute a search query against Exa's API.
   * Supports highlights (token-efficient), categories, search types, and freshness controls.
   */
  async search(
    query: string,
    apiKey: string,
    options?: AdapterCallOptions
  ): Promise<NormalizedResult[]> {
    const exaOpts = options?.exa;

    // Build contents configuration
    // Default to highlights for token efficiency unless explicitly requesting full text
    const useHighlights = exaOpts?.highlights !== false;
    const contents: Record<string, unknown> = {};

    if (useHighlights) {
      contents.highlights = true;
    } else {
      contents.text = { maxCharacters: exaOpts?.maxCharacters || 15000 };
    }

    // Build request body
    const body: Record<string, unknown> = {
      query,
      numResults: 10,
      useAutoprompt: exaOpts?.useAutoprompt !== false,
      contents,
    };

    // Add optional parameters
    if (exaOpts?.category) {
      body.category = exaOpts.category;
    }

    if (exaOpts?.searchType) {
      body.type = exaOpts.searchType;
    }

    if (exaOpts?.maxAgeHours !== undefined) {
      body.maxAgeHours = exaOpts.maxAgeHours;
    }

    if (exaOpts?.includeDomains?.length) {
      body.includeDomains = exaOpts.includeDomains;
    }

    if (exaOpts?.excludeDomains?.length) {
      body.excludeDomains = exaOpts.excludeDomains;
    }

    const data = await fetchJson<ExaSearchResponse>(
      "https://api.exa.ai/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      },
      { label: "Exa search" }
    );

    // Normalize Exa results to shared schema
    return (data.results || []).map((result, index) => {
      // Use highlights as snippet if available, otherwise fall back to text
      let snippet = "";
      if (result.highlights?.length) {
        snippet = result.highlights.join("\n");
      } else if (result.text) {
        snippet = result.text;
      }

      return {
        title: result.title || "",
        url: result.url || "",
        snippet,
        // Exa scores are 0-1, higher is better
        score: result.score ?? 1 - index * 0.1,
        source: this.name,
      };
    });
  }

  /**
   * Extract content from a single URL using Exa's /contents endpoint with livecrawl.
   */
  async extract(
    url: string,
    apiKey: string,
    options?: AdapterCallOptions
  ): Promise<ExtractResult> {
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    const normalizedUrl = url.trim();
    const exaOpts = options?.exa;

    const body: Record<string, unknown> = {
      urls: [normalizedUrl],
      text: { maxCharacters: exaOpts?.maxCharacters || 15000 },
      livecrawl: "preferred",
      livecrawl_timeout: 10000,
    };

    const data = await fetchJson<ExaContentsResponse>(
      "https://api.exa.ai/contents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      },
      { label: "Exa extract" }
    );

    const result = data.results?.[0];
    if (!result) {
      throw new Error(`Failed to extract content from ${url}`);
    }

    return {
      content: result.text || "",
      url: result.url || normalizedUrl,
      title: result.title || "",
      source: this.name,
    };
  }

  /**
   * Crawl a website by discovering pages via site: search, then extracting contents.
   * Uses Exa's discovery + livecrawl for fresh content.
   */
  async crawl(
    url: string,
    apiKey: string,
    options?: CrawlCallOptions
  ): Promise<CrawlResult[]> {
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    const normalizedUrl = url.trim();
    const limit =
      typeof options?.limit === "number" && Number.isFinite(options.limit)
        ? Math.max(1, Math.floor(options.limit))
        : 10;

    let domain: string;
    try {
      domain = new URL(normalizedUrl).hostname;
    } catch {
      throw new Error(`Invalid crawl URL: ${normalizedUrl}`);
    }

    // Discover candidate pages via Exa search
    const searchData = await fetchJson<ExaSearchResponse>(
      "https://api.exa.ai/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query: `site:${domain}`,
          numResults: limit,
          useAutoprompt: false,
        }),
      },
      { label: "Exa crawl discover" }
    );

    // Deduplicate URLs and limit
    const candidateUrls = [
      normalizedUrl,
      ...(searchData.results || [])
        .map((r) => r.url)
        .filter((candidate): candidate is string => !!candidate),
    ]
      .filter((candidate, idx, all) => all.indexOf(candidate) === idx)
      .slice(0, limit);

    // Fetch contents with livecrawl
    const contents = await fetchJson<ExaContentsResponse>(
      "https://api.exa.ai/contents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          urls: candidateUrls,
          text: { maxCharacters: 12000 },
          livecrawl: "preferred",
          livecrawl_timeout: 10000,
        }),
      },
      { label: "Exa crawl contents" }
    );

    return (contents.results || []).map((result) => ({
      url: result.url || "",
      title: result.title || "",
      content: result.text || "",
    }));
  }

  /**
   * Find similar pages to a given URL using Exa's /findSimilar endpoint.
   * This is Exa's unique semantic neighbor discovery feature.
   */
  async findSimilar(
    url: string,
    apiKey: string,
    options?: AdapterCallOptions & { numResults?: number }
  ): Promise<NormalizedResult[]> {
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    const normalizedUrl = url.trim();
    const numResults = options?.numResults || 10;

    const data = await fetchJson<ExaFindSimilarResponse>(
      "https://api.exa.ai/findSimilar",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          url: normalizedUrl,
          numResults,
        }),
      },
      { label: "Exa findSimilar" }
    );

    return (data.results || []).map((result, index) => ({
      title: result.title || "",
      url: result.url || "",
      snippet: "",
      score: result.score ?? 1 - index * 0.1,
      source: this.name,
    }));
  }
}
