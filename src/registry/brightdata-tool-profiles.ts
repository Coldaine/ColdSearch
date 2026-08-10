import type { ProviderToolProfile } from "../types.js";
import { providerToolProfiles } from "./tool-profiles.js";

const VERIFIED = "2026-08-10";

const brightDataToolProfiles: Record<string, ProviderToolProfile> = {
  "brightdata.serp": {
    provider: "brightdata",
    tool: "serp",
    nativeName: "POST /request (SERP zone)",
    categories: ["search"],
    description:
      "Bright Data SERP API. A configured SERP zone retrieves structured search-engine results and backs normalized ColdSearch search.",
    docsUrl: "https://docs.brightdata.com/scraping-automation/serp-api/introduction",
    requiredParams: ["query"],
    optionalParams: ["url", "zone", "searchEngine", "country", "format", "method"],
    commonViews: [
      {
        category: "search",
        semanticFit: "direct",
        mapsCommonOptions: { query: "search-engine URL", freshness: "provider-native URL parameters" },
        unsupportedCommonOptions: ["includeDomains", "excludeDomains"],
        nativeOptionsWithoutCommonEquivalent: ["zone", "searchEngine", "country"],
        notes:
          "Normalized search consumes organic results only. Shopping/local/other SERP blocks remain provider-native detail.",
      },
    ],
    features: {
      rankedLinks: true,
      integratedContent: false,
      structuredJson: true,
      vertical: true,
      keyless: false,
    },
    execution: { mode: "sync", supportsWait: true },
    output: { rawPreserved: true, summarySupported: true, resultEnvelope: "search" },
    schemaSource: "official-docs",
    schemaLastVerified: VERIFIED,
    status: "wired",
    adapterMethod: "search",
    costNotes: "Paid Bright Data product; keep out of default pools until quality/cost are intentionally evaluated.",
  },
  "brightdata.unlocker": {
    provider: "brightdata",
    tool: "unlocker",
    nativeName: "POST /request (Web Unlocker zone)",
    categories: ["extract"],
    description:
      "Bright Data Web Unlocker known-URL retrieval for blocked/dynamic public pages. Backs normalized extract without changing agent fetch semantics.",
    docsUrl: "https://docs.brightdata.com/scraping-automation/web-unlocker/introduction",
    requiredParams: ["url"],
    optionalParams: ["zone", "format", "method", "country", "data_format"],
    commonViews: [
      {
        category: "extract",
        semanticFit: "direct",
        mapsCommonOptions: { url: "url", format: "data_format" },
        unsupportedCommonOptions: ["javascriptActions", "screenshots"],
        nativeOptionsWithoutCommonEquivalent: ["zone", "country"],
      },
    ],
    features: {
      knownUrl: true,
      javascriptRendering: true,
      integratedContent: true,
      antiBotBypass: true,
      keyless: false,
    },
    execution: { mode: "sync", supportsWait: true },
    output: { rawPreserved: true, summarySupported: true, resultEnvelope: "extract" },
    schemaSource: "official-docs",
    schemaLastVerified: VERIFIED,
    status: "wired",
    adapterMethod: "extract",
    costNotes: "Paid Bright Data product; explicit/configured use initially, not default routing.",
  },

  // These tools are implemented through the generic provider-tool substrate but
  // deliberately do not back normalized categories. `direct` records that
  // difference without pretending they are merely upstream ideas.
  "brightdata.datasetsList": {
    provider: "brightdata",
    tool: "datasetsList",
    nativeName: "GET /datasets/list",
    categories: [],
    description:
      "List Bright Data dataset/scraper IDs available to the authenticated account so agents do not hard-code site-specific scraper IDs.",
    docsUrl: "https://docs.brightdata.com/api-reference/marketplace-dataset-api/get-dataset-list",
    requiredParams: [],
    optionalParams: [],
    commonViews: [],
    features: { structuredJson: true, datasetDiscovery: true, keyless: false },
    execution: { mode: "sync", supportsWait: true },
    output: { rawPreserved: true, summarySupported: true, resultEnvelope: "raw" },
    schemaSource: "official-docs",
    schemaLastVerified: VERIFIED,
    status: "direct",
  },
  "brightdata.datasetMetadata": {
    provider: "brightdata",
    tool: "datasetMetadata",
    nativeName: "GET /datasets/{dataset_id}/metadata",
    categories: [],
    description:
      "Inspect a Bright Data scraper/dataset schema before invoking structured collection.",
    docsUrl: "https://docs.brightdata.com/api-reference/marketplace-dataset-api/get-dataset-metadata",
    requiredParams: ["dataset_id"],
    optionalParams: [],
    commonViews: [],
    features: { structuredJson: true, schemaDiscovery: true, keyless: false },
    execution: { mode: "sync", supportsWait: true },
    output: { rawPreserved: true, summarySupported: true, resultEnvelope: "raw" },
    schemaSource: "official-docs",
    schemaLastVerified: VERIFIED,
    status: "direct",
  },
  "brightdata.scrape": {
    provider: "brightdata",
    tool: "scrape",
    nativeName: "POST /datasets/v3/scrape",
    categories: [],
    description:
      "Synchronous invocation of a Bright Data site-specific Web Scraper API. Returns native structured records (products, reviews, companies, repositories, listings, and other dataset schemas).",
    docsUrl: "https://docs.brightdata.com/datasets/scrapers/scrapers-library/overview",
    requiredParams: ["dataset_id", "input"],
    optionalParams: ["inputs", "format", "type", "discover_by", "limit_per_input"],
    commonViews: [],
    features: { structuredJson: true, siteSpecificSchema: true, realTimeCollection: true, keyless: false },
    execution: { mode: "sync", supportsWait: true },
    output: { rawPreserved: true, summarySupported: true, resultEnvelope: "raw" },
    schemaSource: "official-docs",
    schemaLastVerified: VERIFIED,
    status: "direct",
    costNotes: "Site/dataset-specific paid collection; never invoke as routine validation or generic extract.",
  },
  "brightdata.trigger": {
    provider: "brightdata",
    tool: "trigger",
    nativeName: "POST /datasets/v3/trigger",
    categories: [],
    description:
      "Start an asynchronous Bright Data structured scraper/discovery job and return its snapshot identifier.",
    docsUrl: "https://docs.brightdata.com/datasets/scrapers/trigger-a-collection",
    requiredParams: ["dataset_id", "input"],
    optionalParams: ["inputs", "include_errors", "custom_output_fields", "type", "discover_by"],
    commonViews: [],
    features: { structuredJson: true, asyncJob: true, siteSpecificSchema: true, keyless: false },
    execution: { mode: "async-job", supportsPolling: true, jobIdField: "snapshot_id" },
    output: { rawPreserved: true, summarySupported: true, resultEnvelope: "job" },
    schemaSource: "official-docs",
    schemaLastVerified: VERIFIED,
    status: "direct",
  },
  "brightdata.snapshot": {
    provider: "brightdata",
    tool: "snapshot",
    nativeName: "GET /datasets/snapshots/{snapshot_id}/download",
    categories: [],
    description: "Download structured results for a completed Bright Data snapshot/job.",
    docsUrl: "https://docs.brightdata.com/api-reference/marketplace-dataset-api/download-snapshot",
    requiredParams: ["snapshot_id"],
    optionalParams: ["format"],
    commonViews: [],
    features: { structuredJson: true, asyncJobResult: true, keyless: false },
    execution: { mode: "sync", supportsWait: true },
    output: { rawPreserved: true, summarySupported: true, resultEnvelope: "raw" },
    schemaSource: "official-docs",
    schemaLastVerified: VERIFIED,
    status: "direct",
  },
  "brightdata.crawl": {
    provider: "brightdata",
    tool: "crawl",
    nativeName: "POST /datasets/v3/trigger (Crawl API dataset)",
    categories: [],
    description:
      "Bright Data Crawl API job trigger. Direct provider-native surface; not a normalized ColdSearch crawl backer until polling/output/cost semantics are characterized.",
    docsUrl: "https://docs.brightdata.com/scraping-automation/crawl-api/overview",
    requiredParams: ["dataset_id", "input"],
    optionalParams: ["inputs", "include_errors", "custom_output_fields"],
    commonViews: [],
    features: { asyncJob: true, crawlJob: true, structuredJson: true, keyless: false },
    execution: { mode: "async-job", supportsPolling: true, jobIdField: "snapshot_id" },
    output: { rawPreserved: true, summarySupported: true, resultEnvelope: "job" },
    schemaSource: "official-docs",
    schemaLastVerified: VERIFIED,
    status: "direct",
  },
  "brightdata.discover": {
    provider: "brightdata",
    tool: "discover",
    nativeName: "POST /discover",
    categories: [],
    description:
      "Bright Data Discover API direct tool. Kept provider-native rather than silently substituted for ordinary web search.",
    docsUrl: "https://docs.brightdata.com/api-reference/discover/overview",
    requiredParams: ["query"],
    optionalParams: [],
    commonViews: [],
    features: { discovery: true, structuredJson: true, keyless: false },
    execution: { mode: "async-job", supportsPolling: true, jobIdField: "task_id" },
    output: { rawPreserved: true, summarySupported: true, resultEnvelope: "job" },
    schemaSource: "official-docs",
    schemaLastVerified: VERIFIED,
    status: "direct",
  },
};

let installed = false;

/**
 * Extend the existing mutable provider-tool profile registry without forcing
 * Bright Data's provider-native structured tools into normalized categories.
 */
export function installBrightDataToolProfiles(): void {
  if (installed) return;
  Object.assign(providerToolProfiles, brightDataToolProfiles);
  installed = true;
}

export { brightDataToolProfiles };
