# Session Record — Roadmap + CI Review (2026-05-27)

> **For record-keeping only.** This is a captured working session, not a spec or
> a decision of record. Nothing here is binding; it exists so the reasoning isn't
> lost. Promote anything worth keeping into `docs/PROGRESS.md`, an ADR, or a
> GitHub issue, then this file can be deleted.

## What we set out to do

Assess where ColdSearch stands — branches, PRs, open issues — and decide whether
the path forward is clear. The conversation expanded into a strategic review of
how the tool should serve real agent workloads, and then a deep look at what CI
actually verifies.

## State of the repo (at session start)

- Working branch `claude/subagent-coordination-path-EFmNL`, clean, level with `main`.
- **No open PRs.**
- Stale remote branches: `master` (behind main), 12× `session/agent_*`, plus two
  unmerged feature branches (`feat/unified-coldsearch`, `docs/bugs-and-documentation`).
- 8 open issues: implementation (#6 config UX, #7 CI/tests), docs (#10–#13),
  small (#14 run IDs), long-term (#8 GitHub-as-corpus).

## Strategic findings

Two reviewer agents independently confirmed: ColdSearch's structural positioning
is right. The meaningful gaps are **operational**, not architectural.

- **Gap A — no result cache.** Single tenant ⇒ no privacy concern ⇒ caching is a
  pure win. Highest ROI item. Extract results especially (slow, expensive, stable URLs).
- **Gap B — cross-process key coordination.** Decided **skip**: single tenant,
  keys set once, no real rotation problem to solve.
- **Gap C — no batch mode.** Enrichment workloads (N queries) need a first-class
  `coldsearch batch` reading JSONL with dedup + resumability. Depends on cache.

### Five reference scenarios (how the tool handles them)

1. Quick fact lookup — fanout overspends credits; cache + cheap-mode fixes it.
2. Deep research (`--agent`) — no memo of results across runs; cache extract.
3. Multi-step investigation — process-per-query cold-start dominates; batch fixes it.
4. Concurrent agent sessions — per-process key pools hot-spot key #1; deprioritized
   (single tenant).
5. Batch enrichment — unsupported today; needs `coldsearch batch`.

### Decisions made

| Decision | Choice |
|----------|--------|
| Cache default | Opt-out (on by default) |
| Cross-process key coordination | Skip entirely |
| Cache storage | **Open** — SQLite vs file-based JSON (see next-PR plan) |
| Session scope | Docs + record + safe CI improvement; cache deferred to next PR |

### Two reviewer "bugs" — both false positives

- `--llm anthropic` "bug": not a bug. The CLI lists supported providers
  (`openai|groq|openrouter|cerebras|xai`) and rejects others with a clear error.
  Verified by `test/agent-llm.test.mjs`.
- `ClaudeClient` reference in `architecture.md`: does not exist in the file.

## CI / testing review

Walked the full pipeline and every test file. Findings:

- **One workflow** (`.github/workflows/ci.yml`), one job, 5 steps: checkout →
  setup-node 20 → `npm ci` → `typecheck` → `test:docs` → `test`.
- **Every test is offline.** A global `fetch` mock returns hand-written responses;
  no API keys in CI; CLI integration tests use a local `http` server or an
  unreachable port. ~37 tests across 20 files.
- The doc-sync tests are **drift detection, not generation** — docs and code are
  both hand-written; the tests parse the markdown tables and `assert.deepEqual`
  them against the code registry.
- **Consequence:** the suite cannot catch a provider changing its real API shape.
  It verifies our transformation logic against frozen fixtures.

### Spectrum of "make tests alive" approaches discussed

1. Offline mocks only (current) — fast, free, blind to provider drift.
2. Recorded/replayed HTTP (nock/msw/polly) — real fixtures, periodic re-record.
3. Path-filtered CI — run heavy jobs only when relevant paths change (note:
   required-check footgun with `paths:`).
4. Tiered jobs — unit (every PR) / integration (merge, secrets) / e2e (schedule).
5. Scheduled canary/smoke — nightly real calls, alert on drift.
6. Live contract/schema tests on a schedule.

**Conclusion:** for a single-tenant daily-use CLI, a scheduled canary with real
keys is the highest-value, lowest-effort protection. Jina is keyless, so a canary
can exercise the full stack (config → adapter → real HTTP → normalize → JSON)
with zero secrets.

## What landed this session (PR #20)

- Doc refresh: `CLAUDE.md`, `SKILL.md`, `docs/PROGRESS.md` (closes #12, #13).
- This session record.
- Next-PR plan: `docs/plans/next-pr-cache-layer.md`.
- Canary smoke workflow (`.github/workflows/canary.yml`) + `scripts/smoke.mjs`
  — implements approach #5; always runs keyless Jina, adds keyed providers when
  secrets are present.

## Not executed (carried forward)

- Cache layer (needs storage decision) — see next-PR plan.
- Batch mode (depends on cache).
- Branch cleanup (delete `master`, `session/agent_*`; triage two feature branches).
- Issues #6, #7, #10, #11, #14.
