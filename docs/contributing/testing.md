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

## Three distinct evidence activities

Do not collapse these into “testing”:

| Activity | Purpose | When it runs | Merge gate? |
|---|---|---|---|
| Unit/contract tests | Detect behavioral regressions | Every PR through normal CI | Yes |
| Live provider conformance | Verify an affected real integration still works | Scheduled canary plus scoped manual runs for provider-facing changes | No |
| Search evaluation/exploration | Learn which prior search, result, or provider was useful | Human/agent exploration of accumulated executions | No |

**Provider-effectiveness evaluation is observational and exploratory.** Do not run paid provider comparisons or benchmark workloads as routine validation after code changes. Do not add them to `npm test`, merge gates, default agent completion checklists, or general PR validation. Use accumulated real executions for analysis. Run deliberate comparative evaluation only when the task specifically concerns provider selection, routing quality, search effectiveness, or a suspected provider regression.

**Live conformance is integration-scoped.** Do not run the full live-provider matrix after unrelated changes. Run the relevant provider/path manually when modifying provider adapters, HTTP/request behavior, authentication, normalization, tool dispatch, or provider-facing routing; otherwise rely on scheduled coverage. Native-vs-ColdSearch comparison is conformance evidence, not benchmarking. See the detailed initial [Gate 0 baseline](../../plans/2026-06-23-gate-0-provider-pass-through-proof.md) and the ongoing [Live Provider Conformance plan](../../plans/2026-08-10-live-provider-conformance.md).

## Logging / CI output

- Default reporter is **`dot`** (quiet pass, detailed fail).
- Do not add `console.log` in tests; use assertions.
- Production usage logging is separate (`src/logging/usage.ts`, JSONL).

## Adding a provider

1. Adapter + registry + matrix + provider doc
2. Extend `search-normalize.contract.test.mjs` if it implements `search`
3. Add a **provider-specific** test file only for non-shared behavior (crawl polling, URL paths, etc.)
