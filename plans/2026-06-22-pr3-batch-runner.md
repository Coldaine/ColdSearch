# PR 3: Batch Runner for Search, Extract, Crawl, and Provider Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `coldsearch batch` as a resumable JSONL runner for `search`, `extract`, `crawl`, and provider-tool calls.

**Architecture:** Build batch as a thin orchestration layer over `LocalExecutionBackend`. Do not bypass backend exact-cache behavior or searchable recent-result memory; both are PR 2 deliverables, so PR 3 implementation starts only after PR 2 merges and batch relies on PR 2's merged behavior rather than anything that exists today. Every batch item executes through the same `LocalExecutionBackend`/tool substrate as an equivalent standalone invocation and therefore creates the same normal execution-history record (once PR 2 history exists). `coldsearch batch` does not create a second parallel history model; the batch output JSONL file is the batch's own artifact. Keep output append-only so interrupted runs can resume from completed IDs.

**Tech Stack:** TypeScript, Node.js filesystem/readline APIs, built-in `node:test`, existing provider mocks.

---

## Scope

Implement:

- `coldsearch batch`
- JSONL input
- JSONL output
- Stable `id` resumability
- Controlled concurrency
- Duplicate handling
- Per-item success/error output
- `search`, `extract`, `crawl`, and provider-tool support
- Cache reuse for batch `search`, `extract`, and eligible provider-tool calls, relying on PR 2's merged cache behavior (PR 3 implementation starts only after PR 2 merges)

Do not implement:

- Vendor-native batch APIs unless they are already exposed through the PR 1 provider-tool surface
- Remote batch executor
- Daemon queue
- CSV input
- Non-JSONL output formats

## Files

- Create: `src/batch/types.ts`
- Create: `src/batch/jsonl.ts`
- Create: `src/batch/resume.ts`
- Create: `src/batch/runner.ts`
- Modify: `src/cli.ts`
- Modify: `src/types.ts`
- Modify: `README.md`
- Modify: `docs/CONFIGURATION.md`
- Test: `test/batch.test.mjs`
- Test: `test/cli-batch.test.mjs`

## Input Contract

Each input line is one JSON object:

```json
{"id":"node-lts","capability":"search","query":"current node lts version","limit":5}
{"id":"example-extract","capability":"extract","url":"https://example.com"}
{"id":"example-crawl","capability":"crawl","url":"https://example.com","limit":10}
{"id":"tavily-answer","tool":"tavily.answer","input":{"query":"current node lts version"}}
```

Rules:

- `id` is required.
- `id` must be a non-empty string.
- Each record must specify either `capability` or `tool`, not both.
- `capability` must be `search`, `extract`, or `crawl`.
- `tool` must be a provider-tool name exposed by `coldsearch tool list`.
- `search` requires `query`.
- `extract` requires `url`.
- `crawl` requires `url`.
- `tool` records require `input`.
- `limit` is optional.
- `providers` is optional.
- `singleProvider` is optional.
- `noCache` is optional.

## Output Contract

Each output line is one JSON object:

```json
{"id":"node-lts","capability":"search","status":"success","result":{"results":[],"providers_used":[]},"error":null}
{"id":"bad-url","capability":"extract","status":"error","result":null,"error":{"message":"Invalid URL"}}
{"id":"tavily-answer","tool":"tavily.answer","status":"success","result":{"provider":"tavily","tool":"answer","raw":{}},"error":null}
```

Rules:

- Successful records have `status:"success"` and `error:null`.
- Failed records have `status:"error"` and `result:null`.
- Every output record includes `id` and either `capability` or `tool`.
- Existing successful output records are skipped on resume.
- Existing error output records are retried only with `--retry-errors`.
- With concurrency and append-only resumability, output records are appended in completion order, not input order. `id` is the stable identity and resume key; no input-order buffering is performed.
- Duplicate ID semantics are explicit and deterministic:
  - Identical repeated `id` with identical input: execute the first record only; later identical duplicates are skipped.
  - Repeated `id` with different input: emit a visible duplicate/conflict error record and do not execute the later record.
  - Duplicate/conflict error records are not retried by `--retry-errors`, keeping reruns deterministic.

## CLI Contract

```bash
coldsearch batch --input queries.jsonl --output results.jsonl --concurrency 4
coldsearch batch --input queries.jsonl --output results.jsonl --concurrency 4 --retry-errors
coldsearch batch --input queries.jsonl --output results.jsonl --dry-run --json
```

## Tasks

- [ ] Write input validation tests for all three capabilities and provider-tool records.
- [ ] Implement `BatchInputRecord` and `BatchOutputRecord` in `src/batch/types.ts`.
- [ ] Implement JSONL reader in `src/batch/jsonl.ts`.
- [ ] Implement append-only JSONL writer in `src/batch/jsonl.ts`.
- [ ] Implement resume index loading in `src/batch/resume.ts`.
- [ ] Implement duplicate ID detection.
- [ ] Implement concurrency-limited execution without adding a dependency.
- [ ] Implement search execution through `LocalExecutionBackend.search()`.
- [ ] Implement extract execution through `LocalExecutionBackend.extract()`.
- [ ] Implement crawl execution through `LocalExecutionBackend.crawl()`.
- [ ] Implement provider-tool execution through the PR 1 tool surface.
- [ ] Add CLI parsing for `batch`.
- [ ] Add `--input`, `--output`, `--concurrency`, `--retry-errors`, and batch `--dry-run`.
- [ ] Add CLI help text.
- [ ] Update README with a batch section.
- [ ] Update `docs/CONFIGURATION.md` with batch flags.

## Required Tests

- [ ] `test/batch.test.mjs`: accepts valid search records.
- [ ] `test/batch.test.mjs`: accepts valid extract records.
- [ ] `test/batch.test.mjs`: accepts valid crawl records.
- [ ] `test/batch.test.mjs`: accepts valid provider-tool records.
- [ ] `test/batch.test.mjs`: rejects missing `id`.
- [ ] `test/batch.test.mjs`: rejects missing `query` for search.
- [ ] `test/batch.test.mjs`: rejects missing `url` for extract/crawl.
- [ ] `test/batch.test.mjs`: rejects missing `input` for provider-tool records.
- [ ] `test/batch.test.mjs`: rejects records that specify both `capability` and `tool`.
- [ ] `test/batch.test.mjs`: skips already-successful IDs on resume.
- [ ] `test/batch.test.mjs`: retries existing errors only with `retryErrors`.
- [ ] `test/batch.test.mjs`: enforces concurrency limit.
- [ ] `test/cli-batch.test.mjs`: runs a mixed search/extract/crawl/provider-tool batch with mocked providers.
- [ ] `test/cli-batch.test.mjs`: resumes a partial output file.
- [ ] `test/cli-batch.test.mjs`: verifies duplicate conflicting IDs produce an error.
- [ ] `test/cli-batch.test.mjs`: verifies batch search/extract/provider-tool records can use eligible cache behavior.

## Validation

Run before opening the PR:

```bash
npm test
node dist/cli.js batch --input <sample-jsonl> --output <tmp-jsonl> --concurrency 2 --dry-run --json
node dist/cli.js batch --input <sample-jsonl> --output <tmp-jsonl> --concurrency 2 --json
```

Run `npm run test:docs` only if this PR changes provider matrix, registry, config docs, architecture docs, or plan-validator expectations.

What these prove:

- `npm test` proves JSONL validation, resumability, duplicate handling, concurrency, mixed record execution, and cache reuse through focused offline tests.
- The batch CLI commands prove the new user-facing runner can parse real JSONL, dry-run without provider calls, write output JSONL, and resume a temp output file.
- `npm run test:docs`, when needed, proves changed docs and registries remain consistent.

Expected:

- Required tests pass.
- Dry run reports planned records without provider calls.
- Real run writes one JSONL output line per processed record.
- Resume run skips already successful records.

## Success Criteria

- Batch runs are resumable by stable `id`.
- Controlled concurrency works without bypassing existing routing, cache, or logging behavior.
- Mixed normalized capability and provider-tool records are supported.
- Duplicate handling is deterministic and visible in output.
- A failed item does not abort unrelated items unless the user explicitly chooses fail-fast behavior later.

## PR Review Pause

After implementation:

- [ ] Commit the completed PR 3 scope.
- [ ] Push the branch.
- [ ] Open PR 3 only after validation passes.
- [ ] Wait for CI and advisory reviewers.
- [ ] Read inline review threads, flat comments, bot comments, and check summaries.
- [ ] Address valid findings.
- [ ] Re-run the validation that proves the changed behavior after every follow-up commit. Include `npm test` for runtime changes and `npm run test:docs` only for docs/registry/validator changes.
- [ ] Wait again after every push.
- [ ] Do not start PR 4 until PR 3 is merged unless the user explicitly authorizes parallel work.
