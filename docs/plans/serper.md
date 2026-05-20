# Serper Adoption Plan

## Objective

Integrate Serper as a search-focused provider for the normalized `search` capability, giving access to Google-backed SERP results.

## Product Constraints

- Avoid provider-specific CLI exposure; keep a stable normalized surface.
- Keep routing and provider selection in config.

## Scope

### In scope

- `src/adapters/serper.ts`
- provider registry entry
- `docs/providers/serper.md`
- `docs/CAPABILITY_MATRIX.md`

### Out of scope

- Implementing `extract`/`crawl` via Serper.
- Supporting every Serper vertical as separate ColdSearch capabilities.

## Runtime Contract

- Provider name: `serper`
- Capabilities: `search`
- Required configuration: `providers.serper.keyPool.keys` containing `env:SERPER_API_KEY` (or equivalent)

## Verification

1. Configure `SERPER_API_KEY`.
2. Run `coldsearch search "test" --providers serper`.
3. Confirm normalized result schema and clear auth/rate-limit errors.

## Follow-up Questions

- Should Serper query options (gl/hl/tbs) be exposed via provider options?

