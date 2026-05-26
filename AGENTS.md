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
- Agent SSRF protection — implemented in `src/agent/agent.ts`; tracked in [issue #11](https://github.com/Coldaine/ColdSearch/issues/11) (ADR 004)

**Operations:**
- `docs/CONFIGURATION.md` — config file reference, key pools, environment variable binding
- `docs/KEY_MANAGEMENT.md` — BWS integration, key rotation, secret resolution
- `docs/CAPABILITY_MATRIX.md` — provider × capability grid
- `docs/BWS_INTEGRATION.md` — Bitwarden Secrets Manager resolver details

**Provider docs:**
- `docs/providers/README.md` — index
- `docs/providers/*.md` — per-provider detail (capabilities, API shape, rate limits, key format)

**Contributing:**
- `docs/DEVELOPER.md` — how to add a new provider, adapter contract, testing expectations

## Conventions

- Config changes never require a code change or rebuild.
- Provider names never appear in the agent-facing interface.
- Every adapter normalizes to the shared result schema before returning.
- New providers require: adapter + provider doc + capability matrix update + plan doc.

## Build

```bash
npm install && npm run build
```
