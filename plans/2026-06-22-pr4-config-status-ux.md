# PR 4: Operator Config and Status UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve issue #6 by making ColdSearch easier to bootstrap, diagnose, and operate.

**Architecture:** Keep config loading centralized in `src/config.ts`. Extract status building out of `src/cli.ts` into testable helpers if needed. Preserve CLI flag precedence over config file defaults.

**Tech Stack:** TypeScript, TOML config via `@iarna/toml`, built-in `node:test`, existing CLI integration test harness.

---

## Scope

Implement:

- `coldsearch config init`
- `coldsearch config doctor`
- Agent LLM base URL config in TOML
- Status output improvements
- Better user-facing error classification
- Provider-tool coverage diagnostics
- Documentation updates for config/status/key management

Do not implement:

- Interactive setup wizard
- Secret manager writes
- Provider account quota APIs
- Daemon status
- Remote executor status

## Files

- Modify: `src/cli.ts`
- Modify: `src/config.ts`
- Modify: `src/types.ts`
- Modify: `src/http.ts`
- Modify: `src/agent/llm.ts`
- Modify: `src/logging/usage.ts`
- Modify: `config.example.toml`
- Modify: `docs/CONFIGURATION.md`
- Modify: `docs/KEY_MANAGEMENT.md`
- Test: `test/cli-integration.test.mjs`
- Test: `test/agent-llm-url.test.mjs`
- Test: `test/runtime-seams.test.mjs`

## Agent LLM TOML Contract

```toml
[agent.llm]
provider = "openai"
model = "gpt-5-mini"
base_url = "https://api.openai.com/v1"
```

Precedence:

1. CLI flags: `--llm`, `--model`, `--llm-base-url`
2. TOML `[agent.llm]`
3. Environment fallback and code defaults

## Error Categories

Use these categories in machine-readable status/doctor output where practical:

- `config`
- `credentials`
- `network`
- `provider`
- `unsupported_capability`
- `unsupported_tool`

Do not hide the original message. Add category next to it.

## Tasks

- [ ] Add config schema fields for `[agent.llm]`.
- [ ] Add `config init` command parsing. `config` must be registered in the commands array / parsing before the query fallback in `src/cli.ts` (commands array at `src/cli.ts:72`, fallback at `src/cli.ts:219-230`); otherwise `coldsearch config init` is silently parsed as a search query for "config init".
- [ ] Implement config init so it refuses to overwrite an existing config.
- [ ] Add `config doctor` command parsing.
- [ ] Implement config doctor checks for TOML parse, required sections, provider names, capability compatibility, key references, and SearXNG base URL. Doctor performs local diagnostics only: it must not contact provider APIs, must not consume provider credits, must not resolve `doppler:` references (syntax/presence check only), and the SearXNG base URL check is presence/format only, not a liveness probe.
- [ ] Extract status-building logic into a testable helper.
- [ ] Add config path to status output.
- [ ] Add cache enabled/path to status output.
- [ ] Add usage path to status output.
- [ ] Add missing env var warnings to status output.
- [ ] Add provider capability coverage to status output.
- [ ] Add provider-tool coverage to status output. Coverage means registry state only: counts/listing of tool profiles by wiring status (`wired` / `direct` / `available` / `deferred`). It is not live provider health and must not contact providers.
- [ ] Add TOML agent LLM base URL support.
- [ ] Preserve CLI flag precedence over TOML.
- [ ] Add error classification helpers.
- [ ] Update `docs/CONFIGURATION.md`.
- [ ] Update `docs/CONFIGURATION.md` so usage logging/status are no longer described as missing.
- [ ] Update `config.example.toml`.

## Required Tests

- [ ] `test/cli-integration.test.mjs`: `config init` creates a config at a temp path.
- [ ] `test/cli-integration.test.mjs`: `config init` refuses to overwrite an existing config.
- [ ] `test/cli-integration.test.mjs`: `config doctor --json` reports valid config success.
- [ ] `test/cli-integration.test.mjs`: `config doctor --json` reports missing env vars without printing secret values.
- [ ] `test/cli-integration.test.mjs`: `status --json` includes config path.
- [ ] `test/cli-integration.test.mjs`: `status --json` includes cache state and usage path.
- [ ] `test/agent-llm-url.test.mjs`: TOML `agent.llm.base_url` is used when CLI flag is absent.
- [ ] `test/agent-llm-url.test.mjs`: CLI `--llm-base-url` overrides TOML.
- [ ] `test/runtime-seams.test.mjs`: unsupported provider/capability pairing is classified as `unsupported_capability`.
- [ ] `test/runtime-seams.test.mjs`: unsupported provider-tool pairing is classified as `unsupported_tool`.

## Validation

Run before opening the PR:

```bash
npm test
node dist/cli.js config init --config <tmp-config>
node dist/cli.js config doctor --config <tmp-config> --json
node dist/cli.js status --config <tmp-config> --json
```

Run `npm run test:docs` because this PR is expected to change config/key-management documentation. If no docs or registry files changed, record why it was unnecessary.

What these prove:

- `npm test` proves config init, config doctor, status output, LLM endpoint precedence, and error classification through focused offline tests.
- The config/status CLI commands prove the operator-facing workflow works against a temp config and returns parseable JSON where promised.
- `npm run test:docs` proves the changed config, key-management, architecture, or provider docs remain internally consistent.

Expected:

- Required tests pass.
- Config init writes a usable starter file.
- Config doctor exits 0 for valid config.
- Status output is JSON-parseable.
- No command prints raw API keys.

## Success Criteria

- A new operator can generate a starter config without overwriting existing config.
- `config doctor` explains config, credential, provider, capability, and tool-surface problems clearly.
- `status --json` exposes paths, cache/logging state, provider coverage, provider-tool coverage, and missing env vars.
- Agent LLM endpoint config uses OpenAI-compatible endpoint fields and preserves CLI override precedence.
- Diagnostics improve auditability without printing secret values.

## PR Review Pause

After implementation:

- [ ] Commit the completed PR 4 scope.
- [ ] Push the branch.
- [ ] Open PR 4 only after validation passes.
- [ ] Wait for CI and advisory reviewers.
- [ ] Read inline review threads, flat comments, bot comments, and check summaries.
- [ ] Address valid findings.
- [ ] Re-run the validation that proves the changed behavior after every follow-up commit. Include `npm test` for runtime changes and `npm run test:docs` for docs/registry/validator changes.
- [ ] Wait again after every push.
- [ ] Do not start PR 5 until PR 4 is merged unless the user explicitly authorizes parallel work.
