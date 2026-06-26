# DEVELOPER.md — Adding a Provider Or Provider Tool

How to add a new provider or provider tool to ColdSearch. Read
`docs/architecture.md` for the big picture and `docs/ADRs/001-fanout-architecture.md`
for why the runtime is shaped this way before starting.

## Mental model

- A **provider** is an external API (Tavily, Brave, …). An **adapter** is the
  thin class that talks to that API. For common capability views, it maps
  provider responses to shared shapes (`search`/`extract`/`crawl`) while keeping
  provider identity traceable. For raw provider tools, it must preserve native
  request shape and raw provider output.
- The **registry** (`src/providers.ts`) is the single source of truth for which
  providers exist, what common views and provider tools they support, and where
  their docs live. Config, fanout, dry-run, and the drift tests all read from it.
- Config is data: adding or wiring a provider for an existing user **never
  requires a code change or rebuild** once the adapter ships.

## The adapter contract

Implement `SearchAdapter` from `src/types.ts`:

```ts
export interface SearchAdapter {
  name: string;                       // must equal the registry key / config key
  capabilities: CapabilityName[];     // subset of "search" | "extract" | "crawl"
  search(query: string, apiKey: string, options?: AdapterCallOptions): Promise<NormalizedResult[]>;
  extract?(url: string, apiKey: string, options?: AdapterCallOptions): Promise<ExtractResult>;
  crawl?(url: string, apiKey: string, options?: CrawlCallOptions): Promise<CrawlResult[]>;
}
```

- `search` is **required** by the interface. `extract` and `crawl` are optional —
  only implement (and declare) the ones the provider actually supports.
- Map common-view responses to the shared shapes (`NormalizedResult`,
  `ExtractResult`, `CrawlResult` in `src/types.ts`). Always set `source` to your
  `name` for traceability. Scores in common search views should be mapped to
  `0–1` when the provider exposes comparable scoring. Raw provider-tool calls
  must preserve native provider detail instead of flattening it into these
  shapes.
- Use the shared `fetchJson` helper from `src/http.js` (handles timeouts,
  the User-Agent, and error labeling) instead of raw `fetch`.
- Throw on failure. The engine isolates per-provider errors during fanout, so a
  thrown error fails just your provider, not the whole request.

## The raw provider-tool contract

PR 1 adds the raw provider-tool surface. When adding or changing a provider tool:

- Add provider-tool metadata to the registry: provider, tool name, description,
  input schema, native shape, cache/replay policy, and evidence policy.
- Preserve native request shape. Nested provider options such as
  `scrapeOptions`, vertical filters, freshness/depth knobs, polling options, and
  schema prompts should stay explicit.
- Return `provider`, `tool`, `status`, optional `summary`, `raw`, and `meta`.
  `summary` is convenience only; it must not replace raw provider detail.
- Model async/job tools explicitly with job ID, provider status, polling metadata,
  and final results when waiting is supported.
- Log provider-tool calls with safe key references, timing, success/error, and
  run ID when present. Never log raw keys or bearer tokens.
- Prove pass-through with provider-native vs ColdSearch evidence using the same
  input payload before marking the tool done.

## Steps to add a provider

### 1. Write the adapter — `src/adapters/<name>.ts`

Model it on `src/adapters/tavily.ts` (full search/extract/crawl) or
`src/adapters/brave.ts` (search-only). Keep provider-specific response types
local to the file and map them to the common-view schema:

```ts
import { fetchJson } from "../http.js";
import type { SearchAdapter, NormalizedResult, AdapterCallOptions } from "../types.js";

export class AcmeAdapter implements SearchAdapter {
  name = "acme";
  capabilities: SearchAdapter["capabilities"] = ["search"];
  private readonly baseUrl = "https://api.acme.dev";

  async search(query: string, apiKey: string, _options?: AdapterCallOptions): Promise<NormalizedResult[]> {
    const response = await fetchJson<AcmeResponse>(
      `${this.baseUrl}/search`,
      { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ query }) },
      { label: "Acme search" }
    );
    return (response.results ?? []).map((r, i) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.snippet ?? "",
      score: r.score ?? Math.max(0.1, 1 - i * 0.1),
      source: this.name,
    }));
  }
}
```

### 2. Register it — `src/providers.ts`

Add an entry to `providerRegistry`. `capabilities` here must match what the
adapter declares (a drift test enforces this):

```ts
acme: {
  displayName: "Acme",
  capabilities: ["search"],
  createAdapter: () => new AcmeAdapter(),
},
```

For **self-hosted** providers that need runtime options (e.g. a base URL), set
`selfHosted: true` and list `optionKeys` (see the `searxng` entry). Those
options arrive in your adapter via `options.providerOptions`.

### 3. Export it — `src/adapters/index.ts`

Add the import and include the class in the re-export list so `createAdapter()`
and `getAvailableAdapters()` see it.

### 4. Key pool & authentication

Keys are resolved from a **key pool**, never hard-coded. In config:

```toml
[providers.acme.keyPool]
keys = ["env:ACME_API_KEY"]      # also supports "doppler:SECRET_NAME" refs
strategy = "round-robin"          # or "random"
```

The engine resolves a key from the pool and passes the literal string to your
adapter's `apiKey` argument — the adapter never touches config or env directly.
**Keyless** providers (like `jina`) accept any string and ignore it; declare an
empty/placeholder key pool and don't require a secret. See
`docs/KEY_MANAGEMENT.md` and `config.example.toml` for resolution details.

### 5. Usage logging

You get this for free. The `FanoutEngine` wraps each adapter call and writes a
`UsageLogEntry` (`src/logging/usage.ts`) — `timestamp`, `provider`,
`capability`, masked `key`, `success`, `response_time_ms`, optional `error`.
Key references are masked via `safeKeyRef()`, so **never log raw keys** from
inside an adapter. Just return common-view results or throw.

### 6. Document it — `docs/PROVIDERS.md`

Add a row to the `## Dual Matrix` table in `docs/PROVIDERS.md`. The ColdSearch
cells must match the registry `capabilities` (enforced by
`test/capability-matrix-drift.test.mjs`). Also add a short `### <Name>`
vendor-tool section under "Vendor tool surface". No separate per-provider page,
no separate `CAPABILITY_MATRIX.md`, and no `docs/plans/` doc are required anymore.

### 7. Tests

See `docs/contributing/testing.md`. In short:

- Extend the shared common-view search contract test if your adapter implements
  `search` — this asserts the common output shape across providers.
- Add a **provider-specific** test only for non-obvious behavior (multi-step
  crawl, URL building, pagination/polling). Avoid tests that merely replay your
  mock.

## Verifying without burning API quota

```bash
npm run build
coldsearch search --dry-run "test query"            # shows providers + masked key refs, no network
coldsearch --providers acme --single-provider "x"   # exercise just your adapter
npm test            # build + full suite
npm run test:docs   # Dual Matrix ↔ registry ↔ adapter drift only
```

## Definition of done

- [ ] `src/adapters/<name>.ts` implements `SearchAdapter` and maps common views to the common-view schema
- [ ] Registered in `src/providers.ts` and exported from `src/adapters/index.ts`
- [ ] Row added to `docs/PROVIDERS.md` Dual Matrix + vendor-tool section
- [ ] Raw provider tools preserve provider payloads and have provider-native comparison evidence when in scope
- [ ] `npm test` and `npm run test:docs` green
