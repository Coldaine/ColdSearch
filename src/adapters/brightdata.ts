import { fetchJson, fetchText } from "../http.js";
import type {
  AdapterCallOptions,
  ExtractResult,
  NormalizedResult,
  SearchAdapter,
} from "../types.js";

interface BrightDataSerpOrganicResult {
  title?: string;
  link?: string;
  description?: string;
  snippet?: string;
  source?: string;
  rank?: number;
  position?: number;
}

interface BrightDataSerpResponse {
  organic?: BrightDataSerpOrganicResult[];
}

function requireStringOption(
  options: AdapterCallOptions | undefined,
  key: string,
  envName?: string
): string {
  const configured = options?.providerOptions?.[key];
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  if (envName) {
    const fromEnv = process.env[envName];
    if (fromEnv?.trim()) return fromEnv.trim();
  }
  throw new Error(
    `Bright Data requires providers.brightdata.options.${key}` +
      (envName ? ` or ${envName}` : "")
  );
}

function optionalStringOption(
  options: AdapterCallOptions | undefined,
  key: string,
  fallback: string
): string {
  const configured = options?.providerOptions?.[key];
  return typeof configured === "string" && configured.trim()
    ? configured.trim()
    : fallback;
}

function buildSearchUrl(query: string, engine: string): string {
  const q = encodeURIComponent(query);
  switch (engine.toLowerCase()) {
    case "bing":
      return `https://www.bing.com/search?q=${q}`;
    case "duckduckgo":
    case "ddg":
      return `https://duckduckgo.com/?q=${q}`;
    case "google":
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}

/**
 * Bright Data adapter.
 *
 * Normalized `search` uses Bright Data SERP API. Normalized `extract` uses
 * Web Unlocker with Markdown output. Bright Data's site-specific Web Scraper
 * APIs remain provider-native tools because their structured schemas are not a
 * generic page-extraction contract.
 */
export class BrightDataAdapter implements SearchAdapter {
  name = "brightdata";
  capabilities: SearchAdapter["capabilities"] = ["search", "extract"];
  private baseUrl = "https://api.brightdata.com";

  async search(
    query: string,
    apiKey: string,
    options?: AdapterCallOptions
  ): Promise<NormalizedResult[]> {
    if (!query?.trim()) throw new Error("Query is required");

    const zone = requireStringOption(options, "serpZone", "BRIGHTDATA_SERP_ZONE");
    const engine = optionalStringOption(options, "searchEngine", "google");
    const country = optionalStringOption(options, "searchCountry", "us");

    const data = await fetchJson<BrightDataSerpResponse>(
      `${this.baseUrl}/request`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          zone,
          url: buildSearchUrl(query.trim(), engine),
          format: "json",
          method: "GET",
          country,
        }),
      },
      { label: "Bright Data SERP search" }
    );

    return (data.organic || []).map((result, index) => {
      const resolvedPosition =
        (typeof result.position === "number" && result.position > 0
          ? result.position
          : typeof result.rank === "number" && result.rank > 0
            ? result.rank
            : index + 1);

      return {
        title: result.title || result.source || "",
        url: result.link || "",
        snippet: result.description || result.snippet || "",
        score: 1 / resolvedPosition,
        source: this.name,
      };
    });
  }

  async extract(
    url: string,
    apiKey: string,
    options?: AdapterCallOptions
  ): Promise<ExtractResult> {
    if (!url?.trim()) throw new Error("URL is required");

    const zone = requireStringOption(options, "unlockerZone", "BRIGHTDATA_UNLOCKER_ZONE");
    const country = optionalStringOption(options, "searchCountry", "us");
    const normalizedUrl = url.trim();

    const content = await fetchText(
      `${this.baseUrl}/request`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          zone,
          url: normalizedUrl,
          format: "raw",
          method: "GET",
          country,
          data_format: "markdown",
        }),
      },
      { label: "Bright Data Web Unlocker extract" }
    );

    return {
      content,
      url: normalizedUrl,
      source: this.name,
    };
  }
}
