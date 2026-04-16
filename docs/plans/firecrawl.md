# Firecrawl Adoption Plan

## Objective

Adopt Firecrawl as a full-coverage provider for `search`, `extract`, and `crawl`, leveraging its JS-rendering and job-based crawling features.

## Product Constraints

- Avoid leaking Firecrawl-specific tool naming into the CLI.
- Ensure crawl job polling fails visibly and times out deterministically.

## Scope

### In scope

- `src/adapters/firecrawl.ts`
- provider registry entry
- `docs/providers/firecrawl.md`
- `docs/CAPABILITY_MATRIX.md`

### Out of scope

- Firecrawl agent/batch/structured extract features as first-class ColdSearch capabilities.

## Runtime Contract

- Provider name: `firecrawl`
- Capabilities: `search`, `extract`, `crawl`
- Required configuration: `providers.firecrawl.keyPool.keys` containing `env:FIRECRAWL_API_KEY` (or equivalent)
- Notes: `crawl` is async job-based and requires polling.

## Verification

1. Configure `FIRECRAWL_API_KEY`.
2. Run `coldsearch search "test" --providers firecrawl`.
3. Run `coldsearch extract "https://example.com" --providers firecrawl`.
4. Run `coldsearch crawl "https://example.com" --providers firecrawl --limit 3`.

## Follow-up Questions

- Should crawl polling/backoff be configurable via provider options?

