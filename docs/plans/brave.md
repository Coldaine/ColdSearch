# Brave Adoption Plan

## Objective

Integrate Brave as a search-focused provider to provide independent-index search results under the normalized `search` capability.

## Product Constraints

- Keep capability routing and provider selection in config.
- Do not expose Brave-specific verticals as separate ColdSearch capabilities.

## Scope

### In scope

- `src/adapters/brave.ts`
- provider registry entry
- `docs/providers/brave.md`
- `docs/CAPABILITY_MATRIX.md`

### Out of scope

- Implementing `extract`/`crawl` via Brave (not provided as first-class vendor surfaces for those capabilities).

## Runtime Contract

- Provider name: `brave`
- Capabilities: `search`
- Required configuration: `providers.brave.keyPool.keys` containing `env:BRAVE_API_KEY` (or equivalent)

## Verification

1. Configure `BRAVE_API_KEY`.
2. Run `coldsearch search "test" --providers brave`.
3. Confirm normalized result schema and stable error messaging for auth failures.

## Follow-up Questions

- Should we support configurable market/safesearch/freshness via provider options?

