# Exa Adoption Plan

## Objective

Adopt Exa as a semantic search provider for `search`, `extract`, and a constrained `crawl` implementation via discovery + livecrawl contents.

## Product Constraints

- Preserve normalized shapes and avoid leaking Exa-specific primitives.
- Prefer deterministic, inspectable behavior over “magic” routing.

## Scope

### In scope

- `src/adapters/exa.ts`
- provider registry entry
- `docs/providers/exa.md`
- `docs/CAPABILITY_MATRIX.md`

### Out of scope

- Exposing Exa sub-tools (`findSimilar`, `answer`, `research`, `chat`) as new ColdSearch capabilities.

## Runtime Contract

- Provider name: `exa`
- Capabilities: `search`, `extract`, `crawl`
- Required configuration: `providers.exa.keyPool.keys` containing `env:EXA_API_KEY` (or equivalent)
- Notes: `crawl` is implemented as “site discovery + contents”, not as a full sitemap crawler.

## Verification

1. Configure `EXA_API_KEY`.
2. Run `coldsearch search "test" --providers exa`.
3. Run `coldsearch extract "https://example.com" --providers exa`.
4. Run `coldsearch crawl "https://example.com" --providers exa --limit 3`.

## Follow-up Questions

- Should `crawl` accept include/exclude path filters via provider options?

