# PR 1: Provider Tool Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make any provider-specific tool reachable through ColdSearch — without falling back to separate vendor CLIs, MCPs, or hand-written scripts — by building one generic provider-tool invocation substrate, then layering curated tools and the normalized capabilities on top of it.

**Architecture:** The spine is a single generic primitive: invoke `<provider>.<tool>` with explicit parameters and get the raw provider response back. Everything else is a special case of that primitive. Curated, broadly-useful tools add a registered schema, an optional non-lossy summary, and pass-through parity proof. The normalized `search`/`extract`/`crawl` capabilities are orchestrated fan-outs of the same primitive. A tool ColdSearch has not catalogued is still callable through the generic path (raw-only, with a warning) so niche and brand-new provider tools are never gated behind someone first enumerating them. Do not force any vendor tool into a lossy common schema.

**Tech Stack:** TypeScript, existing adapter modules, existing provider registry, built-in `node:test`, CLI integration tests.

---

## Design Principle: Generic Substrate First

The mistake to avoid is building a curated registry where a tool is reachable *only* after someone writes a bespoke handler, schema, and test for it. There are far more provider tools (and provider-specific parameters) than ColdSearch will ever enumerate, and providers keep adding more. If the only path is the enumerated one, ColdSearch silently caps what its users can do.

So the layering is, bottom to top:

1. **Generic call substrate (the spine).** `coldsearch tool call <provider>.<tool>` resolves the provider's key, applies the same timeout/error handling as normalized capabilities, sends the caller's parameters to that provider's API, logs the call, and returns the **raw** provider response. This works for *any* `<tool>` the provider exposes, catalogued or not.
2. **Curated tools (special case: known shape).** For broadly-useful tools, the registry additionally carries metadata — a request/response shape, an optional non-lossy `summary`, and a pass-through parity probe. Curation buys validation and a tidy summary; it does **not** gate reachability.
3. **Normalized capabilities (special case: cross-provider orchestration).** `search`/`extract`/`crawl` remain their own commands, but conceptually they are orchestrated fan-outs of the substrate across a provider pool, with normalization, RRF merge, key spreading, and comparison layered on. This is where ColdSearch earns its multi-provider value (NORTH_STAR G2/G3); the substrate alone is single-provider, single-key.

**Reachability rule (warn-but-forward):** an unknown *provider* fails locally before any network call. An unknown or uncatalogued *tool* on a known provider is **forwarded** to the provider with a warning (raw-only, no summary, no schema validation) rather than rejected — so an uncatalogued or newly-released tool still works. Invalid *parameters* surface the provider's own error verbatim. This is the Fail-Visible pillar applied to the tool surface.

## Scope

Implement:

- A generic provider-tool invocation substrate that dispatches `<provider>.<tool>` with caller-supplied parameters and returns the raw provider payload, usable for catalogued and uncatalogued tools alike (warn-but-forward).
- Provider-tool registry metadata in code for the curated tools (request/response shape, optional summary, parity probe).
- `coldsearch tool list` (shows catalogued tools and their wired/deferred status).
- `coldsearch tool call <provider>.<tool> --json-input <file-or-stdin>` as the generic entry point.
- JSON output that includes provider, tool, an optional non-lossy summary for catalogued tools, and the raw provider payload for every call.
- Usage/audit log entries for provider-tool calls.
- Provider matrix docs that show tool-level catalogued/wired/uncatalogued status and document the generic passthrough.
- Tests that prove every in-scope curated tool is reachable AND that an uncatalogued tool still forwards raw through the generic path.

Do not implement:

- Separate per-vendor CLIs.
- A new MCP server in this PR.
- Remote execution.
- Autonomous browser-agent tools that can click/type/act on websites.
- Paid-only data-for-AI products unless the provider API can be represented safely without a live paid account.
- Niche academic/legal verticals unless they fall out mechanically from a generic vertical-search adapter.

## Curated Provider Tools (special cases on top of the substrate)

Catalogue these — give them registry metadata, an optional summary, and a parity probe — where the upstream API and existing config model make it practical. Everything here is *also* reachable through the bare generic substrate; cataloguing just adds validation, a summary, and proof.

| Provider | Tool surface to catalogue |
| --- | --- |
| Tavily | `map`, `answer`, `research`, search `topic:"news"` |
| Firecrawl | `map`, structured `extract`, `batch_scrape` |
| Exa | `findSimilar`, `answer`, `research`, web-grounded chat/completions if it can be exposed as a provider tool without becoming the project LLM client |
| Brave | news, images, videos, suggest, spellcheck |
| Serper | images, news, videos, shopping, maps, places, autocomplete, reviews |
| Jina | `s.jina.ai` search, rerank, embeddings where the request shape can stay explicit |
| SearXNG | category variants such as news, images, and videos |

Not catalogued in this PR (still reachable raw via the generic substrate; just not given metadata/summary/parity proof unless re-prioritized):

- Serper scholar and patents.
- Brave Data-for-AI paid context products.

Hard-excluded from the substrate as well (not just uncatalogued — actively refused), because they mutate remote state or need separate stateful setup:

- Firecrawl `/agent` and scrape actions that click, type, scroll, or mutate remote state.
- Any tool that requires a separate account, project, or stateful setup beyond the existing provider config.

## Command Contract

```bash
coldsearch tool list --json
coldsearch tool list --provider tavily --json
# Curated tool — returns summary + raw:
coldsearch tool call tavily.map --json-input request.json --json
echo '{"query":"coldsearch"}' | coldsearch tool call exa.answer --json-input - --json
# Uncatalogued tool on a known provider — forwarded raw with a warning, still works:
echo '{"url":"https://example.com"}' | coldsearch tool call firecrawl.somenewtool --json-input - --json
```

Output shape:

```json
{
  "provider": "tavily",
  "tool": "map",
  "ok": true,
  "catalogued": true,
  "summary": {},
  "raw": {},
  "meta": {
    "duration_ms": 123,
    "safe_key_ref": "env:TAVILY_API_KEY",
    "warnings": []
  }
}
```

Rules:

- `raw` must preserve provider detail for **every** call, catalogued or not.
- `summary` is optional, only emitted for catalogued tools, and must not hide raw details.
- `catalogued: false` calls forward raw and add a `warnings` entry noting the tool is uncatalogued; they do not fail just because ColdSearch lacks metadata.
- An unknown provider fails locally before any network call. Invalid parameters surface the provider's own error.
- Errors must identify config, credentials, network, provider, or unsupported-tool failures where practical.
- Provider-tool calls must honor the same key resolution and timeout rules as normalized capabilities.

## Pass-Through Parity Requirement

Every **catalogued** provider tool added in this PR must be proven against the provider-native path. Do not count a catalogued tool as implemented just because `coldsearch tool call` returns JSON. (Uncatalogued tools are proven structurally — that the generic substrate forwards request and returns raw — not per-tool against native output.)

For each catalogued tool:

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

Use [2026-06-23-gate-0-provider-pass-through-proof.md](./2026-06-23-gate-0-provider-pass-through-proof.md) as the method. PR 1 extends that Gate 0 method from current normalized paths to newly catalogued provider tools.

## Files

- Modify: `src/cli.ts`
- Modify: `src/providers.ts`
- Modify: `src/types.ts`
- Modify: `src/adapters/*.ts`
- Modify or add: `src/tools/*` (generic substrate + curated metadata)
- Modify: `src/logging/usage.ts`
- Modify: `scripts/provider-pass-through.mjs`
- Modify: `docs/PROVIDERS.md`
- Modify: `docs/DEVELOPER.md`
- Modify: `docs/architecture.md`
- Test: `test/provider-tools.test.mjs`
- Test: `test/cli-integration.test.mjs`
- Test: `test/capability-matrix-drift.test.mjs`

## Tasks

- [ ] Build the generic provider-tool dispatcher: given `<provider>`, `<tool>`, and a params object, resolve a key, apply timeout/error handling, send the request to the provider API, and return the raw response.
- [ ] Implement warn-but-forward: unknown provider fails locally; uncatalogued tool on a known provider forwards raw with a warning; hard-excluded tools are actively refused.
- [ ] Define a provider-tool request/response type that preserves raw payloads and carries `catalogued` + `warnings`.
- [ ] Add provider-tool registry metadata for the curated tools (request/response shape, optional summary, parity probe).
- [ ] Add `tool list` command parsing.
- [ ] Add `tool call` command parsing.
- [ ] Support `--json-input -` for stdin.
- [ ] Support `--json-input <path>` for files.
- [ ] Validate the provider name before making a provider request; do not hard-fail on an uncatalogued tool name.
- [ ] Route provider-tool calls through existing key resolution.
- [ ] Route provider-tool calls through existing timeout/retry/error handling where applicable.
- [ ] Log provider-tool calls with provider, tool, catalogued flag, safe key reference, timing, success/error, and run ID when present.
- [ ] Preserve raw provider payloads in JSON output for every call.
- [ ] Add concise summaries only for catalogued tools and only where non-lossy.
- [ ] For each catalogued provider tool, write or run a provider-native comparison probe using the same request payload.
- [ ] Record provider-native vs ColdSearch evidence for every catalogued tool.
- [ ] Mark any catalogued tool with unexplained provider data loss as not done.
- [ ] Update `docs/PROVIDERS.md` so the tool matrix distinguishes catalogued/wired, uncatalogued-but-reachable, and hard-excluded tools, and documents the generic passthrough.
- [ ] Update `docs/DEVELOPER.md` with the provider-tool substrate + catalogue contract.
- [ ] Update `docs/architecture.md` status labels if the provider-tool surface becomes Current.

## Required Tests

- [ ] `test/provider-tools.test.mjs`: registry lists each in-scope catalogued provider tool.
- [ ] `test/provider-tools.test.mjs`: an uncatalogued tool on a known provider forwards raw through the generic substrate (with a warning) instead of failing.
- [ ] `test/provider-tools.test.mjs`: an unknown provider, and a hard-excluded tool, fail without a network call.
- [ ] `test/provider-tools.test.mjs`: raw provider payload is preserved for catalogued and uncatalogued calls.
- [ ] `test/provider-tools.test.mjs`: usage log records provider-tool calls without raw secret values.
- [ ] `test/provider-tools.test.mjs`: provider-tool dispatch calls the expected provider endpoint or SDK method.
- [ ] `test/cli-integration.test.mjs`: `tool list --json` is parseable.
- [ ] `test/cli-integration.test.mjs`: `tool call <provider>.<tool> --json-input - --json` works with a mocked adapter.
- [ ] `test/capability-matrix-drift.test.mjs`: catalogued provider-tool docs and registry do not drift (the drift check applies only to the curated layer, not the generic passthrough).

## Validation

Run before opening the PR:

```bash
npm test
npm run test:docs
node dist/cli.js tool list --json
echo '{"query":"coldsearch"}' | node dist/cli.js tool call tavily.answer --json-input - --json
node scripts/provider-pass-through.mjs --provider <provider> --path <new-tool-or-path>
```

What these prove:

- `npm test` proves the generic dispatcher, the curated registry, the CLI parser, raw payload preservation, warn-but-forward behavior, endpoint dispatch, and safe usage logging through offline tests.
- `npm run test:docs` proves the catalogued provider-tool registry and provider matrix documentation have not drifted.
- `tool list --json` proves the catalogued surface is discoverable and machine-readable.
- `tool call ... --json-input` proves the generic substrate accepts explicit input and returns the contract shape for both catalogued and uncatalogued tools.
- `provider-pass-through` proves each newly catalogued provider tool against its provider-native API/SDK/CLI path. Run one row per catalogued tool with available credentials or an explicit user waiver.

Expected:

- Required tests pass.
- `tool list --json` includes the catalogued tools.
- Provider-tool calls return JSON with `provider`, `tool`, `ok`, `catalogued`, and `raw`.
- An uncatalogued tool forwards raw with a warning; an unknown provider and a hard-excluded tool fail visibly without a provider call.
- Provider-native vs ColdSearch evidence exists for every catalogued tool that has credentials/endpoints available.
- No command prints raw API keys.

## Success Criteria

- Any tool a configured provider exposes is reachable through ColdSearch via the generic `tool call` substrate, catalogued or not.
- Broadly useful tools are catalogued with summaries and proven against native provider paths, not inferred from mocks.
- Niche or new tools remain reachable raw without first being enumerated; only state-mutating/stateful tools are actively excluded, and that exclusion is explicit.
- Raw provider details survive end to end for every call.
- Provider-tool calls are auditable in logs, including whether the tool was catalogued.
- The provider matrix can fail CI when the catalogued docs and registry drift.

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
