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
- Some provider-native tools should be **direct-callable without becoming a
  normalized category backer**. For example, a site-specific product scraper can
  return useful structured records while being semantically wrong as generic
  `extract`.
- A single provider tool may back **more than one** category (Exa `/contents`
  backs `extract` and a synthesized `crawl`).
- Backing a category may be **partial or lossy**. That is acceptable, but it
  must be **explicit** in the profile — never implied by a familiar name.

## Two registries, two jobs

| Registry | File | Holds | Read by |
|----------|------|-------|---------|
| Provider registry | `src/providers.ts` | which providers exist, their `displayName`, and the coarse `CapabilityName[]` they implement | config, fanout, dry-run, drift tests |
| Provider-tool profile registry | `src/registry/tool-profiles.ts` plus focused provider-specific registry modules when useful | one `ProviderToolProfile` per provider-native tool: native params, common-view mappings, feature predicates, execution/output semantics | `tool list`/`tool info`, requirement-aware routing, drift tests |

The provider registry answers *"what coarse buckets exist."* The profile
registry answers everything the bucket name cannot: which native operation backs
it, which parameters exist, which common options map safely, which are lossy or
unsupported, whether the tool is sync/async-job/streaming, and whether the tool
is normalized (`wired`) or provider-native-only (`direct`).

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
  common view is a convenience layer (`docs/NORTH_STAR.md` G4).
- Use the shared HTTP helpers from `src/http.js` (timeouts, User-Agent, error
  labeling) instead of raw `fetch`.
- Throw on failure. Fanout isolates per-provider errors, so a throw fails only
  your provider, not the whole request.

## Provider tool parameter profiles

Do not treat `search`, `extract`, and `crawl` as apples-to-apples provider
features. Every provider-native tool exposed (or documented as exposable)
through ColdSearch must have a `ProviderToolProfile` in the shared registry.
The profile is the durable record of:

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
- `status`:
  - `wired` — adapter-backed normalized category tool;
  - `direct` — implemented through `tool call` but intentionally not a normalized category backer;
  - `available` — upstream exists and is documented, but not implemented yet;
  - `deferred` — intentionally not built (niche/high-risk).

A provider tool may back a category only partially. Partial support is fine, but
it must be explicit. **Do not add a tool to a category merely because the
provider uses a familiar name.** Likewise, do not mark a direct site-specific
scraper `wired` just because it is executable; `wired` participates in
normalized routing.

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

For providers needing runtime options (e.g. a base URL, zone, or product
setting), list `optionKeys`. Those options arrive via `options.providerOptions`.
Use `selfHosted: true` where that distinction matters operationally.

### 3. Add a profile per tool

For each provider-native tool you expose, add a `ProviderToolProfile` keyed
`"<provider>.<tool>"`. Core profiles live in `src/registry/tool-profiles.ts`;
a provider with a large native tool family may keep them in a focused module as
long as it installs into the same runtime registry.

Use:

- `wired` for tools an adapter method actually backs;
- `direct` for implemented provider-native tools intentionally outside normalized routing;
- `available` for documented-but-unimplemented tools;
- `deferred` for intentionally excluded tools.

Every category in the provider registry must be backed by at least one `wired`
tool whose `adapterMethod` is set — a drift test enforces this. `direct` tools do
not satisfy that requirement and do not enter `resolveEligibleTools()` category
routing.

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
`apiKey` argument. **Keyless** tools declare that fact in their tool profile.
See `docs/KEY_MANAGEMENT.md` and `docs/CONFIGURATION.md`.

### 6. Usage logging

`FanoutEngine` and the provider-tool substrate write safe `UsageLogEntry`
records with masked key references. **Never log raw keys** from inside an
adapter or tool mapper. Paid providers may add safe product/zone/cost metadata
where the provider actually exposes it, but do not fabricate cost estimates.

### 7. Document it — `docs/PROVIDERS.md`

Add a row to the `## Dual Matrix` table (the ColdSearch cells must match the
registry `capabilities`, enforced by `test/capability-matrix-drift.test.mjs`) and
a short `### <Name>` vendor-tool section under "Vendor tool surface". Keep
parameter-level detail in the profile registry, not the prose.

### 8. Tests

See `docs/contributing/testing.md`. In short:

- Extend the shared normalization contract test if your adapter implements a
  normalized capability.
- Add **provider-specific** tests for non-obvious behavior (multi-step jobs, URL
  building, provider-native query/body separation, pagination/polling).
- Direct provider-native tools must prove request shape and raw preservation
  offline; do not spend provider credits merely to make routine tests realistic.
- The profile drift test automatically enforces structural completeness once
  profiles are installed.

## Requirement-aware routing

Random/fanout routing must be requirement-aware, not "any provider that claims
the category". Use feature predicates rather than broad category membership:

```ts
// Bad: ignores whether the tool can actually honor the request.
eligible = providers.filter((p) => p.capabilities.includes("search"));

// Good: filter on feature predicates from normalized `wired` backers.
eligible = resolveEligibleTools("extract", { requireFeatures: ["browserActions"] });
```

`resolveCapabilityProviders(config, capability, { requireFeatures })` narrows the
configured providers to those whose **wired** tool for that category sets every
requested feature, and fails visibly when none qualify. Provider-native
`direct` tools are invoked deliberately with `tool call`; they do not become
category routing candidates.

## Verifying without burning API quota

```bash
npm run build
coldsearch tool list --json                         # inspect the profile registry, no network
coldsearch tool info <provider>.<tool> --json       # one profile, no network
coldsearch search --dry-run "test query"            # providers + masked key refs, no network
npm test            # build + full suite
npm run test:docs   # Dual Matrix ↔ registry ↔ adapter drift only
```

Run a real provider request only when the integration change itself requires a
scoped live proof. Paid provider calls are not normal PR validation.

## Definition of done

- [ ] `src/adapters/<name>.ts` implements the normalized capabilities claimed in the provider registry
- [ ] Registered in `src/providers.ts` and exported from `src/adapters/index.ts`
- [ ] A `ProviderToolProfile` exists for every provider-native tool exposed (`wired` or `direct`) or documented (`available`/`deferred`)
- [ ] Required/optional native parameters enumerated in each profile
- [ ] Common-view mappings document safe, unsupported, and lossy mappings, with `semanticFit`
- [ ] Feature predicates added so routing does not rely only on broad capability names
- [ ] `tool info <provider.tool>` shows native parameters, schema source, docs URL, status, and common-view notes
- [ ] Row added to `docs/PROVIDERS.md` Dual Matrix + vendor-tool section
- [ ] Paid-provider safety boundaries are explicit before default-pool or recurring use
- [ ] `npm test` and `npm run test:docs` green
