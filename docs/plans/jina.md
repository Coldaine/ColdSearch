# Jina Adoption Plan

## Objective

Adopt Jina primarily as an `extract` provider using Reader-style URL → markdown conversion, as a lightweight alternative when hosted extract APIs are unavailable.

## Product Constraints

- Preserve normalized extract shape.
- Keep “no-key” behavior possible for basic extraction, while still supporting optional keys for higher limits.

## Scope

### In scope

- `src/adapters/jina.ts`
- provider registry entry
- `docs/providers/jina.md`
- `docs/CAPABILITY_MATRIX.md`

### Out of scope

- Adding Jina `search` or “deep search” surfaces as ColdSearch capabilities.
- Using Jina embeddings/rerank APIs from the CLI.

## Runtime Contract

- Provider name: `jina`
- Capabilities: `extract`
- Required configuration: none for basic usage (optional `JINA_API_KEY` supported)

## Verification

1. Run `coldsearch extract "https://example.com" --providers jina` with no key.
2. Configure `JINA_API_KEY` and confirm behavior remains consistent.

## Follow-up Questions

- Should we formalize a “no-key provider” convention in config docs?

