# Testing

## Commands

```bash
npm test          # build + full suite (dot reporter — failures still verbose)
npm run test:docs # matrix + provider doc drift only
npm run typecheck
```

## What belongs in tests

**Keep** tests that would catch a real regression:

- Routing (`FanoutEngine`: random vs all, sequential extract/crawl)
- Security (agent SSRF, capability validation)
- Doc/registry/matrix drift (one test per invariant, not three)
- Provider behavior that is non-obvious (multi-step crawl, URL building, parsing)

**Avoid** tests that only replay the mock:

- Mock returns field X → assert field X (per-provider copy-paste)
- Registry string equals adapter string when both are hand-maintained duplicates
- “Display name appears in markdown” without table semantics

Prefer **contract tests** under `test/adapters/*contract*.test.mjs` for shared shapes; keep provider files for quirks only.

## Logging / CI output

- Default reporter is **`dot`** (quiet pass, detailed fail).
- Do not add `console.log` in tests; use assertions.
- Production usage logging is separate (`src/logging/usage.ts`, JSONL).

## Adding a provider

1. Adapter + registry + matrix + provider doc
2. Extend `search-normalize.contract.test.mjs` if it implements `search`
3. Add a **provider-specific** test file only for non-shared behavior (crawl polling, URL paths, etc.)
