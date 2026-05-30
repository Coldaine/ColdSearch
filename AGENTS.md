# ColdSearch — AGENTS.md

ColdSearch is a unified CLI over overlapping search provider APIs. Fanout search, extract, crawl, and a ReAct agent mode. One command surface, multiple providers, consistent output schemas.

## Project identity

- **Why it exists:** Providers expose overlapping tools but different APIs. ColdSearch inverts control — humans define intent and policy in config, the runtime handles execution.
- **Shape:** A CLI named `coldsearch` (`usearch` kept as compatibility alias). Config at `~/.config/coldsearch/config.toml`.

## Where to read

**Direction & architecture:**
- `docs/NORTH_STAR.md` — why this exists, what it is and isn't, pillar principles
- `docs/architecture.md` — layers, request lifecycle, provider model, agent mode design
- `docs/PROGRESS.md` — current state, what's working, what's deferred

**Design decisions (ADRs):**
- `docs/ADRs/001-fanout-architecture.md` — why fanout with per-provider error isolation
- `docs/ADRs/002-rrf-reranking.md` — why Reciprocal Rank Fusion over score-based ranking
- `docs/ADRs/003-react-agent.md` — why ReAct loop with tool-based fetch/search/refine
- `docs/ADRs/004-ssrf-protection.md` — SSRF protection in agent fetch (protocol/hostname/IP checks, DNS validation, address pinning); implemented in `src/agent/agent.ts`

**Operations:**
- `docs/CONFIGURATION.md` — config file reference, key pools, environment variable binding
- `docs/KEY_MANAGEMENT.md` — BWS integration, key rotation, secret resolution
- `docs/PROVIDERS.md` — capability + tool matrix and per-provider coverage (single source of truth)
- `docs/BWS_INTEGRATION.md` — Bitwarden Secrets Manager resolver details

**Contributing:**
- `docs/DEVELOPER.md` — how to add a new provider, adapter contract, testing expectations
- `docs/contributing/ci.md` — CI pipeline + **how to read a red check** (incl. the SonarCloud public API); read before dismissing any failed check

## Conventions

- Config changes never require a code change or rebuild.
- Provider names never appear in the agent-facing interface.
- Every adapter normalizes to the shared result schema before returning.
- New providers require: adapter + a Dual Matrix row in docs/PROVIDERS.md + tests.
- A red check is a question, not a fact — read the reason (`docs/contributing/ci.md`) before characterizing or overriding it.

## Merge protocol (agents)

`main` requires PRs — no direct push, no admin/agent bypass. Beyond `ci`, the **`merge-gate`** check (rolling out — advisory now, required once verified) gates merge on **both**: (1) ~15 min since the head was **pushed** (cooldown; resets on each push, so reviewers can post), and (2) you, as the PR opener, post a **new** PR comment (editing an older one won't count) containing exactly, on its own line:

> I have read all checks and review comments on this PR and affirm I have addressed all valid findings.

If `merge-gate` is red, **read its summary** — it states the remaining cooldown and the phrase. CodeRabbit and other bots are advisory. Full detail: `docs/contributing/ci.md` → "Merge protocol".

## Build

```bash
npm install && npm run build
```
