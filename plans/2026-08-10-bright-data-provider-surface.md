# Bright Data Provider Surface Implementation Plan

> **For agentic workers:** implement this plan against the current ColdSearch provider/tool substrate. Do not collapse Bright Data's different products into one fake generic operation merely because they share an API key.

**Goal:** Add Bright Data as a first-class ColdSearch provider for ordinary web search and blocked-page retrieval, while exposing Bright Data's structured Web Scraper APIs as a discoverable provider-native data collection surface for products, reviews, companies, repositories, maps/listings, and the other scraper datasets available to the account.

**Product intent:** ColdSearch remains easy for a calling agent. Ordinary web lookup stays `coldsearch search`. Bright Data's site-specific structured scrapers are provider-native tools used when the caller wants structured records rather than generic web pages. Do not require a saved pipeline or new workflow engine for normal use.

**Official Bright Data surfaces reviewed 2026-08-10:**

- SERP API: `POST https://api.brightdata.com/request` with a SERP zone; structured results across Google/Bing/etc.
- Web Unlocker API: `POST https://api.brightdata.com/request` with an Unlocker zone; retrieves blocked/dynamic pages and can return raw/JSON/Markdown.
- Web Scraper APIs: 660+ pre-built scrapers using dataset IDs, with synchronous `/datasets/v3/scrape` and asynchronous `/datasets/v3/trigger` execution.
- Dataset discovery: `GET /datasets/list` enumerates dataset IDs available to the account; `GET /datasets/{dataset_id}/metadata` exposes fields/schema.
- Snapshot retrieval: asynchronous scraper/crawl jobs return snapshot IDs whose results can be downloaded later.
- Crawl API and Discover API exist, but should not be forced into normalized ColdSearch capabilities until their execution/semantic fit is proven.

Official docs:

- https://docs.brightdata.com/scraping-automation/serp-api/introduction
- https://docs.brightdata.com/scraping-automation/web-unlocker/introduction
- https://docs.brightdata.com/datasets/scrapers/overview
- https://docs.brightdata.com/datasets/scrapers/scrapers-library/overview
- https://docs.brightdata.com/api-reference/marketplace-dataset-api/get-dataset-list
- https://docs.brightdata.com/api-reference/marketplace-dataset-api/get-dataset-metadata
- https://docs.brightdata.com/scraping-automation/crawl-api/overview
- https://docs.brightdata.com/api-reference/discover/overview

---

## 1. Surface model

Treat Bright Data as several distinct tools behind one provider identity.

### A. `brightdata.serp` — ordinary web/search-engine search

**ColdSearch role:** backs normalized `search` and is also reachable through `tool call`.

- Normalized `coldsearch search` should turn a query into a configured search-engine URL and send it through the Bright Data SERP API.
- Preserve the native SERP payload on direct tool calls.
- Do not expose search-engine selection as a mandatory ColdSearch common option. Use provider options/defaults for normal search and native params for deliberate direct access.
- Initial normalized output should map organic result title/link/description or snippet into `NormalizedResult` without pretending paid/local/shopping SERP blocks are ordinary organic results.

### B. `brightdata.unlocker` — known-URL page retrieval

**ColdSearch role:** direct provider-native tool and a valid normalized `extract` backer once the adapter contract is implemented.

- Input is a public URL.
- Prefer Markdown/text output for normalized `extract` when configured; preserve provider-native raw/JSON on direct tool calls.
- This is not the same thing as a structured Web Scraper API. Unlocker retrieves a page; the scraper library returns site-specific structured records.
- Do not route every agent page read through Bright Data automatically. It is another configured `extract` provider, subject to normal routing.

### C. Bright Data Web Scraper APIs — structured records

**ColdSearch role:** provider-native structured collection surface. Do **not** flatten this into generic `extract`.

The caller/agent must be able to discover the correct Bright Data dataset/scraper and invoke it without hard-coded dataset IDs in ColdSearch source.

Implement these curated tools:

- `brightdata.datasetsList`
  - `GET /datasets/list`
  - returns dataset IDs/names available to the account
  - purpose: scraper discovery
- `brightdata.datasetMetadata`
  - `GET /datasets/{dataset_id}/metadata`
  - returns available fields/types/descriptions
  - purpose: understand the structured result before use
- `brightdata.scrape`
  - synchronous `POST /datasets/v3/scrape?dataset_id=...&format=json`
  - takes `dataset_id` plus one or more supported input records
  - purpose: real-time structured collection (e.g. Amazon product URL -> product JSON)
- `brightdata.trigger`
  - asynchronous `POST /datasets/v3/trigger?dataset_id=...`
  - purpose: batch/discovery/longer structured jobs
- `brightdata.snapshot`
  - retrieve/download results for a Bright Data snapshot ID
  - purpose: complete async scraper jobs without hiding their lifecycle

The generic sequence for an agent should therefore be simple and explicit:

```text
Need structured product/company/repository/etc. data
  -> tool call brightdata.datasetsList
  -> select relevant dataset_id
  -> tool call brightdata.datasetMetadata (when schema matters)
  -> tool call brightdata.scrape for quick/small inputs
     OR brightdata.trigger for async/discovery/batch
  -> tool call brightdata.snapshot for async results
```

This is **not** a ColdSearch pipeline feature. The calling agent owns the few-step orchestration.

### D. `brightdata.crawl` and `brightdata.discover`

Catalogue these as provider-native tools/candidates, but do not make them normalized backers in the first implementation solely because similarly named ColdSearch categories exist.

- Bright Data Crawl is snapshot/job based and tied to dataset/output configuration. Prove how it maps to ColdSearch `crawl` before routing generic crawl traffic to it.
- Bright Data Discover is an AI-ranked discovery/search product. Expose it deliberately through direct tool access if useful; do not silently substitute it for ordinary `search`.

### E. Browser API and Marketplace bulk dataset purchasing

Do not put these in the initial implementation.

- Browser API is interactive/stateful browser automation, not ordinary search/extract.
- Marketplace bulk dataset purchasing/subscription workflows are separate from on-demand scraper invocation and may have commercial/state-changing semantics.
- Keep them documented as Bright Data capabilities worth revisiting if a concrete ColdSearch workflow requires them.

---

## 2. Configuration

Add Bright Data as one provider with one API-key pool and product-specific options.

Suggested shape:

```toml
[providers.brightdata]
[providers.brightdata.keyPool]
keys = ["doppler:BRIGHTDATA_API_KEY"]

[providers.brightdata.options]
serpZone = "..."
unlockerZone = "..."
searchEngine = "google"
searchCountry = "us"
```

Rules:

- API key is resolved through the existing key-pool/secret mechanism.
- Zone names are configuration, not secrets.
- `serpZone` is required only to use normalized SERP search / direct SERP requests.
- `unlockerZone` is required only to use Unlocker / normalized extract.
- Web Scraper API dataset tools use `dataset_id` and do not require a SERP/Unlocker zone.
- Never commit the user's API key or account-specific paid dataset data.

---

## 3. Adapter and registry work

Implement a `BrightDataAdapter` for normalized capability routing:

- `search(query, key, options)` -> Bright Data SERP API -> `NormalizedResult[]`
- `extract(url, key, options)` -> Bright Data Web Unlocker -> `ExtractResult`
- do not implement normalized `crawl` in this first pass unless the live/provider-native proof establishes a direct, stable semantic mapping

Register provider metadata:

- provider key: `brightdata`
- display name: `Bright Data`
- normalized capabilities initially: `search`, `extract`
- provider option keys should include SERP/Unlocker zone and normal-search defaults

Add provider-tool profiles for at least:

- `brightdata.serp` — wired; category `search`
- `brightdata.unlocker` — wired; category `extract`
- `brightdata.datasetsList` — wired direct tool; structured discovery
- `brightdata.datasetMetadata` — wired direct tool; structured schema discovery
- `brightdata.scrape` — wired direct tool; structured synchronous collection
- `brightdata.trigger` — wired direct tool; async structured collection
- `brightdata.snapshot` — wired direct tool; async result retrieval
- `brightdata.crawl` — available/candidate until normalized/live semantics are proven
- `brightdata.discover` — available/candidate direct tool

Do not invent a new global ColdSearch `structured`/`products` capability in this PR. The provider-tool surface already exists for vendor-native semantics. Revisit a common category only if multiple providers later need the same structured-collection abstraction.

---

## 4. Tool-call substrate

Extend `executeToolCall()` with a Bright Data mapper instead of special-casing scraper IDs in the CLI.

Requirements:

- Bearer authentication.
- Exact Bright Data endpoint construction per curated tool.
- `datasetsList` is GET with no body.
- `datasetMetadata` is GET with dataset ID in path.
- `scrape` and `trigger` take `dataset_id` separately from the actual Bright Data input record array and place it in the query string.
- `snapshot` takes a snapshot ID and output format.
- `serp` and `unlocker` use `/request` but require the appropriate configured zone when the caller does not provide one explicitly.
- Preserve raw provider output for every direct tool call.
- Add compact summaries only as non-lossy convenience metadata; never replace raw structured records.
- Do not log API keys, bearer headers, signed URLs, or scraped data bodies into usage logs.

---

## 5. Agent usability

The intended external-agent experience is:

```bash
coldsearch search "current information"
```

for ordinary web research.

When structured site-specific data is required, an agent can deliberately use:

```bash
coldsearch tool call brightdata.datasetsList --json-input '{}'
coldsearch tool call brightdata.datasetMetadata --json-input '{"dataset_id":"gd_..."}'
coldsearch tool call brightdata.scrape --json-input '{"dataset_id":"gd_...","inputs":[{"url":"https://..."}]}'
```

Do not introduce a routine/pipeline requirement. Discovery + scrape is a small provider-tool sequence that an agent can orchestrate itself.

---

## 6. Tests

### Offline tests

Add focused tests that prove:

- Bright Data is a registered known provider.
- normalized `search` maps Bright Data organic SERP results correctly.
- normalized `extract` maps Unlocker Markdown/text correctly.
- tool profiles describe the required Bright Data tools and preserve raw results.
- `datasetsList` builds the correct GET request.
- `datasetMetadata` inserts the dataset ID into the endpoint path.
- `scrape` moves `dataset_id` into the query string and sends only input records as the request body.
- `trigger` preserves the async snapshot/job response.
- `snapshot` retrieves the requested snapshot without confusing snapshot IDs and dataset IDs.
- missing API key is a visible key-resolution error.
- missing `serpZone`/`unlockerZone` affects only tools needing that zone.
- no secret value is persisted/logged.
- no test makes a paid Bright Data call.

### Live scoped proof

Do **not** add Bright Data to routine PR CI.

When account config is available, run a deliberate scoped proof for:

1. SERP: one low-cost query through Bright Data native API and one equivalent ColdSearch Bright Data search.
2. Unlocker: one safe public URL through native API and ColdSearch extract.
3. Dataset discovery: `datasetsList` and one `datasetMetadata` request.
4. Structured scrape: choose one account-available, low-cost scraper and make one small synchronous request; compare native vs `tool call` raw output.

Do not run broad scraper batches merely to prove the adapter.

---

## 7. Success criteria

- Ordinary `coldsearch search` can use Bright Data SERP like another configured search provider.
- Ordinary `coldsearch extract` can use Bright Data Unlocker like another configured known-URL retrieval provider.
- A calling agent can discover available Bright Data structured scrapers at runtime instead of relying on dataset IDs hard-coded in ColdSearch.
- A calling agent can inspect scraper metadata/schema and request structured records for products or other supported domains.
- Sync and async scraper lifecycles remain explicit and inspectable.
- Bright Data raw responses remain available on direct tool calls.
- No new workflow/pipeline engine is introduced.
- No paid Bright Data comparison/benchmark is added to routine validation.
- Crawl/Discover/Browser/Marketplace expansion is not silently treated as completed merely because Bright Data offers those products.

## PR Review Pause

After implementation:

- [ ] Run the normal offline test suite and docs/registry validation.
- [ ] Run only the scoped Bright Data live checks intentionally authorized/configured for this integration.
- [ ] Open the implementation PR and read all required/advisory review surfaces.
- [ ] Address valid findings and rerun only the validation affected by follow-up changes.
- [ ] Do not merge while #50 is still an unresolved stacked dependency; retarget/rebase to `main` after #50 lands.
