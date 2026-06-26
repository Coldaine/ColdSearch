# PR 1: Provider Tool Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make broadly useful provider-specific tools usable through ColdSearch without falling back to separate vendor CLIs, MCPs, or hand-written scripts.

**Architecture:** Add a controlled provider-tool surface alongside the normalized `search`, `extract`, and `crawl` capabilities. Preserve raw provider detail. Do not force every vendor tool into a lossy common schema.

**Tech Stack:** TypeScript, existing adapter modules, existing provider registry, built-in `node:test`, CLI integration tests.

---

## Scope

Implement:

- Provider-tool registry metadata in code.
- `coldsearch tool list`.
- `coldsearch tool info <provider>.<tool>` so callers can inspect the exact input schema before using a tool.
- `coldsearch tool call <provider>.<tool> --json-input <file-or-stdin>`.
- JSON output that includes provider, tool, normalized summary when useful, and raw provider payload.
- Usage/audit log entries for provider-tool calls.
- Provider matrix docs that show tool-level wired/unwired status.
- Tests that prove every in-scope broad tool is reachable through ColdSearch.
- All broad provider tools listed below, unless the tool is explicitly in the deferred list or the user explicitly waives it.

Do not implement:

- Separate per-vendor CLIs.
- A new MCP server in this PR.
- Remote execution.
- Autonomous browser-agent tools that can click/type/act on websites.
- Paid-only data-for-AI products unless the provider API can be represented with the existing provider key/config model.
- Niche academic/legal verticals unless they fall out mechanically from a generic vertical-search adapter.

## In-Scope Provider Tools

Wire these. Discovery and parity evidence determine the correct command shape, request schema, polling behavior, and logging contract; they are not permission to drop tools from scope.

| Provider | Tool surface to wire |
| --- | --- |
| Tavily | `map`, `answer`, `research`, search `topic:"news"` |
| Firecrawl | `map`, structured `extract`, `batch_scrape` |
| Exa | `findSimilar`, `answer`, `research`, web-grounded chat/completions if it can be exposed as a provider tool without becoming the project LLM client |
| Brave | news, images, videos, suggest, spellcheck |
| Serper | images, news, videos, shopping, maps, places, autocomplete, reviews |
| Jina | `s.jina.ai` search, rerank, embeddings where the request shape can stay explicit |
| SearXNG | category variants such as news, images, and videos |

## Non-Negotiable Scope Rule

Do not narrow PR 1 to "only tools whose shape is proven and safe."

The point of PR 1 is to make the useful provider tool surface reachable through ColdSearch. If a provider tool is broad and useful, implement it with its native shape:

- Synchronous tools return completed results.
- Async/job tools return job state, polling metadata, and final results when the provider supports waiting.
- Vertical-search tools expose the provider's vertical parameters explicitly.
- Native batch tools are exposed as provider tools; generic `coldsearch batch` remains PR 3.
- Provider-specific options stay in typed input schemas and raw output, not lossy common fields.

Assume credentials/endpoints exist for every listed provider. If the agent cannot resolve a required key, endpoint, account feature, provider-side setup, or paid-plan access in its current environment, stop and ask the user to expose it. Do not silently remove the tool from the plan, do not narrow scope, and do not treat missing local credentials as a completed evidence state.

Explicitly defer unless the user re-prioritizes them:

- Serper scholar and patents.
- Firecrawl `/agent` and scrape actions that click, type, scroll, or mutate remote state.
- Brave Data-for-AI paid context products.
- Any tool that requires stateful browser automation or mutates remote sites.

## Command Contract

```bash
coldsearch tool list --json
coldsearch tool list --provider tavily --json
coldsearch tool info tavily.map --json
coldsearch tool call tavily.map --json-input request.json --json
echo '{"query":"coldsearch"}' | coldsearch tool call exa.answer --json-input - --json
```

Output shape:

```json
{
  "provider": "tavily",
  "tool": "map",
  "status": "completed",
  "summary": {},
  "raw": {},
  "meta": {
    "duration_ms": 123,
    "safe_key_ref": "env:TAVILY_API_KEY"
  }
}
```

Rules:

- `raw` must preserve provider detail.
- `summary` is optional and must not hide raw details.
- Async/job tools may return `status:"accepted"`, `job_id`, provider polling metadata, and `raw` provider state instead of final results.
- Errors must identify config, credentials, network, provider, or unsupported-tool failures where practical.
- Provider-tool calls must honor the same key resolution and timeout rules as normalized capabilities.

## Pass-Through Parity Requirement

Every provider tool added in this PR must be proven against the provider-native path. Do not count a tool as implemented just because `coldsearch tool call` returns JSON.

For each in-scope tool:

1. Run the provider-native API, SDK, or official CLI with a fixed request payload.
2. Run `coldsearch tool call <provider>.<tool>` with the same request payload.
3. Confirm both calls hit the real provider path, not a mock.
4. Compare stable fields and result counts where the provider returns comparable output.
5. Confirm ColdSearch preserves the provider-native payload in `raw` or documents the exact faithful subset.
6. Record any normalization or loss. Unexplained loss is a blocker.

Example for Firecrawl `map`:

1. Run Firecrawl-native `POST https://api.firecrawl.dev/v2/map` with `{ "url": "https://docs.firecrawl.dev" }`.
2. Run `coldsearch tool call firecrawl.map --json-input firecrawl-map.json --json` with the same payload.
3. Confirm returned URLs overlap and `raw` preserves the Firecrawl response shape.
4. Confirm usage logs show a Firecrawl provider-tool call with a safe key reference.

Use [2026-06-23-gate-0-provider-pass-through-proof.md](./2026-06-23-gate-0-provider-pass-through-proof.md) as the method. PR 1 extends that Gate 0 method from current normalized paths to newly exposed provider tools.

## Files

- Modify: `src/cli.ts`
- Modify: `src/providers.ts`
- Modify: `src/types.ts`
- Modify: `src/adapters/*.ts`
- Modify or add: `src/tools/*`
- Modify: `src/logging/usage.ts`
- Modify: `scripts/provider-pass-through.mjs`
- Modify: `docs/PROVIDERS.md`
- Modify: `docs/DEVELOPER.md`
- Modify: `docs/architecture.md`
- Test: `test/provider-tools.test.mjs`
- Test: `test/cli-integration.test.mjs`
- Test: `test/capability-matrix-drift.test.mjs`

## Tasks

- [ ] Add provider-tool metadata to the provider registry.
- [ ] Define a provider-tool request/response type that preserves raw payloads.
- [ ] Add adapter methods or provider-tool handlers for in-scope tools.
- [ ] Add `tool list` command parsing.
- [ ] Add `tool info` command parsing.
- [ ] Add `tool call` command parsing.
- [ ] Support `--json-input -` for stdin.
- [ ] Support `--json-input <path>` for files.
- [ ] Define input schemas for every in-scope provider tool.
- [ ] Validate provider and tool names before making a provider request.
- [ ] Validate provider-tool JSON input before making a provider request.
- [ ] Model async/job tools explicitly instead of forcing them into a synchronous result contract.
- [ ] Route provider-tool calls through existing key resolution.
- [ ] Route provider-tool calls through existing timeout/retry/error handling where applicable.
- [ ] Log provider-tool calls with provider, tool, safe key reference, timing, success/error, and run ID when present.
- [ ] Preserve raw provider payloads in JSON output.
- [ ] Add concise summaries only where useful and non-lossy.
- [ ] For each provider tool, write or run a provider-native comparison probe using the same request payload.
- [ ] Record provider-native vs ColdSearch evidence for every in-scope tool.
- [ ] Fix any tool with unexplained provider data loss before marking PR 1 complete.
- [ ] If credential/account access is missing locally, stop and request user credential injection; do not remove the corresponding tool implementation target unless the user explicitly waives it.
- [ ] Update `docs/PROVIDERS.md` so the tool matrix distinguishes wired, deferred, and niche-deferred tools.
- [ ] Update `docs/DEVELOPER.md` with the provider-tool adapter contract.
- [ ] Update `docs/architecture.md` status labels if the provider-tool surface becomes Current.

## Required Tests

- [ ] `test/provider-tools.test.mjs`: registry lists each in-scope provider tool.
- [ ] `test/provider-tools.test.mjs`: unsupported provider/tool pairs fail without a network call.
- [ ] `test/provider-tools.test.mjs`: raw provider payload is preserved.
- [ ] `test/provider-tools.test.mjs`: usage log records provider-tool calls without raw secret values.
- [ ] `test/provider-tools.test.mjs`: provider-tool handlers call the expected provider endpoint or SDK method.
- [ ] `test/cli-integration.test.mjs`: `tool list --json` is parseable.
- [ ] `test/cli-integration.test.mjs`: `tool info <provider>.<tool> --json` returns the input schema and cache/evidence policy.
- [ ] `test/cli-integration.test.mjs`: `tool call <provider>.<tool> --json-input - --json` works with a mocked adapter.
- [ ] `test/capability-matrix-drift.test.mjs`: provider-tool docs and registry do not drift.

## Validation

Run before opening the PR:

```bash
npm test
npm run test:docs
node dist/cli.js tool list --json
node dist/cli.js tool info tavily.map --json
echo '{"query":"coldsearch"}' | node dist/cli.js tool call tavily.answer --json-input - --json
node scripts/provider-pass-through.mjs --provider <provider> --path <new-tool-or-path>
```

What these prove:

- `npm test` proves the provider-tool registry, CLI parser, raw payload preservation, endpoint dispatch, and safe usage logging through offline tests.
- `npm run test:docs` proves the provider-tool registry and provider matrix documentation have not drifted.
- `tool list --json` proves the new surface is discoverable and machine-readable.
- `tool info ... --json` proves callers can discover the exact provider-tool input schema without leaving ColdSearch.
- `tool call ... --json-input` proves at least one provider-tool command path accepts explicit input and returns the contract shape.
- `provider-pass-through` proves each newly wired provider tool against its provider-native API/SDK/CLI path. Run one row per in-scope tool; if credentials are not visible to the agent, stop and request credential injection.

Expected:

- Required tests pass.
- `tool list --json` includes the in-scope tools.
- `tool info --json` returns schemas for every in-scope provider tool.
- Provider-tool calls return JSON with `provider`, `tool`, `status`, and `raw`.
- Unsupported tools fail visibly and do not make provider calls.
- Provider-native vs ColdSearch evidence exists for every in-scope tool, or the user explicitly waived that row.
- No command prints raw API keys.

## Success Criteria

- Broadly useful tools from every configured provider are reachable through ColdSearch.
- Niche or high-risk tools are explicitly marked deferred, not forgotten.
- Async, vertical, and native-batch provider tools keep their native semantics instead of being flattened or dropped.
- Raw provider details survive end to end.
- Provider-tool pass-through is proven against native provider paths, not inferred from mocks.
- Provider-tool calls are auditable in logs.
- The provider matrix can fail CI when docs and registry drift.

## PR Review Pause

After implementation:

- [ ] Commit the completed PR 1 scope.
- [ ] Push the branch.
- [ ] Open PR 1 only after validation passes.
- [ ] Wait for CI, merge-gate, and advisory reviewers.
- [ ] Read inline review threads, flat comments, bot comments, and check summaries.
- [ ] Address valid findings.
- [ ] Re-run the validation that proves the changed behavior after every follow-up commit. Include `npm test` for runtime changes, `npm run test:docs` for registry/docs changes, and provider-native comparison for touched provider tools.
- [ ] Wait again after every push.
- [ ] Do not start PR 2 until PR 1 is merged unless the user explicitly authorizes parallel work.
