import { fetchJson, fetchText, HTTPRequestError } from "../http.js";
import { KeyPoolManager } from "../engine/keypool.js";
import { getToolProfile, isHardExcluded } from "../registry/tool-profiles.js";
import { UsageLogger } from "../logging/usage.js";
import type { Config } from "../types.js";
import { performance } from "node:perf_hooks";
import {
  buildBrightDataSummary,
  buildBrightDataToolRequest,
} from "./brightdata.js";

export interface ToolCallResult {
  provider: string;
  tool: string;
  ok: boolean;
  catalogued: boolean;
  summary: Record<string, any> | null;
  raw: any | null;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    duration_ms: number;
    safe_key_ref: string | null;
    warnings: string[];
  };
}

/**
 * Builds standard summaries for catalogued tools (non-lossy additions only).
 */
function buildToolSummary(provider: string, tool: string, raw: any): Record<string, any> | null {
  if (!raw) return null;

  try {
    if (provider === "brightdata") {
      return buildBrightDataSummary(tool, raw);
    }

    if (provider === "exa") {
      if (tool === "search" || tool === "findSimilar") {
        return {
          results_count: raw.results?.length ?? 0,
          top_links: (raw.results || []).slice(0, 3).map((r: any) => r.url),
        };
      }
      if (tool === "contents") {
        return {
          results_count: raw.results?.length ?? 0,
          titles: (raw.results || []).map((r: any) => r.title ?? ""),
        };
      }
      if (tool === "answer") {
        return {
          has_answer: typeof raw.answer === "string" && raw.answer.length > 0,
          answer_preview: typeof raw.answer === "string" ? raw.answer.slice(0, 100) : "",
        };
      }
    }

    if (provider === "tavily") {
      if (tool === "search" || tool === "answer") {
        return {
          results_count: raw.results?.length ?? 0,
          top_links: (raw.results || []).slice(0, 3).map((r: any) => r.url),
          has_answer: typeof raw.answer === "string" && raw.answer.length > 0,
        };
      }
      if (tool === "extract") {
        return {
          results_count: raw.results?.length ?? 0,
          titles: (raw.results || []).map((r: any) => r.title ?? ""),
        };
      }
      if (tool === "crawl") {
        return {
          results_count: raw.results?.length ?? 0,
          top_links: (raw.results || []).slice(0, 3).map((r: any) => r.url),
        };
      }
      if (tool === "map") {
        return {
          results_count: raw.results?.length ?? 0,
        };
      }
      if (tool === "research") {
        return {
          has_report: typeof raw.report === "string" && raw.report.length > 0,
        };
      }
    }

    if (provider === "firecrawl") {
      if (tool === "search") {
        return {
          results_count: raw.data?.web?.length ?? raw.data?.length ?? 0,
        };
      }
      if (tool === "scrape") {
        return {
          success: raw.success ?? false,
          content_length: raw.data?.markdown?.length ?? 0,
          title: raw.data?.metadata?.title ?? "",
        };
      }
      if (tool === "crawl") {
        return {
          success: raw.success ?? false,
          job_id: raw.id ?? null,
          status: raw.status ?? null,
        };
      }
      if (tool === "map") {
        return {
          success: raw.success ?? false,
          links_count: raw.links?.length ?? raw.data?.length ?? 0,
        };
      }
      if (tool === "extract") {
        return {
          success: raw.success ?? false,
        };
      }
    }

    if (provider === "brave") {
      if (tool === "webSearch" || tool === "llmContext") {
        return {
          results_count: raw.web?.results?.length ?? 0,
        };
      }
    }

    if (provider === "serper") {
      if (tool === "search") {
        return {
          results_count: raw.organic?.length ?? 0,
        };
      }
    }

    if (provider === "jina") {
      if (tool === "reader") {
        return {
          length: typeof raw === "string" ? raw.length : 0,
        };
      }
    }

    if (provider === "searxng") {
      if (tool === "search") {
        return {
          results_count: raw.results?.length ?? 0,
        };
      }
    }
  } catch {
    // Treat any error in framing summary as non-blocking: fallback to null
  }

  return null;
}

/**
 * Execute a generic provider tool call.
 * Handles key resolution, timeout/error logic, warn-but-forward, and usage logging.
 */
export async function executeToolCall(
  provider: string,
  tool: string,
  params: Record<string, any>,
  config: Config
): Promise<ToolCallResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  // 1. Validate known/configured provider
  const knownProviders = [
    "tavily",
    "brave",
    "brightdata",
    "exa",
    "serper",
    "jina",
    "firecrawl",
    "searxng",
  ];
  const isConfigured = config.providers[provider] !== undefined;
  if (!isConfigured && !knownProviders.includes(provider)) {
    return {
      provider,
      tool,
      ok: false,
      catalogued: false,
      summary: null,
      raw: null,
      error: {
        code: "UNKNOWN_PROVIDER",
        message: `Provider '${provider}' is not configured or recognized.`,
      },
      meta: { duration_ms: 0, safe_key_ref: null, warnings },
    };
  }

  // 2. Validate hard exclusions (registry-driven; see HARD_EXCLUDED_TOOLS)
  const toolId = `${provider}.${tool}`;
  const registryProfile = getToolProfile(toolId);

  if (isHardExcluded(toolId)) {
    return {
      provider,
      tool,
      ok: false,
      catalogued: registryProfile !== undefined,
      summary: null,
      raw: null,
      error: {
        code: "HARD_EXCLUDED",
        message: `Tool '${provider}.${tool}' is hard-excluded: it runs an autonomous agent, mutates remote state, or requires complex stateful setup.`,
      },
      meta: { duration_ms: 0, safe_key_ref: null, warnings },
    };
  }

  // 3. Inform uncatalogued tool warnings
  const catalogued = registryProfile !== undefined;
  if (!catalogued) {
    warnings.push(`Tool '${provider}.${tool}' is uncatalogued.`);
  }

  // 4. Resolve key from key pool managers
  const keyPool = new KeyPoolManager();
  for (const [p, providerConfig] of Object.entries(config.providers)) {
    keyPool.register(p, providerConfig.keyPool);
  }

  let keyResult = { value: "", ref: "keyless" };
  // Keyless is per-tool, not per-provider: jina.reader is keyless but
  // jina.embeddings/rerank require auth, so don't blanket-exempt jina. SearXNG
  // is self-hosted and always keyless even for uncatalogued tools.
  const expectsKey = !(
    registryProfile?.features?.keyless === true ||
    provider === "searxng"
  );

  if (expectsKey && isConfigured) {
    try {
      keyResult = await keyPool.getNextKeyWithRef(provider);
    } catch (err: any) {
      return {
        provider,
        tool,
        ok: false,
        catalogued,
        summary: null,
        raw: null,
        error: {
          code: "KEY_RESOLUTION_FAILED",
          message: `Key resolution failed: ${err.message}`,
        },
        meta: { duration_ms: 0, safe_key_ref: null, warnings },
      };
    }
  }

  const apiKey = keyResult.value;
  const safeKeyRefStr = keyResult.ref;

  // 5. Fire HTTP Request depending on mapper
  let url = "";
  let method = "POST";
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: string | null = null;
  let useTextParser = false;

  // Construct Provider Call
  try {
    if (provider === "exa") {
      url = `https://api.exa.ai/${tool}`;
      headers["x-api-key"] = apiKey;
      body = JSON.stringify(params);
    } else if (provider === "tavily") {
      const activePath = tool === "answer" ? "search" : tool;
      url = `https://api.tavily.com/${activePath}`;
      headers["Authorization"] = `Bearer ${apiKey}`;
      const payload = { ...params };
      if (tool === "answer") {
        payload.include_answer = true;
      }
      payload.api_key = apiKey; // safety double compliance
      body = JSON.stringify(payload);
    } else if (provider === "firecrawl") {
      url = `https://api.firecrawl.dev/v2/${tool}`;
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = JSON.stringify(params);
    } else if (provider === "brave") {
      method = "GET";
      headers = {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      };
      
      let bravePath = `/res/v1/${tool}`;
      if (tool === "webSearch") bravePath = "/res/v1/web/search";
      else if (tool === "llmContext") bravePath = "/res/v1/summarizer/llm_context";
      else if (tool === "newsSearch") bravePath = "/res/v1/news/search";
      else if (tool === "videoSearch") bravePath = "/res/v1/video/search";
      else if (tool === "imageSearch") bravePath = "/res/v1/image/search";

      const urlObj = new URL(`https://api.search.brave.com${bravePath}`);
      for (const [k, v] of Object.entries(params)) {
        urlObj.searchParams.set(k, String(v));
      }
      url = urlObj.toString();
    } else if (provider === "brightdata") {
      const request = buildBrightDataToolRequest(tool, params, apiKey, config);
      url = request.url;
      method = request.method;
      headers = request.headers;
      body = request.body;
      useTextParser = request.useTextParser;
    } else if (provider === "serper") {
      url = `https://google.serper.dev/${tool}`;
      headers["X-API-KEY"] = apiKey;
      body = JSON.stringify(params);
    } else if (provider === "jina") {
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      
      if (tool === "reader" || (params.url && !params.q)) {
        useTextParser = true;
        headers["Accept"] = "text/plain";
        method = "GET";
        const targetUrl = params.url || params.q || "";
        // r.jina.ai takes the target URL appended raw (matches JinaAdapter).
        // Do NOT encode here: encodeURI corrupts already-encoded targets
        // (%20 -> %2520) and the reader expects the literal URL.
        url = `https://r.jina.ai/${targetUrl}`;
      } else {
        // e.g. jina embeddings, rerank
        url = `https://api.jina.ai/v1/${tool}`;
        body = JSON.stringify(params);
      }
    } else if (provider === "searxng") {
      method = "GET";
      const configuredBaseUrl = config.providers.searxng?.options?.baseUrl;
      const baseUrl = typeof configuredBaseUrl === "string"
        ? configuredBaseUrl
        : process.env.SEARXNG_BASE_URL;

      if (!baseUrl) {
        throw new Error("SearXNG requires providers.searxng.options.baseUrl or SEARXNG_BASE_URL");
      }

      const endpointBase = new URL(baseUrl);
      endpointBase.pathname = endpointBase.pathname.endsWith("/")
        ? endpointBase.pathname
        : `${endpointBase.pathname}/`;

      const searchUrl = new URL(tool === "search" ? "search" : tool, endpointBase);
      for (const [k, v] of Object.entries(params)) {
        searchUrl.searchParams.set(k, String(v));
      }
      if (!searchUrl.searchParams.has("format")) {
        searchUrl.searchParams.set("format", "json");
      }
      url = searchUrl.toString();
    }

    // Fire HTTP call
    let rawResponse: any;
    if (useTextParser) {
      rawResponse = await fetchText(url, { method, headers }, { label: `${provider}.${tool}` });
    } else {
      rawResponse = await fetchJson(
        url,
        { method, headers, ...(body ? { body } : {}) },
        { label: `${provider}.${tool}` }
      );
    }

    const duration = Math.round(performance.now() - startTime);

    // Logging
    const logger = new UsageLogger({ path: config.logging?.usage?.path });
    logger.write({
      timestamp: new Date().toISOString(),
      provider,
      tool,
      catalogued,
      key: safeKeyRefStr || "keyless",
      success: true,
      response_time_ms: duration,
    });

    return {
      provider,
      tool,
      ok: true,
      catalogued,
      summary: buildToolSummary(provider, tool, rawResponse),
      raw: rawResponse,
      meta: {
        duration_ms: duration,
        safe_key_ref: safeKeyRefStr || null,
        warnings,
      },
    };
  } catch (err: any) {
    const duration = Math.round(performance.now() - startTime);

    // The provider's response body is untrusted and may echo secrets back
    // (e.g. Tavily reflects api_key in the request body). Keep it OUT of the
    // logged and returned error *string* — preserve it only in `raw`, which
    // already sits at the caller's trust boundary. This removes any need to
    // scrub keys from error text after the fact.
    let errBody: string | undefined;
    let errorMsg = err.message;
    if (err instanceof HTTPRequestError) {
      errBody = err.body;
      errorMsg = `API request to ${provider}.${tool} failed with HTTP ${err.status}`;
    }

    const logger = new UsageLogger({ path: config.logging?.usage?.path });
    logger.write({
      timestamp: new Date().toISOString(),
      provider,
      tool,
      catalogued,
      key: safeKeyRefStr || "keyless",
      success: false,
      response_time_ms: duration,
      error: errorMsg,
    });

    let parsedRawError: any = null;
    if (errBody) {
      try {
        parsedRawError = JSON.parse(errBody);
      } catch {
        parsedRawError = errBody;
      }
    }

    return {
      provider,
      tool,
      ok: false,
      catalogued,
      summary: null,
      raw: parsedRawError,
      error: {
        code: "PROVIDER_ERROR",
        message: errorMsg,
      },
      meta: {
        duration_ms: duration,
        safe_key_ref: safeKeyRefStr || null,
        warnings,
      },
    };
  }
}
