# Remaining Implementation Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each linked PR plan task-by-task. Do not collapse these PRs into one change unless the user explicitly changes the goal.

**Goal:** Finish the known remaining ColdSearch implementation work through four reviewable PRs, with a hard review pause after each PR.

**Architecture:** Keep `coldsearch` as the stable CLI. Add missing behavior behind the existing local seams: `LocalExecutionBackend`, `CacheStore`, `UsageLogger`, `FanoutEngine`, `SearchAgent`, and the config loader. Documentation changes travel with the implementation PR that changes the operator-facing surface.

**Tech Stack:** TypeScript, Node.js >=18, built-in `node:test`, TOML config via `@iarna/toml`, local JSONL/cache files under `~/.config/coldsearch/`.

---

## Answer: Yes, Four PRs Fit

Yes. The remaining concrete implementation work fits well into four PRs:

1. [PR 1: Searchable Cache, Cache Operations, and Cache Hygiene](./2026-06-22-pr1-cache-a2.md)
2. [PR 2: Batch Runner for Search, Extract, and Crawl](./2026-06-22-pr2-batch-runner.md)
3. [PR 3: Operator Config and Status UX](./2026-06-22-pr3-config-status-ux.md)
4. [PR 4: Agent Run IDs and Trace Correlation](./2026-06-22-pr4-agent-run-ids.md)

This split is natural because each PR has a different owner surface:

- PR 1 owns searchable recent-result memory, cache operations, cache logging, and persistence hygiene.
- PR 2 owns high-volume execution workflows.
- PR 3 owns operator setup, diagnostics, and status.
- PR 4 owns agent traceability.

Do not add remote execution, cross-process key coordination, or full vendor-specific vertical expansion to these four PRs. Epic 5 (remote agentic execution) is documented and deferred — see [2026-06-22-epic-5-remote-agentic-execution.md](./2026-06-22-epic-5-remote-agentic-execution.md).

## Current Baseline

Functional now:

- `coldsearch search`, `extract`, `crawl`, and `status`
- ReAct agent mode
- Provider routing and validation
- Usage JSONL logging
- Exact read-through cache for `search` and `extract`
- `--no-cache`
- Live provider canary workflow

Missing now:

- Searchable recent-result cache/memory
- `coldsearch cache search`
- `coldsearch cache recent`
- `coldsearch cache stats`
- `coldsearch cache clear`
- `--freshness`
- Cache lookup/search/hit/miss logs with selected prior item references
- Atomic cache writes and restrictive cache-file permissions
- `coldsearch batch`
- Batch resumability by stable `id`
- Batch controlled concurrency
- Batch duplicate handling
- Batch support for `search`, `extract`, and `crawl`
- Config bootstrap UX
- Better error classification
- Status enhancements
- Agent LLM base URL in TOML
- Structured agent run IDs
- Explicit crawl-cache policy

Baseline verification before this plan split:

```bash
npm test
```

Expected: pass.

## Non-Negotiable PR Review Pause

After each implementation PR:

- [ ] Open the PR only after the scoped implementation is complete.
- [ ] Run the required validation from that PR plan before opening the PR.
- [ ] Wait for GitHub checks to complete.
- [ ] Read required checks and advisory checks before characterizing failures.
- [ ] Read all review surfaces: inline review threads, flat PR comments, bot comments, and CI summaries.
- [ ] Address valid findings with follow-up commits.
- [ ] Re-run `npm test` and `npm run test:docs` after follow-up commits.
- [ ] Wait again for checks and reviews after every push.
- [ ] Do not start the next PR until the current PR is merged, or until the user explicitly authorizes parallel work.
- [ ] Do not post the merge attestation until it is true:

```text
I have read all checks and review comments on this PR and affirm I have addressed all valid findings.
```

This pause is part of the plan. Skipping it is a plan failure.

## Sequence

### Before PR 1

- [ ] Start from current `origin/main`, not the stale local branch.
- [ ] Create a feature branch for PR 1.
- [ ] Run `npm test`.
- [ ] Run `npm run test:docs`.

Success looks like:

- The branch starts clean from current `origin/main`.
- The existing suite passes before implementation begins.

### PR 1: Searchable Cache, Cache Operations, and Cache Hygiene

Plan: [2026-06-22-pr1-cache-a2.md](./2026-06-22-pr1-cache-a2.md)

Success looks like:

- `coldsearch cache stats` works.
- `coldsearch cache search` works and surfaces relevant recent prior items.
- `coldsearch cache recent` works and surfaces newest prior items.
- `coldsearch cache clear` works.
- `--freshness` works for cached `search` and `extract`.
- Cache lookup/search/hit/miss behavior is logged without secret values.
- Cache writes are atomic.
- Cache files/directories use restrictive permissions where supported.
- Crawl cache is explicitly decided and documented.
- `npm test` passes.
- `npm run test:docs` passes.

Review pause:

- [ ] Open PR 1.
- [ ] Wait for review and checks.
- [ ] Address all valid findings.
- [ ] Merge PR 1 before starting PR 2 unless the user explicitly authorizes parallel work.

### Between PR 1 and PR 2

- [ ] Update local `main` from `origin/main`.
- [ ] Confirm PR 1 changes are present on `main`.
- [ ] Create a fresh branch for PR 2.
- [ ] Run `npm test`.
- [ ] Run `npm run test:docs`.

Success looks like:

- Batch work starts on top of merged cache A2 behavior.
- The suite is green before batch implementation begins.

### PR 2: Batch Runner for Search, Extract, and Crawl

Plan: [2026-06-22-pr2-batch-runner.md](./2026-06-22-pr2-batch-runner.md)

Success looks like:

- `coldsearch batch` exists.
- Batch input is JSONL.
- Batch output is JSONL.
- `search`, `extract`, and `crawl` records are supported.
- Stable `id` resumability works.
- Controlled concurrency works.
- Duplicate handling is deterministic.
- Per-item success/error output is present.
- Existing exact cache and searchable recent-result memory are used for batch `search` and `extract`.
- `npm test` passes.
- `npm run test:docs` passes.

Review pause:

- [ ] Open PR 2.
- [ ] Wait for review and checks.
- [ ] Address all valid findings.
- [ ] Merge PR 2 before starting PR 3 unless the user explicitly authorizes parallel work.

### Between PR 2 and PR 3

- [ ] Update local `main` from `origin/main`.
- [ ] Confirm PR 2 changes are present on `main`.
- [ ] Create a fresh branch for PR 3.
- [ ] Run `npm test`.
- [ ] Run `npm run test:docs`.

Success looks like:

- Config/status UX work starts on top of the final command surface from PR 1 and PR 2.
- The suite is green before operator UX implementation begins.

### PR 3: Operator Config and Status UX

Plan: [2026-06-22-pr3-config-status-ux.md](./2026-06-22-pr3-config-status-ux.md)

Success looks like:

- Issue #6 is resolved.
- `coldsearch config init` exists.
- `coldsearch config doctor` exists.
- Status reports config path, cache state/path, usage path, provider coverage, and missing env vars.
- Agent LLM base URL can be configured in TOML.
- CLI flags override TOML.
- Error output is classified enough for users to distinguish config, credential, reachability, provider, and unsupported-capability failures.
- Raw secrets are never printed.
- `npm test` passes.
- `npm run test:docs` passes.

Review pause:

- [ ] Open PR 3.
- [ ] Wait for review and checks.
- [ ] Address all valid findings.
- [ ] Merge PR 3 before starting PR 4 unless the user explicitly authorizes parallel work.

### Between PR 3 and PR 4

- [ ] Update local `main` from `origin/main`.
- [ ] Confirm PR 3 changes are present on `main`.
- [ ] Create a fresh branch for PR 4.
- [ ] Run `npm test`.
- [ ] Run `npm run test:docs`.

Success looks like:

- Run ID work starts after config and status output contracts are settled.
- The suite is green before traceability implementation begins.

### PR 4: Agent Run IDs and Trace Correlation

Plan: [2026-06-22-pr4-agent-run-ids.md](./2026-06-22-pr4-agent-run-ids.md)

Success looks like:

- Issue #14 is resolved.
- Every agent run has a generated run ID.
- `--run-id` allows explicit run IDs.
- Agent JSON output includes `run_id`.
- Agent steps include `run_id`.
- Usage log entries created by agent-triggered searches include `run_id`.
- Non-agent usage logs remain valid without `run_id`.
- `npm test` passes.
- `npm run test:docs` passes.

Review pause:

- [ ] Open PR 4.
- [ ] Wait for review and checks.
- [ ] Address all valid findings.
- [ ] Merge PR 4.

### After PR 4

- [ ] Update local `main` from `origin/main`.
- [ ] Run `npm test`.
- [ ] Run `npm run test:docs`.
- [ ] Check open GitHub issues and close or update #6, #14, #31 as appropriate.
- [ ] Epic 5 stays deferred until you choose to start it; see [2026-06-22-epic-5-remote-agentic-execution.md](./2026-06-22-epic-5-remote-agentic-execution.md).

Success looks like:

- The four-PR implementation sequence is complete.
- The active backlog no longer lists cache A2, batch, config bootstrap/status UX, or run IDs as missing.
- Deferred epics remain explicitly deferred, not accidentally forgotten.

## Test Adequacy Rule

At every PR boundary, the agent must verify both:

```bash
npm test
npm run test:docs
```

Each PR plan also lists targeted CLI checks. A PR is not ready for review until:

- Its new behavior has focused tests.
- Existing behavior remains covered.
- Its new request/cache/provider/agent flow writes enough safe logs to reconstruct what happened.
- The full suite passes locally.
- Documentation and provider matrix drift tests pass.

## Deferred Epics

### Epic 5: Remote agentic execution (deferred)

**Plan:** [2026-06-22-epic-5-remote-agentic-execution.md](./2026-06-22-epic-5-remote-agentic-execution.md)

Remote execution for long-running agentic research and large batch workloads — CLI submits runs, workers execute, results polled or streamed. **Not part of PR1–PR4.** Deferred for now.

June 2026 review considered packaged orchestration (Hatchet, Inngest, Trigger.dev), agent harnesses (AI SDK, Mastra, OpenAI Agents SDK, LangGraph; Hermes/Agno as alternate shapes), and Redis for cross-worker cache/rate limits — **no stack chosen yet.** ColdSearch core (adapters, fanout, config routing, `ExecutionBackend` seam) stays regardless.

### Other deferred (not numbered epics)

- Cross-process key coordination (often folds into Epic 5 + Redis)
- Vendor-specific tool and vertical expansion

Epic 5 and other deferred work start only when you decide to — update the plan, then build.
