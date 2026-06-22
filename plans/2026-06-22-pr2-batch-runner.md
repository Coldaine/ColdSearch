# PR 2: Batch Runner for Search, Extract, and Crawl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `coldsearch batch` as a resumable JSONL runner for `search`, `extract`, and `crawl`.

**Architecture:** Build batch as a thin orchestration layer over `LocalExecutionBackend`. Do not bypass backend cache behavior. Keep output append-only so interrupted runs can resume from completed IDs.

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
- `search`, `extract`, and `crawl` support
- Cache reuse for batch `search` and `extract`

Do not implement:

- Vendor-native batch APIs
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
```

Rules:

- `id` is required.
- `id` must be a non-empty string.
- `capability` must be `search`, `extract`, or `crawl`.
- `search` requires `query`.
- `extract` requires `url`.
- `crawl` requires `url`.
- `limit` is optional.
- `providers` is optional.
- `singleProvider` is optional.
- `noCache` is optional.

## Output Contract

Each output line is one JSON object:

```json
{"id":"node-lts","capability":"search","status":"success","result":{"results":[],"providers_used":[]},"error":null}
{"id":"bad-url","capability":"extract","status":"error","result":null,"error":{"message":"Invalid URL"}}
```

Rules:

- Successful records have `status:"success"` and `error:null`.
- Failed records have `status:"error"` and `result:null`.
- Every output record includes `id` and `capability`.
- Existing successful output records are skipped on resume.
- Existing error output records are retried only with `--retry-errors`.
- Duplicate input IDs are deterministic: the first valid record wins.
- Conflicting duplicate IDs create a duplicate-id error record.

## CLI Contract

```bash
coldsearch batch --input queries.jsonl --output results.jsonl --concurrency 4
coldsearch batch --input queries.jsonl --output results.jsonl --concurrency 4 --retry-errors
coldsearch batch --input queries.jsonl --output results.jsonl --dry-run --json
```

## Tasks

- [ ] Write input validation tests for all three capabilities.
- [ ] Implement `BatchInputRecord` and `BatchOutputRecord` in `src/batch/types.ts`.
- [ ] Implement JSONL reader in `src/batch/jsonl.ts`.
- [ ] Implement append-only JSONL writer in `src/batch/jsonl.ts`.
- [ ] Implement resume index loading in `src/batch/resume.ts`.
- [ ] Implement duplicate ID detection.
- [ ] Implement concurrency-limited execution without adding a dependency.
- [ ] Implement search execution through `LocalExecutionBackend.search()`.
- [ ] Implement extract execution through `LocalExecutionBackend.extract()`.
- [ ] Implement crawl execution through `LocalExecutionBackend.crawl()`.
- [ ] Add CLI parsing for `batch`.
- [ ] Add `--input`, `--output`, `--concurrency`, `--retry-errors`, and batch `--dry-run`.
- [ ] Add CLI help text.
- [ ] Update README with a batch section.
- [ ] Update `docs/CONFIGURATION.md` with batch flags.

## Required Tests

- [ ] `test/batch.test.mjs`: accepts valid search records.
- [ ] `test/batch.test.mjs`: accepts valid extract records.
- [ ] `test/batch.test.mjs`: accepts valid crawl records.
- [ ] `test/batch.test.mjs`: rejects missing `id`.
- [ ] `test/batch.test.mjs`: rejects missing `query` for search.
- [ ] `test/batch.test.mjs`: rejects missing `url` for extract/crawl.
- [ ] `test/batch.test.mjs`: skips already-successful IDs on resume.
- [ ] `test/batch.test.mjs`: retries existing errors only with `retryErrors`.
- [ ] `test/batch.test.mjs`: enforces concurrency limit.
- [ ] `test/cli-batch.test.mjs`: runs a mixed search/extract/crawl batch with mocked providers.
- [ ] `test/cli-batch.test.mjs`: resumes a partial output file.
- [ ] `test/cli-batch.test.mjs`: verifies duplicate conflicting IDs produce an error.
- [ ] `test/cli-batch.test.mjs`: verifies batch search/extract can use existing cache behavior.

## Validation

Run before opening the PR:

```bash
npm test
npm run test:docs
node dist/cli.js batch --input <sample-jsonl> --output <tmp-jsonl> --concurrency 2 --dry-run --json
node dist/cli.js batch --input <sample-jsonl> --output <tmp-jsonl> --concurrency 2 --json
```

Expected:

- All tests pass.
- Dry run reports planned records without provider calls.
- Real run writes one JSONL output line per processed record.
- Resume run skips already successful records.

## PR Review Pause

After implementation:

- [ ] Commit the completed PR 2 scope.
- [ ] Push the branch.
- [ ] Open PR 2 only after validation passes.
- [ ] Wait for CI, merge-gate, and advisory reviewers.
- [ ] Read inline review threads, flat comments, bot comments, and check summaries.
- [ ] Address valid findings.
- [ ] Re-run `npm test` and `npm run test:docs` after every follow-up commit.
- [ ] Wait again after every push.
- [ ] Do not start PR 3 until PR 2 is merged unless the user explicitly authorizes parallel work.

