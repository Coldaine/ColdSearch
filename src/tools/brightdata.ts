import type { Config } from "../types.js";

export interface BrightDataToolRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  useTextParser: boolean;
}

function configuredString(
  config: Config,
  key: string,
  envName?: string
): string | undefined {
  const value = config.providers.brightdata?.options?.[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (envName) {
    const envValue = process.env[envName];
    if (envValue?.trim()) return envValue.trim();
  }
  return undefined;
}

function configuredPositiveInteger(config: Config, key: string, fallback: number): number {
  const value = config.providers.brightdata?.options?.[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value) && Number(value) > 0) {
    return Number(value);
  }
  return fallback;
}

function requireValue(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Bright Data ${name} is required`);
  }
  return value.trim();
}

function snapshotId(params: Record<string, any>): string {
  return requireValue(params.snapshot_id ?? params.snapshotId ?? params.id, "snapshot_id");
}

function requireZone(
  params: Record<string, any>,
  config: Config,
  optionKey: "serpZone" | "unlockerZone",
  envName: string
): string {
  const explicit = typeof params.zone === "string" ? params.zone.trim() : "";
  if (explicit) return explicit;
  const configured = configuredString(config, optionKey, envName);
  if (configured) return configured;
  throw new Error(
    `Bright Data requires params.zone, providers.brightdata.options.${optionKey}, or ${envName}`
  );
}

function searchUrlFromQuery(query: string, engine: string): string {
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

function inputsFromParams(params: Record<string, any>, config: Config): unknown[] {
  let inputs: unknown[];
  if (Array.isArray(params.inputs)) inputs = params.inputs;
  else if (Array.isArray(params.input)) inputs = params.input;
  else if (params.input && typeof params.input === "object") inputs = [params.input];
  else throw new Error("Bright Data scraper tool requires input or inputs");

  // Bright Data documents a maximum of 20 URLs/items for synchronous scraper
  // requests. Keep the same conservative default for structured calls; an
  // operator can raise it deliberately for async jobs after considering spend.
  const maxInputs = configuredPositiveInteger(config, "maxStructuredInputsPerCall", 20);
  if (inputs.length === 0) {
    throw new Error("Bright Data scraper tool requires at least one input record");
  }
  if (inputs.length > maxInputs) {
    throw new Error(
      `Bright Data structured request has ${inputs.length} inputs; configured maximum is ${maxInputs}. ` +
        "Increase providers.brightdata.options.maxStructuredInputsPerCall deliberately for larger paid runs."
    );
  }
  return inputs;
}

function appendNativeQueryParams(
  requestUrl: URL,
  params: Record<string, any>,
  excluded: ReadonlySet<string>
): void {
  for (const [key, value] of Object.entries(params)) {
    if (excluded.has(key) || value === undefined || value === null) continue;
    if (["string", "number", "boolean"].includes(typeof value)) {
      requestUrl.searchParams.set(key, String(value));
    }
  }
}

/** Build an authenticated provider-native Bright Data HTTP request. */
export function buildBrightDataToolRequest(
  tool: string,
  params: Record<string, any>,
  apiKey: string,
  config: Config
): BrightDataToolRequest {
  const baseUrl = "https://api.brightdata.com";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (tool === "serp") {
    const zone = requireZone(params, config, "serpZone", "BRIGHTDATA_SERP_ZONE");
    const engine =
      typeof params.searchEngine === "string"
        ? params.searchEngine
        : configuredString(config, "searchEngine") || "google";
    const url =
      typeof params.url === "string" && params.url.trim()
        ? params.url.trim()
        : searchUrlFromQuery(requireValue(params.query ?? params.q, "query or url"), engine);
    const country =
      typeof params.country === "string"
        ? params.country
        : configuredString(config, "searchCountry") || "us";

    const payload: Record<string, any> = {
      ...params,
      zone,
      url,
      format: params.format || "json",
      method: params.method || "GET",
      country,
    };
    delete payload.query;
    delete payload.q;
    delete payload.searchEngine;

    return {
      url: `${baseUrl}/request`,
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      useTextParser: false,
    };
  }

  if (tool === "unlocker") {
    const zone = requireZone(params, config, "unlockerZone", "BRIGHTDATA_UNLOCKER_ZONE");
    const targetUrl = requireValue(params.url, "url");
    const format = typeof params.format === "string" ? params.format : "raw";
    const payload = {
      ...params,
      zone,
      url: targetUrl,
      format,
      method: params.method || "GET",
      data_format: params.data_format || "markdown",
    };

    return {
      url: `${baseUrl}/request`,
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      useTextParser: format === "raw",
    };
  }

  if (tool === "datasetsList") {
    return {
      url: `${baseUrl}/datasets/list`,
      method: "GET",
      headers,
      body: null,
      useTextParser: false,
    };
  }

  if (tool === "datasetMetadata") {
    const datasetId = requireValue(params.dataset_id ?? params.datasetId, "dataset_id");
    return {
      url: `${baseUrl}/datasets/${encodeURIComponent(datasetId)}/metadata`,
      method: "GET",
      headers,
      body: null,
      useTextParser: false,
    };
  }

  if (tool === "scrape") {
    const datasetId = requireValue(params.dataset_id ?? params.datasetId, "dataset_id");
    const format = typeof params.format === "string" ? params.format : "json";
    const requestUrl = new URL(`${baseUrl}/datasets/v3/scrape`);
    requestUrl.searchParams.set("dataset_id", datasetId);
    requestUrl.searchParams.set("format", format);
    appendNativeQueryParams(
      requestUrl,
      params,
      new Set(["dataset_id", "datasetId", "input", "inputs", "format"])
    );

    return {
      url: requestUrl.toString(),
      method: "POST",
      headers,
      body: JSON.stringify(inputsFromParams(params, config)),
      useTextParser: format !== "json",
    };
  }

  if (tool === "trigger" || tool === "crawl") {
    const datasetId = requireValue(params.dataset_id ?? params.datasetId, "dataset_id");
    const requestUrl = new URL(`${baseUrl}/datasets/v3/trigger`);
    requestUrl.searchParams.set("dataset_id", datasetId);
    appendNativeQueryParams(
      requestUrl,
      params,
      new Set(["dataset_id", "datasetId", "input", "inputs"])
    );

    return {
      url: requestUrl.toString(),
      method: "POST",
      headers,
      body: JSON.stringify(inputsFromParams(params, config)),
      useTextParser: false,
    };
  }

  if (tool === "progress") {
    return {
      url: `${baseUrl}/datasets/v3/progress/${encodeURIComponent(snapshotId(params))}`,
      method: "GET",
      headers,
      body: null,
      useTextParser: false,
    };
  }

  if (tool === "snapshotMetadata") {
    return {
      url: `${baseUrl}/datasets/snapshots/${encodeURIComponent(snapshotId(params))}`,
      method: "GET",
      headers,
      body: null,
      useTextParser: false,
    };
  }

  if (tool === "cancel") {
    return {
      url: `${baseUrl}/datasets/v3/snapshot/${encodeURIComponent(snapshotId(params))}/cancel`,
      method: "POST",
      headers,
      body: null,
      useTextParser: false,
    };
  }

  if (tool === "snapshot") {
    const format = typeof params.format === "string" ? params.format : "json";
    const requestUrl = new URL(
      `${baseUrl}/datasets/v3/snapshot/${encodeURIComponent(snapshotId(params))}`
    );
    requestUrl.searchParams.set("format", format);
    appendNativeQueryParams(
      requestUrl,
      params,
      new Set(["snapshot_id", "snapshotId", "id", "format"])
    );

    return {
      url: requestUrl.toString(),
      method: "GET",
      headers,
      body: null,
      useTextParser: format !== "json",
    };
  }

  if (tool === "discover") {
    return {
      url: `${baseUrl}/discover`,
      method: "POST",
      headers,
      body: JSON.stringify(params),
      useTextParser: false,
    };
  }

  throw new Error(`Unsupported Bright Data tool mapper: ${tool}`);
}

export function buildBrightDataSummary(
  tool: string,
  raw: any
): Record<string, any> | null {
  if (raw == null) return null;

  if (tool === "serp") {
    return {
      results_count: raw.organic?.length ?? 0,
      search_engine: raw.general?.search_engine ?? null,
      query: raw.general?.query ?? null,
      cost_usd: typeof raw.cost === "number" ? raw.cost : null,
    };
  }

  if (tool === "datasetsList") {
    return { datasets_count: Array.isArray(raw) ? raw.length : 0 };
  }

  if (tool === "datasetMetadata") {
    return {
      dataset_id: raw.id ?? null,
      fields_count: raw.fields && typeof raw.fields === "object"
        ? Object.keys(raw.fields).length
        : 0,
    };
  }

  if (tool === "scrape") {
    return {
      records_count: Array.isArray(raw) ? raw.length : raw ? 1 : 0,
      snapshot_id: raw?.snapshot_id ?? null,
      cost_usd: typeof raw?.cost === "number" ? raw.cost : null,
    };
  }

  if (tool === "trigger" || tool === "crawl") {
    return {
      snapshot_id: raw.snapshot_id ?? raw.id ?? null,
      cost_usd: typeof raw.cost === "number" ? raw.cost : null,
    };
  }

  if (tool === "progress") {
    return {
      snapshot_id: raw.snapshot_id ?? null,
      dataset_id: raw.dataset_id ?? null,
      status: raw.status ?? null,
    };
  }

  if (tool === "snapshotMetadata") {
    return {
      snapshot_id: raw.id ?? raw.snapshot_id ?? null,
      dataset_id: raw.dataset_id ?? null,
      status: raw.status ?? null,
      records_count: raw.dataset_size ?? null,
      cost_usd: typeof raw.cost === "number" ? raw.cost : null,
    };
  }

  if (tool === "cancel") {
    return {
      snapshot_id: raw.snapshot_id ?? raw.id ?? null,
      status: raw.status ?? "cancel_requested",
    };
  }

  if (tool === "snapshot") {
    return { records_count: Array.isArray(raw) ? raw.length : raw ? 1 : 0 };
  }

  if (tool === "discover") {
    return {
      task_id: raw.task_id ?? null,
      status: raw.status ?? null,
      cost_usd: typeof raw.cost === "number" ? raw.cost : null,
    };
  }

  if (tool === "unlocker") {
    return {
      content_length:
        typeof raw === "string"
          ? raw.length
          : typeof raw.body === "string"
            ? raw.body.length
            : 0,
      cost_usd: typeof raw?.cost === "number" ? raw.cost : null,
    };
  }

  return null;
}
