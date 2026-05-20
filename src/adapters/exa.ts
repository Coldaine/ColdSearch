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
 * Exa (formerly Metaphor) search adapter.
 * Uses Exa's REST API directly.
 * @see https://docs.exa.ai/reference/getting-started
 */
export class ExaAdapter implements SearchAdapter {
  name = "exa";
  capabilities: SearchAdapter["capabilities"] = ["search", "extract", "crawl"];

  async search(
    query: string,
    apiKey: string,
    _options?: AdapterCallOptions
  ): Promise<NormalizedResult[]> {
    const data = await fetchJson<{
      results?: Array<{
        title?: string;
        url?: string;
        text?: string;
        score?: number;
      }>;
    }>("https://api.exa.ai/search", {
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
    }, {
      label: "Exa search",
    });

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

  async extract(
    url: string,
    apiKey: string,
    _options?: AdapterCallOptions
  ): Promise<ExtractResult> {
    // Validate URL
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    const normalizedUrl = url.trim();

    const data = await fetchJson<{
      results?: Array<{
        title?: string;
        url?: string;
        text?: string;
      }>;
    }>("https://api.exa.ai/contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        urls: [normalizedUrl],
        text: true,
      }),
    }, {
      label: "Exa extract",
    });

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

  async crawl(
    url: string,
    apiKey: string,
    options?: CrawlCallOptions
  ): Promise<CrawlResult[]> {
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    const normalizedUrl = url.trim();
    const rawLimit = options?.limit;
    const limit =
      typeof rawLimit === "number" && Number.isFinite(rawLimit)
        ? Math.max(1, Math.floor(rawLimit))
        : 10;

    const domain = new URL(normalizedUrl).hostname;

    // Discover candidate pages via Exa search, then fetch contents with livecrawl.
    const searchData = await fetchJson<{
      results?: Array<{
        title?: string;
        url?: string;
      }>;
    }>("https://api.exa.ai/search", {
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
    }, {
      label: "Exa crawl discover",
    });

    const candidateUrls = [
      normalizedUrl,
      ...(searchData.results || [])
        .map((r) => r.url)
        .filter((candidate): candidate is string => !!candidate),
    ]
      .filter((candidate, idx, all) => all.indexOf(candidate) === idx)
      .slice(0, limit);

    const contents = await fetchJson<{
      results?: Array<{
        title?: string;
        url?: string;
        text?: string;
      }>;
    }>("https://api.exa.ai/contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        urls: candidateUrls,
        text: { max_characters: 12000 },
        livecrawl: "preferred",
        livecrawl_timeout: 10000,
      }),
    }, {
      label: "Exa crawl contents",
    });

    return (contents.results || []).map((result) => ({
      url: result.url || "",
      title: result.title || "",
      content: result.text || "",
    }));
  }
}
