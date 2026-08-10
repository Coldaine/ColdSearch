# Bright Data Provider Surface Implementation Plan

> **For agentic workers:** implement and review this plan against the current ColdSearch provider/tool substrate. Do not collapse Bright Data's different products into one fake generic operation merely because they share an API key.

**Goal:** Add Bright Data as a first-class ColdSearch provider for ordinary web search and blocked-page retrieval, while exposing Bright Data's structured Web Scraper APIs as a discoverable provider-native data collection surface for products, reviews, companies, repositories, maps/listings, and other scraper datasets available to the account.

**Product intent:** ColdSearch remains easy for a calling agent. Ordinary web lookup stays `coldsearch search`. Bright Data's site-specific structured scrapers are direct provider-native tools used when the caller wants structured records rather than generic web pages. Do not require a saved pipeline or new workflow engine for normal use.

**Adoption boundary:** Bright Data is a paid provider and remains **explicit/configured-only** in this first implementation. Do not add it to default search/extract pools, routine PR CI, benchmark loops, or automatic broad fanout until real usage establishes cost/quality behavior.

## Official Bright Data surfaces reviewed 2026-08-10

- SERP API: `POST https://api.brightdata.com/request` with a SERP zone.
- Web Unlocker API: `POST https://api.brightdata.com/request` with an Unlocker zone.
- Web Scraper APIs: hundreds of pre-built scraper datasets using dataset IDs, with synchronous `/datasets/v3/scrape` and asynchronous `/datasets/v3/trigger` execution.
- Dataset discovery: `GET /datasets/list`; dataset schema/metadata: `GET /datasets/{dataset_id}/metadata`.
- Async lifecycle: trigger → `/datasets/v3/progress/{snapshot_id}` → `/datasets/v3/snapshot/{snapshot_id}`; cancellation is explicit.
- Snapshot metadata can expose provider-reported status, size and actual cost.
- Crawl API and Discover API exist, but should not be forced into normalized ColdSearch capabilities merely because their names resemble `crawl` or `search`.

Official docs are linked from the live provider-tool profiles; `tool info` is the parameter-level source of truth.

---

## 1. Surface model

Treat Bright Data as several distinct tools behind one provider identity.

### A. `brightdata.serp` — ordinary web/search-engine search

**ColdSearch role:** `wired`; backs normalized `search` and is also reachable through `tool call`.

- Normalized `coldsearch search --providers brightdata` turns a query into a configured search-engine URL and sends it through the Bright Data SERP API.
- Preserve the native SERP payload on direct tool calls.
- Search-engine/country/zone selection is provider configuration/native parameters, not mandatory common ColdSearch options.
- Normalize organic title/link/description or snippet into `NormalizedResult`; do not flatten shopping/local/other provider-native SERP blocks into fake organic results.

### B. `brightdata.unlocker` — known-URL page retrieval

**ColdSearch role:** `wired`; backs normalized `extract` and is also a direct tool.

- Input is a known public URL.
- Normalized extraction uses Markdown/text output.
- Direct calls preserve the provider-native response.
- Unlocker is page retrieval, not the structured Web Scraper library.
- Do not silently route every agent page read through Bright Data. It is another configured extract provider and remains outside default pools initially.

### C. Bright Data Web Scraper APIs — structured records

**ColdSearch role:** `direct` provider-native tools. Do **not** flatten them into generic `extract`.

An agent must be able to discover the right scraper/dataset at runtime instead of relying on dataset IDs hard-coded in ColdSearch source.

Implemented direct tools:

- `brightdata.datasetsList`
  - `GET /datasets/list`
  - discover dataset/scraper IDs available to the authenticated account.
- `brightdata.datasetMetadata`
  - `GET /datasets/{dataset_id}/metadata`
  - inspect fields/schema before using a structured collector.
- `brightdata.scrape`
  - synchronous `POST /datasets/v3/scrape?dataset_id=...`
  - small/real-time structured collection.
  - preserve provider-native scalar query controls such as discovery mode/filter controls rather than narrowing every scraper to `{url}`.
- `brightdata.trigger`
  - asynchronous `POST /datasets/v3/trigger?dataset_id=...`
  - longer/batch/discovery structured collection.
- `brightdata.progress`
  - `GET /datasets/v3/progress/{snapshot_id}`
  - explicit job state inspection.
- `brightdata.snapshotMetadata`
  - inspect snapshot status/size and provider-reported actual cost where available.
- `brightdata.cancel`
  - cancel a running scraper snapshot/job.
- `brightdata.snapshot`
  - download completed scraper results using the v3 snapshot delivery API.

The normal agent sequence is intentionally small:

```text
Need structured product/company/repository/etc. data
  -> brightdata.datasetsList (if dataset ID is not already known)
  -> brightdata.datasetMetadata (when schema matters)
  -> brightdata.scrape for small synchronous work
     OR brightdata.trigger for async/discovery/batch
        -> brightdata.progress
        -> brightdata.snapshotMetadata when status/cost matters
        -> brightdata.snapshot when ready
        -> brightdata.cancel if the run should be stopped
```

This is **not** a ColdSearch pipeline feature. The calling agent owns this few-step orchestration.

### D. `brightdata.crawl` and `brightdata.discover`

These are implemented as `direct` provider-native request mappings but deliberately do not back normalized categories in this first pass.

- Bright Data Crawl is snapshot/job based and dataset/output-specific. Do not route generic `coldsearch crawl` traffic to it until the common-view semantics are deliberately characterized.
- Bright Data Discover is a separate discovery product. Keep it distinct from ordinary normalized `search` until a concrete workflow justifies a common mapping.

### E. Browser API, proxy products and Marketplace purchase/subscription flows

Do not put these in the initial implementation.

- Browser API is interactive/stateful browser automation, not ordinary search/extract.
- Proxy products are lower-level transport infrastructure, not a ColdSearch category by themselves.
- Marketplace purchasing/subscription operations can have commercial/state-changing semantics.
- Revisit only when a concrete ColdSearch workflow needs them.

---

## 2. Configuration and paid-use safety

Bright Data uses the existing key-pool/secret mechanism and product-specific options.

```toml
[providers.brightdata]
[providers.brightdata.keyPool]
keys = ["doppler:BRIGHTDATA_API_KEY"]

[providers.brightdata.options]
serpZone = "..."
unlockerZone = "..."
searchEngine = "google"
searchCountry = "us"
maxStructuredInputsPerCall = 20
```

Rules:

- Never commit the API key or scraped account data.
- Zone names are configuration, not secrets.
- `serpZone` is required only for SERP use.
- `unlockerZone` is required only for Unlocker use.
- Structured scraper tools use `dataset_id` and do not require SERP/Unlocker zones.
- Bright Data remains absent from default provider pools.
- Structured calls have a hard configurable input-count ceiling before any request is made. Default to 20, matching the documented synchronous request ceiling and providing a conservative default for direct structured work.
- Larger async use requires an intentional config increase; do not silently turn one agent action into an unbounded paid batch.
- There is no trustworthy single universal pre-call dollar estimator across Bright Data products/datasets. Do not fabricate one. Surface actual cost when the provider returns it (notably snapshot metadata) and keep recurring/broad use blocked from default routing until cost behavior is characterized.

---

## 3. Adapter and registry contract

Implemented adapter behavior:

- `BrightDataAdapter.search()` → SERP API → `NormalizedResult[]`.
- `BrightDataAdapter.extract()` → Web Unlocker → `ExtractResult`.
- No normalized Bright Data crawl in this PR.

Provider registration:

- key: `brightdata`
- display name: `Bright Data`
- normalized capabilities: `search`, `extract`
- provider options: SERP zone, Unlocker zone, normal-search defaults, structured input ceiling.

Tool status semantics:

- `wired` = adapter-backed normalized category backer.
- `direct` = implemented/callable via `tool call`, deliberately not a normalized category backer.
- `available` = upstream documented but not implemented.
- `deferred` = intentionally not built.

Bright Data profiles:

- `brightdata.serp` — `wired`, category `search`.
- `brightdata.unlocker` — `wired`, category `extract`.
- `datasetsList`, `datasetMetadata`, `scrape`, `trigger`, `progress`, `snapshotMetadata`, `cancel`, `snapshot`, `crawl`, `discover` — `direct`, with no normalized category membership.

Do not invent a global `structured` or `products` capability in this PR. Revisit a shared category only if multiple providers later need the same portable structured-data abstraction.

---

## 4. Tool-call substrate requirements

Bright Data direct calls use the existing `executeToolCall()` envelope and key handling.

Requirements:

- Bearer authentication.
- Exact endpoint/method construction per curated tool.
- Dataset IDs and snapshot IDs are distinct and must never be conflated.
- `scrape`/`trigger` move `dataset_id` into the query string and send only input records in the body.
- Preserve scalar provider-native scraper query controls rather than throwing them away.
- Preserve raw provider output for every direct call.
- Compact summaries are convenience metadata only; never replace native structured records.
- Do not log API keys, bearer headers, signed URLs, or scraped record bodies.
- Summaries may expose provider-reported `cost_usd` when it actually exists. Snapshot metadata is the preferred cost-inspection surface for async scraper work.

---

## 5. Agent usability

Ordinary research remains:

```bash
coldsearch search "current information"
```

Bright Data is selected explicitly while it remains outside default pools:

```bash
coldsearch search --providers brightdata "current information"
coldsearch extract --providers brightdata "https://example.com"
```

Structured site-specific data is deliberate:

```bash
coldsearch tool call brightdata.datasetsList --json-input '{}'
coldsearch tool call brightdata.datasetMetadata --json-input '{"dataset_id":"gd_..."}'
coldsearch tool call brightdata.scrape --json-input '{"dataset_id":"gd_...","input":{"url":"https://..."}}'
```

Async:

```bash
coldsearch tool call brightdata.trigger --json-input '{"dataset_id":"gd_...","input":{"url":"https://..."}}'
coldsearch tool call brightdata.progress --json-input '{"snapshot_id":"s_..."}'
coldsearch tool call brightdata.snapshotMetadata --json-input '{"snapshot_id":"s_..."}'
coldsearch tool call brightdata.snapshot --json-input '{"snapshot_id":"s_...","format":"json"}'
```

No routine/pipeline engine is required for these sequences.

---

## 6. Validation

### Offline validation — required

The PR must prove without provider spend:

- Bright Data registration and normalized capabilities.
- SERP request shape and organic normalization.
- Unlocker request shape and Markdown extraction.
- `wired` vs `direct` profile semantics.
- dataset-list and metadata endpoint construction.
- sync scraper dataset/query/body separation.
- preservation of provider-native scalar query controls.
- async trigger/progress/metadata/cancel/download lifecycle.
- structured input cap occurs before network execution.
- direct results remain raw-preserved.
- safe key reference is logged while the literal key is absent.
- no test contacts Bright Data.

Run:

```bash
npm run typecheck
npm run test:docs
npm test
```

### Live scoped proof — deliberate only

Do **not** add Bright Data live calls to routine PR CI.

When the account API key/zones are intentionally configured, make a very small scoped proof:

1. SERP: one low-cost query native vs ColdSearch normalized/direct path.
2. Unlocker: one safe public URL native vs ColdSearch extract/direct path.
3. Dataset discovery: `datasetsList` and one `datasetMetadata` request.
4. Structured scrape: one small account-available scraper request, comparing native result with `tool call` raw output.
5. If async lifecycle itself changed, one minimal trigger/progress/metadata/result sequence; otherwise do not manufacture a batch merely for validation.

Record live status separately from offline implementation. Missing Bright Data configuration means **not live-verified**, not failed and not implicitly waived.

---

## 7. Success criteria

- Ordinary ColdSearch search can deliberately use Bright Data SERP without changing the agent-facing search abstraction.
- Ordinary extract can deliberately use Web Unlocker.
- An agent can discover account-available structured scrapers rather than hard-code dataset IDs.
- An agent can inspect scraper metadata/schema and retrieve structured products or other records.
- Sync and async scraper lifecycles are explicit, inspectable and cancellable.
- Provider-reported async cost can be inspected when available.
- Structured tools are marked `direct` and cannot accidentally enter normalized routing.
- Bright Data remains outside default pools initially.
- Raw provider responses remain available on direct calls.
- No new workflow/pipeline engine is introduced.
- No paid Bright Data comparison/benchmark is added to routine validation.
- Browser/proxy/Marketplace expansion is not silently treated as complete.

## PR Review Pause

After implementation:

- [ ] Run typecheck, normal offline tests, and docs/registry validation.
- [ ] Read all review surfaces and address valid findings.
- [ ] Rerun only validation affected by follow-up changes.
- [ ] Keep the PR draft until the implementation is internally green and the remaining live-verification status is described accurately.
- [ ] Do not run paid live Bright Data checks unless account configuration is intentionally supplied for that scoped proof.
