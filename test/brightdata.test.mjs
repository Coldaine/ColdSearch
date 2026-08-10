import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { BrightDataAdapter } from "../dist/adapters/brightdata.js";
import { providerRegistry } from "../dist/providers.js";
import { getToolProfile } from "../dist/registry/tool-profiles.js";
import {
  buildBrightDataToolRequest,
  buildBrightDataSummary,
} from "../dist/tools/brightdata.js";
import { executeToolCall } from "../dist/tools/substrate.js";

function config(overrides = {}) {
  return {
    capabilities: {
      search: { providers: ["brightdata"], strategy: "random" },
      extract: { providers: ["brightdata"], strategy: "random" },
      crawl: { providers: [], strategy: "random" },
    },
    providers: {
      brightdata: {
        keyPool: { keys: ["env:BRIGHTDATA_TEST_KEY"], strategy: "round-robin" },
        options: {
          serpZone: "serp_test",
          unlockerZone: "unlocker_test",
          searchEngine: "google",
          searchCountry: "us",
          maxStructuredInputsPerCall: 2,
          ...overrides,
        },
      },
    },
    logging: {},
  };
}

async function withMockFetch(handler, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("Bright Data is registered for search and extract but not crawl", () => {
  assert.deepEqual(providerRegistry.brightdata.capabilities, ["search", "extract"]);
  assert.equal(typeof providerRegistry.brightdata.createAdapter().search, "function");
  assert.equal(typeof providerRegistry.brightdata.createAdapter().extract, "function");
});

test("Bright Data normalized backers are wired while structured scrapers stay provider-native", () => {
  assert.equal(getToolProfile("brightdata.serp")?.status, "wired");
  assert.equal(getToolProfile("brightdata.serp")?.adapterMethod, "search");
  assert.equal(getToolProfile("brightdata.unlocker")?.status, "wired");
  assert.equal(getToolProfile("brightdata.unlocker")?.adapterMethod, "extract");

  const scrape = getToolProfile("brightdata.scrape");
  assert.ok(scrape, "structured Bright Data scraper should be catalogued");
  assert.equal(scrape.status, "available");
  assert.deepEqual(scrape.categories, []);
});

test("SERP adapter sends configured zone and normalizes organic results", async () => {
  const adapter = new BrightDataAdapter();
  let requestBody;

  await withMockFetch(async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      organic: [
        {
          title: "Example result",
          link: "https://example.com/result",
          description: "Example description",
          global_rank: 1,
        },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }, async () => {
    const results = await adapter.search("bright data test", "secret", {
      providerOptions: config().providers.brightdata.options,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Example result");
    assert.equal(results[0].url, "https://example.com/result");
    assert.equal(results[0].source, "brightdata");
  });

  assert.equal(requestBody.zone, "serp_test");
  assert.equal(requestBody.format, "json");
  assert.match(requestBody.url, /google\.com\/search\?q=bright%20data%20test/);
});

test("Unlocker adapter requests Markdown and returns extracted text", async () => {
  const adapter = new BrightDataAdapter();
  let requestBody;

  await withMockFetch(async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response("# Extracted page\nHello", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }, async () => {
    const result = await adapter.extract("https://example.com/page", "secret", {
      providerOptions: config().providers.brightdata.options,
    });
    assert.equal(result.content, "# Extracted page\nHello");
    assert.equal(result.url, "https://example.com/page");
    assert.equal(result.source, "brightdata");
  });

  assert.equal(requestBody.zone, "unlocker_test");
  assert.equal(requestBody.format, "raw");
  assert.equal(requestBody.data_format, "markdown");
});

test("dataset discovery and metadata build account-scoped GET requests", () => {
  const list = buildBrightDataToolRequest("datasetsList", {}, "secret", config());
  assert.equal(list.method, "GET");
  assert.equal(list.url, "https://api.brightdata.com/datasets/list");
  assert.equal(list.headers.Authorization, "Bearer secret");

  const metadata = buildBrightDataToolRequest(
    "datasetMetadata",
    { dataset_id: "gd_product" },
    "secret",
    config()
  );
  assert.equal(metadata.method, "GET");
  assert.match(metadata.url, /\/datasets\/gd_product\/metadata$/);
});

test("structured scrape separates dataset ID from input body", () => {
  const request = buildBrightDataToolRequest(
    "scrape",
    {
      dataset_id: "gd_product",
      input: { url: "https://example.com/product" },
      format: "json",
    },
    "secret",
    config()
  );

  const url = new URL(request.url);
  assert.equal(url.pathname, "/datasets/v3/scrape");
  assert.equal(url.searchParams.get("dataset_id"), "gd_product");
  assert.equal(url.searchParams.get("format"), "json");
  assert.deepEqual(JSON.parse(request.body), [{ url: "https://example.com/product" }]);
});

test("async trigger preserves snapshot lifecycle and native query controls", () => {
  const request = buildBrightDataToolRequest(
    "trigger",
    {
      dataset_id: "gd_search",
      input: { keyword: "gpu" },
      include_errors: true,
      custom_output_fields: "url,title,price",
    },
    "secret",
    config()
  );

  const url = new URL(request.url);
  assert.equal(url.pathname, "/datasets/v3/trigger");
  assert.equal(url.searchParams.get("dataset_id"), "gd_search");
  assert.equal(url.searchParams.get("include_errors"), "true");
  assert.equal(url.searchParams.get("custom_output_fields"), "url,title,price");
  assert.deepEqual(JSON.parse(request.body), [{ keyword: "gpu" }]);

  assert.equal(
    buildBrightDataSummary("trigger", { snapshot_id: "s_123" }).snapshot_id,
    "s_123"
  );
});

test("snapshot IDs are not confused with dataset IDs", () => {
  const request = buildBrightDataToolRequest(
    "snapshot",
    { snapshot_id: "s_123", format: "json" },
    "secret",
    config()
  );
  const url = new URL(request.url);
  assert.equal(url.pathname, "/datasets/snapshots/s_123/download");
  assert.equal(url.searchParams.get("format"), "json");
});

test("structured request input count is capped before any paid request", () => {
  assert.throws(
    () => buildBrightDataToolRequest(
      "scrape",
      {
        dataset_id: "gd_product",
        inputs: [{ url: "a" }, { url: "b" }, { url: "c" }],
      },
      "secret",
      config({ maxStructuredInputsPerCall: 2 })
    ),
    /configured maximum is 2/
  );
});

test("direct dataset discovery is catalogued and logs only safe key reference", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-brightdata-"));
  const usagePath = path.join(tmpDir, "usage.jsonl");
  process.env.BRIGHTDATA_TEST_KEY = "super-secret-bright-data-key";
  const cfg = config();
  cfg.logging = { usage: { path: usagePath } };

  try {
    await withMockFetch(async (_url, init) => {
      assert.equal(init.headers.Authorization, "Bearer super-secret-bright-data-key");
      return new Response(JSON.stringify([{ id: "gd_product", name: "Products" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }, async () => {
      const result = await executeToolCall("brightdata", "datasetsList", {}, cfg);
      assert.equal(result.ok, true);
      assert.equal(result.catalogued, true);
      assert.equal(result.summary.datasets_count, 1);
      assert.deepEqual(result.raw, [{ id: "gd_product", name: "Products" }]);
    });

    const log = fs.readFileSync(usagePath, "utf8");
    assert.match(log, /env:BRIGHTDATA_TEST_KEY/);
    assert.doesNotMatch(log, /super-secret-bright-data-key/);
  } finally {
    delete process.env.BRIGHTDATA_TEST_KEY;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
