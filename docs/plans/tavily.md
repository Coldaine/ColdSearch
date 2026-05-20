# Tavily Adoption Plan

## Objective

Use Tavily as a broad-coverage hosted provider for `search`, `extract`, and `crawl`, suitable as a default pool when keys are configured.

## Product Constraints

- Maintain normalized output shapes across capabilities.
- Keep routing policy in config (provider pools) rather than hard-coded behavior.

## Scope

### In scope

- `src/adapters/tavily.ts`
- provider registry entry
- `docs/providers/tavily.md`
- `docs/CAPABILITY_MATRIX.md`

### Out of scope

- Exposing Tavily-specific tools (`map`, `answer`, `research`) as new ColdSearch capabilities.

## Runtime Contract

- Provider name: `tavily`
- Capabilities: `search`, `extract`, `crawl`
- Required configuration: `providers.tavily.keyPool.keys` containing `env:TAVILY_API_KEY` (or equivalent)
- Errors:
  - missing key → auth failure surfaced clearly
  - invalid URL → validation error

## Verification

1. Configure `TAVILY_API_KEY`.
2. Run `coldsearch search "test" --providers tavily`.
3. Run `coldsearch extract "https://example.com" --providers tavily`.
4. Run `coldsearch crawl "https://example.com" --providers tavily --limit 3`.

## Follow-up Questions

- Should we expose any Tavily sub-tools (map/answer/research) behind experimental flags?

