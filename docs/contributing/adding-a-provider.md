---
title: Adding a Provider or Provider Tool
date: 2026-06-26
status: living
doc_type: contributing
---

# Adding a Provider or Provider Tool

How to extend ColdSearch with a new provider, or wire one more tool from a
provider that already exists. Read `docs/NORTH_STAR.md` (intent) and
`docs/architecture.md` (shape) first, plus `docs/ADRs/005-provider-tool-profiles.md`
for *why* provider tools are modeled the way they are.

## Mental model: categories are views, not provider features

The single most important idea: **`search`, `extract`, and `crawl` are ColdSearch
*category views*, not apples-to-apples provider features.** Each is a portable
caller intent that several heterogeneous provider-native tools can back — with
different parameter surfaces, different semantics, and different cost models.

```
ColdSearch category
  → eligible provider tools
    → provider-native parameter schema
      → feature predicates + safe common-view mappings
```

Concrete consequences you must respect:

- A provider's **native tool name is not authoritative**. Firecrawl `scrape`
  backs ColdSearch `extract`; Firecrawl's native `extract` endpoint is a
  *structured-LLM* tool and is **not** the known-URL page operation. Brave Web
  Search is SERP-style search; Brave LLM Context is search **plus** extracted
  context chunks for LLM grounding — a different thing.
- A single provider tool may back **more than one** category (Exa `/contents`
  backs `extract` and a synthesized `crawl`).
- Backing a category may be **partial or lossy**. That is acceptable, but it
  must be **explicit** in the profile — never implied by a familiar name.

## Two registries, two jobs

| Registry | File | Holds | Read by |
|----------|------|-------|---------|
| Provider registry | `src/providers.ts` | which providers exist, their `displayName`, and the coarse `CapabilityName[]` they implement | config, fanout, dry-run, drift tests |
| Provider-tool profile registry | `src/registry/tool-profiles.ts` | one `ProviderToolProfile` per provider-native tool: native params, common-view mappings, feature predicates, execution/output semantics | `tool list`/`tool info`, requirement-aware routing, drift tests |

The provider registry answers *"what coarse buckets exist."* The profile
registry answers everything the bucket name cannot: which native operation backs
it, which parameters exist, which common options map safely, which are lossy or
unsupported, and whether the tool is sync, async-job, or streaming.

Config is data: adding or wiring a provider for an existing user **never requires
a code change or rebuild** once the adapter and profile ship.

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

- `search` is **required**. `extract` and `crawl` are optional — only implement
  (and declare) the ones the provider actually supports.
- Normalize every response to the shared shapes (`NormalizedResult`,
  `ExtractResult`, `CrawlResult`). Always set `source` to your `name`. Scores
  normalize to `0–1`. **Never lose raw provider detail that matters** — the
  common view is a convenience layer (`docs/NORTH_STAR.md` G6).
- Use the shared `fetchJson` helper from `src/http.js` (timeouts, User-Agent,
  error labeling) instead of raw `fetch`.
- Throw on failure. Fanout isolates per-provider errors, so a throw fails only
  your provider, not the whole request.

## Provider tool parameter profiles

Do not treat `search`, `extract`, and `crawl` as apples-to-apples provider
features. Every provider-native tool exposed (or documented as exposable)
through ColdSearch must have a `ProviderToolProfile` in
`src/registry/tool-profiles.ts`. The profile is the durable record of:

- the provider-native tool name and docs URL;
- required and optional native parameters;
- which ColdSearch category (or categories) the tool can back, and how faithfully
  (`semanticFit`: `direct` / `partial` / `derived` / `not-recommended`);
- which common options map safely to native parameters
  (`mapsCommonOptions`), which are `unsupportedCommonOptions`, which are
  `lossyMappings`, and which native options have no common equivalent;
- feature predicates (`features`) so routing does not rely only on broad
  category names;
- `execution` (sync / async-job / streaming, polling, job id field);
- `output` (raw always preserved, summary support, result envelope);
- `schemaSource` and `schemaLastVerified`;
- `status`: `wired`, `available` (upstream exists, profile documented, not wired
  yet), or `deferred` (niche/high-risk).

A provider tool may back a category only partially. Partial support is fine, but
it must be explicit. **Do not add a tool to a category merely because the
provider uses a familiar name.**

`coldsearch tool info <provider.tool>` renders the live profile, so the registry
— not stale prose — is the source of truth for native parameters.

## Steps to add a provider

### 1. Write the adapter — `src/adapters/<name>.ts`

Model it on `src/adapters/tavily.ts` (full search/extract/crawl) or
`src/adapters/brave.ts` (search-only). Keep provider-specific response types
local to the file and map them to the shared schema. Set `source` to `name`.

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

For **self-hosted** providers needing runtime options (e.g. a base URL), set
`selfHosted: true` and list `optionKeys` (see `searxng`). Those options arrive
via `options.providerOptions`.

### 3. Add a profile per tool — `src/registry/tool-profiles.ts`

For each provider-native tool you expose, add a `ProviderToolProfile` keyed
`"<provider>.<tool>"`. Use `wired` for tools an adapter method actually backs and
`available` for documented-but-unwired tools (recording them prevents the
registry from lying by omission). Every category in the provider registry must
be backed by at least one `wired` tool whose `adapterMethod` is set — a drift
test enforces this.

### 4. Export it — `src/adapters/index.ts`

Add the import and include the class in the re-export list so `createAdapter()`
and `getAvailableAdapters()` see it.

### 5. Key pool & authentication

Keys resolve from a **key pool**, never hard-coded. In config:

```toml
[providers.acme.keyPool]
keys = ["env:ACME_API_KEY"]      # also supports "doppler:SECRET_NAME" refs
strategy = "round-robin"          # or "random"
```

The engine resolves a key and passes the literal string to your adapter's
`apiKey` argument — the adapter never touches config or env directly. **Keyless**
providers (like `jina`) accept any string and ignore it. See
`docs/KEY_MANAGEMENT.md` and `docs/CONFIGURATION.md`.

### 6. Usage logging

Free. `FanoutEngine` wraps each adapter call and writes a `UsageLogEntry`
(`src/logging/usage.ts`) with masked key references via `safeKeyRef()`. **Never
log raw keys** from inside an adapter. Just return normalized results or throw.

### 7. Document it — `docs/PROVIDERS.md`

Add a row to the `## Dual Matrix` table (the ColdSearch cells must match the
registry `capabilities`, enforced by `test/capability-matrix-drift.test.mjs`) and
a short `### <Name>` vendor-tool section under "Vendor tool surface". Keep
parameter-level detail in the profile registry, not the prose.

### 8. Tests

See `docs/contributing/testing.md`. In short:

- Extend the shared `search-normalize` contract test if your adapter implements
  `search`.
- Add a **provider-specific** test only for non-obvious behavior (multi-step
  crawl, URL building, pagination/polling). Avoid tests that merely replay a mock.
- The profile drift test (`test/provider-tool-profiles.test.mjs`) automatically
  enforces structural completeness once your profile is added.

## Requirement-aware routing

Random/fanout routing must be requirement-aware, not "any provider that claims
the category". Use feature predicates rather than broad category membership:

```ts
// Bad: ignores whether the tool can actually honor the request.
eligible = providers.filter((p) => p.capabilities.includes("search"));

// Good: filter on feature predicates from the profile registry.
eligible = resolveEligibleTools("extract", { requireFeatures: ["browserActions"] });
```

`resolveCapabilityProviders(config, capability, { requireFeatures })` narrows the
configured providers to those whose wired tool for that category sets every
requested feature, and fails visibly when none qualify
(`docs/NORTH_STAR.md` "Fail Visible").

## Verifying without burning API quota

```bash
npm run build
coldsearch tool list --json                         # inspect the profile registry, no network
coldsearch tool info <provider>.<tool> --json       # one profile, no network
coldsearch search --dry-run "test query"            # providers + masked key refs, no network
coldsearch --providers acme --single-provider "x"   # exercise just your adapter
npm test            # build + full suite
npm run test:docs   # Dual Matrix ↔ registry ↔ adapter drift only
```

## Definition of done

- [ ] `src/adapters/<name>.ts` implements `SearchAdapter`, normalizes to the shared schema, preserves raw detail
- [ ] Registered in `src/providers.ts` and exported from `src/adapters/index.ts`
- [ ] A `ProviderToolProfile` exists for every provider-native tool exposed (`wired`) or documented (`available`)
- [ ] Required/optional native parameters enumerated in each profile
- [ ] Common-view mappings document safe, unsupported, and lossy mappings, with `semanticFit`
- [ ] Feature predicates added so routing does not rely only on broad capability names
- [ ] `tool info <provider.tool>` shows native parameters, schema source, docs URL, and common-view notes
- [ ] Row added to `docs/PROVIDERS.md` Dual Matrix + vendor-tool section
- [ ] `npm test` and `npm run test:docs` green
