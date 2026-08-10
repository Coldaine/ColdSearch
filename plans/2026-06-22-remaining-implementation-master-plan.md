# Remaining Implementation Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each linked PR plan task-by-task. Do not collapse these PRs into one change unless the user explicitly changes the goal.

**Goal:** Track the completed provider-tool foundation and finish the remaining ColdSearch work through four reviewable implementation PRs, with a hard review pause after each PR.

**Architecture:** Keep `coldsearch` as the stable CLI. Add missing behavior behind the existing local seams: provider adapters, provider-tool registry, `LocalExecutionBackend`, `CacheStore`, `UsageLogger`, `FanoutEngine`, `SearchAgent`, and the config loader. Documentation changes travel with the implementation PR that changes the operator-facing surface.

**Tech Stack:** TypeScript, Node.js >=18, built-in `node:test`, TOML config via `@iarna/toml`, local JSONL/cache files under `~/.config/coldsearch/`.

---

## Current Sequence

PR 1 is complete on `main`; PRs 2–5 remain:

1. [PR 1: Provider Tool Surface](./2026-06-22-pr1-provider-tool-surface.md) — **completed**
2. [PR 2: Search History and Research Memory](./2026-06-22-pr2-cache-a2.md)
3. [PR 3: Batch Runner for Search, Extract, Crawl, and Provider Tools](./2026-06-22-pr3-batch-runner.md)
4. [PR 4: Operator Config and Status UX](./2026-06-22-pr4-config-status-ux.md)
5. [PR 5: Agent Run IDs and Trace Correlation](./2026-06-22-pr5-agent-run-ids.md)

This split is natural because each PR has a different owner surface:

- PR 1 delivered the provider-tool profile registry, `tool list`, `tool info`, networked `tool call`, raw-payload preservation, and safe usage logging.
- PR 2 owns durable execution history, exploration/comparison, intentional reuse, and the persistence needed to support them.
- PR 3 owns high-volume execution workflows across normalized capabilities and provider tools.
- PR 4 owns operator setup, diagnostics, and status.
- PR 5 owns agent traceability.

Do not add remote execution or cross-process key coordination to the remaining sequence. Epic 5 (remote agentic execution) is documented and deferred — see [2026-06-22-epic-5-remote-agentic-execution.md](./2026-06-22-epic-5-remote-agentic-execution.md). Provider tools not currently wired remain visible through the registry rather than making completed PR 1 appear unfinished.

## Current Baseline

Functional now:

- `coldsearch search`, `extract`, `crawl`, and `status`
- ReAct agent mode
- Provider routing and validation
- Usage JSONL logging
- Exact read-through cache for `search` and `extract`
- `--no-cache`
- Live provider canary workflow
- Provider-tool profile registry and offline `tool list`/`tool info`
- Networked `tool call <provider>.<tool>`
- Provider-tool raw-payload preservation and safe usage/audit logging
- Provider registry/docs drift checks

Missing now:

- Durable execution records shared by normalized and provider-tool paths
- `coldsearch history recent`, `search`, and `show`
- Raw and normalized execution inspection
- Related prior searches, per-provider fanout views, and intentional reuse
- Atomic history writes and restrictive file permissions
- Exact-replay freshness controls and cache maintenance
- `coldsearch batch`
- Batch resumability by stable `id`
- Batch controlled concurrency
- Batch duplicate handling
- Batch support for `search`, `extract`, `crawl`, and provider-tool calls
- Config bootstrap UX
- Better error classification
- Status enhancements, including provider-tool coverage
- Agent LLM base URL in TOML
- Structured agent run IDs
- Explicit crawl-cache policy

Baseline health checks before this plan split:

```bash
npm test
npm run test:docs
```

What these prove:

- `npm test` proves the built TypeScript and existing offline unit/integration contracts are not broken.
- `npm run test:docs` proves the provider capability matrix, registry, and plan/doc references covered by the validator are internally consistent.

What these do not prove:

- They do not prove that ColdSearch hits real provider APIs.
- They do not prove provider-native parity.
- They do not prove a new CLI workflow is ergonomic or useful.
- They do not prove cache, batch, provider-tool, or agent observability behavior unless focused tests for those behaviors were added.

## Live Provider Conformance

Plans:

- [Gate 0: Initial Live Provider Conformance Baseline](./2026-06-23-gate-0-provider-pass-through-proof.md)
- [Ongoing Live Provider Conformance](./2026-08-10-live-provider-conformance.md)

Gate 0 established the initial provider/path baseline before PR 1; its committed evidence records 11 passes and 2 missing-configuration blocks. It is integration conformance, not benchmarking and not a recurring release gate. Later PRs run it only for provider-facing paths they change, while the scheduled canary reports broader coverage.

Goal:

- Prove that every currently implemented real provider path actually calls the provider, receives real results, and returns useful output through ColdSearch.
- Compare provider-native output against ColdSearch output for the same request.
- Identify wrappers that hide, drop, or distort provider data before building more tool surface on top.

Out of scope for Gate 0:

- Agentic testing.
- LLM answer quality.
- Remote execution.
- Cache behavior.
- Batch behavior.

Required provider paths:

| Provider | Current ColdSearch path | Provider-native path to compare |
| --- | --- | --- |
| Tavily | `search`, `extract`, `crawl` | Tavily HTTP API or official SDK for `/search`, `/extract`, `/crawl` |
| Firecrawl | `search`, `extract`, `crawl` | Firecrawl HTTP API or official SDK/CLI for `/search`, `/scrape`, `/crawl` |
| Exa | `search`, `extract`, synthesized `crawl` | Exa HTTP API or official SDK for `/search` and `/contents`; record that crawl is synthesized |
| Brave | `search` | Brave Search HTTP API for web search |
| Serper | `search` | Serper HTTP API for Google web search |
| Jina | `extract` | Jina Reader HTTP endpoint |
| SearXNG | `search` | Configured SearXNG HTTP endpoint |

For each provider path:

- [ ] Run the provider-native request with a fixed query or URL.
- [ ] Run the matching ColdSearch command with the same query or URL and a single provider selected.
- [ ] Confirm both paths hit the real provider, not a mock.
- [ ] Confirm both paths return non-empty real results when the provider succeeds.
- [ ] Compare stable fields that should survive wrapping: URLs, titles, snippets/content, source/provider, and provider-specific raw fields where available.
- [ ] Record any intentional transformation or loss. Unexplained loss is a blocker.
- [ ] Record skipped paths only when a required key or SearXNG endpoint is unavailable.
- [ ] Do not treat missing credentials as success. Either provision the credential or get an explicit user waiver for that provider path.

Example requirement:

1. Run Firecrawl search through the Firecrawl-native path.
2. Run the same Firecrawl search through ColdSearch with Firecrawl selected.
3. Compare whether the response represents the same provider result set and whether ColdSearch preserves enough raw provider detail for later evaluation.

Gate 0 success looks like:

- A provider-path evidence table exists in the PR notes or a committed evidence file.
- Every implemented provider path is `pass`, `fail`, or `waived-by-user`; none are silently skipped.
- Failures are fixed or explicitly moved into PR 1 scope before PR 1 starts.
- The evidence proves current wrappers are not useless normalization shells.

## Non-Negotiable PR Review Pause

After each implementation PR:

- [ ] Open the PR only after the scoped implementation is complete.
- [ ] Run the required validation from that PR plan before opening the PR.
- [ ] Wait for GitHub checks to complete.
- [ ] Read required checks and advisory checks before characterizing failures.
- [ ] Read all review surfaces: inline review threads, flat PR comments, bot comments, and CI summaries.
- [ ] Address valid findings with follow-up commits.
- [ ] Re-run the validation that proves the changed behavior after follow-up commits. Include `npm test` for runtime/code changes and `npm run test:docs` for docs, provider matrix, registry, or plan-validator changes.
- [ ] Wait again for checks and reviews after every push.
- [ ] Do not start the next PR until the current PR is merged, or until the user explicitly authorizes parallel work.
- [ ] Do not post the merge attestation until it is true:

```text
I have read all checks and review comments on this PR and affirm I have addressed all valid findings.
```

This pause is part of the plan. Skipping it is a plan failure.

## Sequence

### Completed: Gate 0 and PR 1

- [x] Provider-tool profile registry and generic call substrate merged to `main`.
- [x] `tool list`, `tool info`, and `tool call` are implemented.
- [x] Raw provider payload and safe provider-tool usage logging are implemented.
- [x] Offline provider-tool and drift tests are present.

Success looks like:

- The master plan no longer describes the core provider-tool surface as missing.
- Gate 0 remains the detailed initial conformance method and evidence baseline.
- Ongoing conformance is scoped and scheduled rather than routine PR validation.

### Completed PR 1: Provider Tool Surface

Plan: [2026-06-22-pr1-provider-tool-surface.md](./2026-06-22-pr1-provider-tool-surface.md)

Success looks like:

- `coldsearch tool list` exists.
- `coldsearch tool call <provider>.<tool>` exists.
- Broadly useful tools from each configured provider are reachable through ColdSearch.
- Niche or high-risk tools are explicitly deferred in docs.
- Provider-tool calls preserve raw provider payloads.
- Provider-tool calls produce safe usage/audit logs.
- Provider-tool docs and registry stay in sync under a docs/registry drift check.
- Offline tests prove the provider-tool registry, CLI parser, raw payload preservation, and safe usage logging.
- Provider-native comparison evidence proves every in-scope tool actually reaches the real provider path.

Status: completed on `main`. The plan remains as historical implementation context; code and issues govern any remaining individual provider-tool wiring.

### Between PR 1 and PR 2

- [ ] Update local `main` from `origin/main`.
- [ ] Confirm PR 1 changes are present on `main`.
- [ ] Create a fresh branch for PR 2.
- [ ] Run `npm test` because PR 2 starts from runtime behavior changed by PR 1.
- [ ] Run `npm run test:docs` because PR 2 relies on current provider/tool documentation and config docs.

Success looks like:

- Research-memory work starts on top of the finalized provider-tool surface.
- The relevant offline and docs/registry checks are green before execution-history implementation begins.

### PR 2: Search History and Research Memory

Plan: [2026-06-22-pr2-cache-a2.md](./2026-06-22-pr2-cache-a2.md)

Success looks like:

- Every meaningful normalized/provider-tool execution has a useful execution record.
- `coldsearch history recent`, `search`, and `show` work offline.
- Raw and normalized results, failures, URLs/artifacts, routing, timing, safe key references, and run/agent context are inspectable.
- Fanout retains per-provider partitions and the merged view.
- Related prior work and intentional reuse expose provenance and age.
- History writes are atomic and use restrictive permissions where supported.
- `cache clear`, freshness controls, and crawl replay policy remain supporting cache work.
- Offline tests prove record convergence, retrieval, comparison, provenance, redaction, and persistence.
- No history validation initiates paid provider comparisons or benchmark workloads.

Review pause:

- [ ] Open PR 2.
- [ ] Wait for review and checks.
- [ ] Address all valid findings.
- [ ] Merge PR 2 before starting PR 3 unless the user explicitly authorizes parallel work.

### Between PR 2 and PR 3

- [ ] Update local `main` from `origin/main`.
- [ ] Confirm PR 2 changes are present on `main`.
- [ ] Create a fresh branch for PR 3.
- [ ] Run `npm test` because PR 3 starts from runtime behavior changed by PR 2.
- [ ] Run `npm run test:docs` if PR 2 changed operator-facing docs or provider/tool registry docs.

Success looks like:

- Batch work starts on top of merged provider-tool and cache behavior.
- The relevant offline and docs/registry checks are green before batch implementation begins.

### PR 3: Batch Runner for Search, Extract, Crawl, and Provider Tools

Plan: [2026-06-22-pr3-batch-runner.md](./2026-06-22-pr3-batch-runner.md)

Success looks like:

- `coldsearch batch` exists.
- Batch input is JSONL.
- Batch output is JSONL.
- `search`, `extract`, `crawl`, and provider-tool records are supported.
- Stable `id` resumability works.
- Controlled concurrency works.
- Duplicate handling is deterministic.
- Per-item success/error output is present.
- Existing exact cache and execution history are used for batch `search`, `extract`, and eligible provider-tool records.
- Offline tests prove JSONL validation, resumability, duplicate handling, concurrency, mixed record execution, and cache reuse.
- Docs/config checks prove batch documentation matches the implemented flags.

Review pause:

- [ ] Open PR 3.
- [ ] Wait for review and checks.
- [ ] Address all valid findings.
- [ ] Merge PR 3 before starting PR 4 unless the user explicitly authorizes parallel work.

### Between PR 3 and PR 4

- [ ] Update local `main` from `origin/main`.
- [ ] Confirm PR 3 changes are present on `main`.
- [ ] Create a fresh branch for PR 4.
- [ ] Run `npm test` because PR 4 starts from runtime behavior changed by PR 3.
- [ ] Run `npm run test:docs` if PR 3 changed operator-facing docs or provider/tool registry docs.

Success looks like:

- Config/status UX work starts on top of the final command surface from PR 1, PR 2, and PR 3.
- The relevant offline and docs/registry checks are green before operator UX implementation begins.

### PR 4: Operator Config and Status UX

Plan: [2026-06-22-pr4-config-status-ux.md](./2026-06-22-pr4-config-status-ux.md)

Success looks like:

- Issue #6 is resolved.
- `coldsearch config init` exists.
- `coldsearch config doctor` exists.
- Status reports config path, cache state/path, usage path, provider coverage, provider-tool coverage, and missing env vars.
- Agent LLM base URL can be configured in TOML.
- CLI flags override TOML.
- Error output is classified enough for users to distinguish config, credential, reachability, provider, unsupported-capability, and unsupported-tool failures.
- Raw secrets are never printed.
- Offline tests prove config init, config doctor, status output, LLM endpoint precedence, and error classification.
- Docs/config checks prove setup and diagnostics documentation matches the implemented commands.

Review pause:

- [ ] Open PR 4.
- [ ] Wait for review and checks.
- [ ] Address all valid findings.
- [ ] Merge PR 4 before starting PR 5 unless the user explicitly authorizes parallel work.

### Between PR 4 and PR 5

- [ ] Update local `main` from `origin/main`.
- [ ] Confirm PR 4 changes are present on `main`.
- [ ] Create a fresh branch for PR 5.
- [ ] Run `npm test` because PR 5 starts from runtime behavior changed by PR 4.
- [ ] Run `npm run test:docs` if PR 4 changed operator-facing docs or provider/tool registry docs.

Success looks like:

- Run ID work starts after config and status output contracts are settled.
- The relevant offline and docs/registry checks are green before traceability implementation begins.

### PR 5: Agent Run IDs and Trace Correlation

Plan: [2026-06-22-pr5-agent-run-ids.md](./2026-06-22-pr5-agent-run-ids.md)

Success looks like:

- Issue #14 is resolved.
- Every agent run has a generated run ID.
- `--run-id` allows explicit run IDs.
- Agent JSON output includes `run_id`.
- Agent steps include `run_id`.
- Usage log entries created by agent-triggered searches include `run_id`.
- Provider-tool usage logs can carry `run_id` when called from an agent or future orchestrated run.
- Non-agent usage logs remain valid without `run_id`.
- Offline tests prove generated and explicit run IDs flow through agent output, steps, and usage logs.
- Docs checks are required only if this PR changes operator-facing docs.

Review pause:

- [ ] Open PR 5.
- [ ] Wait for review and checks.
- [ ] Address all valid findings.
- [ ] Merge PR 5.

### After PR 5

- [ ] Update local `main` from `origin/main`.
- [ ] Run `npm test` as the final offline regression check.
- [ ] Run `npm run test:docs` as the final docs/registry consistency check.
- [ ] Check open GitHub issues and close or update #6, #14, #31 as appropriate.
- [ ] Epic 5 stays deferred until you choose to start it; see [2026-06-22-epic-5-remote-agentic-execution.md](./2026-06-22-epic-5-remote-agentic-execution.md).

Success looks like:

- The five-PR implementation sequence is complete.
- Broadly useful tools from configured providers are usable through ColdSearch.
- The active backlog no longer lists the completed provider-tool foundation, search history, batch, config bootstrap/status UX, or run IDs as missing.
- Deferred epics remain explicitly deferred, not accidentally forgotten.

## Validation Adequacy Rule

Validation is evidence, not ceremony. A command belongs in a PR plan only when the plan states what contract it proves.

Use this rule at every PR boundary:

- Run `npm test` for runtime, CLI, adapter, cache, batch, agent, logging, or config changes. It proves the built project and offline test contracts still hold.
- Run `npm run test:docs` for provider matrix, registry, config docs, architecture docs, or plan-validator changes. It proves documented surfaces and code registries have not drifted.
- Run scoped provider-native conformance only for provider-facing paths touched by the PR. Use the full matrix only for the deliberate baseline, a shared-transport change affecting every path, or an explicit user request.
- Run targeted CLI checks when the PR creates or changes a user-facing command. These checks must use temp configs/files and assert parseable useful output.
- Do not use `scripts/smoke.mjs` as proof of a provider-tool or Gate 0 contract. It is only a live canary because it can skip missing credentials and does not compare native output to ColdSearch output.

A PR is not ready for review until:

- Its new behavior has focused tests that can fail for a real implementation bug.
- Existing behavior affected by the change remains covered.
- Its new request/cache/provider/agent flow writes enough safe logs to reconstruct what happened.
- Any scoped live conformance required by a provider-facing change has explicit pass/fail/blocked/waived rows.
- Documentation and provider/tool matrix drift checks run only when they prove something changed in docs or registry.
- Manual review evidence is recorded when automation cannot prove the contract.

Provider-effectiveness evaluation is observational, not a release gate. Do not run benchmark workloads or paid multi-provider comparisons as routine validation; inspect accumulated execution history unless the task explicitly concerns provider selection, routing quality, or search effectiveness.

## Deferred Epics

### Epic 5: Remote agentic execution (deferred)

**Plan:** [2026-06-22-epic-5-remote-agentic-execution.md](./2026-06-22-epic-5-remote-agentic-execution.md)

Remote execution for long-running agentic research and large batch workloads — CLI submits runs, workers execute, results polled or streamed. **Not part of PR1–PR5.** Deferred for now.

June 2026 review considered packaged orchestration (Hatchet, Inngest, Trigger.dev), agent harnesses (AI SDK, Mastra, OpenAI Agents SDK, LangGraph; Hermes/Agno as alternate shapes), and Redis for cross-worker cache/rate limits — **no stack chosen yet.** ColdSearch core (adapters, fanout, config routing, `ExecutionBackend` seam) stays regardless.

### Other deferred (not numbered epics)

- Cross-process key coordination (often folds into Epic 5 + Redis)
- Niche provider verticals and high-risk provider tools explicitly deferred by the PR 1 plan

Epic 5 and other deferred work start only when you decide to — update the plan, then build.
