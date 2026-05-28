---
title: Progress
date: 2026-05-27
author: Patrick MacLyman
status: living
---

# Progress

## Current State

ColdSearch is a config-driven CLI fanning out across overlapping search providers and normalizing output. The structural positioning is solid — the remaining work is operational (caching, batching), not architectural.

Implemented today:

- multi-provider capability routing (search, extract, crawl)
- provider docs and a capability matrix
- SearXNG planning and adapter support
- local execution backend as the only implemented backend
- shared request handling for adapter and LLM calls
- structured agent tool payloads instead of regex parsing
- ReAct-style agent mode with SSRF protections
- OpenAI-compatible agent LLM dispatch (openai, groq, openrouter, cerebras, xai) with `--llm-base-url` override

## What Is Working

### Runtime

- provider registry and capability validation
- random and fanout provider-pool routing
- keyless-provider support (Jina, SearXNG)
- retry/timeout-aware request layer
- shared local execution backend seam
- usage logging (JSONL) with safe key references
- `status` command summarising config + 7-day usage rollup
- `--dry-run` execution planner across search/extract/crawl
- read-through result cache for `search`/`extract` (file-based JSON under `~/.config/coldsearch/cache/`, on by default, `--no-cache` opt-out)

### Provider Coverage

- `search`: SearXNG, Tavily, Exa, Brave, Serper
- `extract`: Tavily, Exa, Jina, Firecrawl
- `crawl`: Tavily, Firecrawl, Exa

### Docs

- provider capability + tool matrix and per-provider coverage in `docs/PROVIDERS.md`
- design records under `docs/ADRs/` (fanout, RRF, ReAct, SSRF)
- contributor guide in `docs/DEVELOPER.md`

### CI / testing

- single offline CI job (typecheck → docs-drift → unit suite, ~60 tests)
- live-provider canary (`scripts/smoke.mjs` + `.github/workflows/canary.yml`, cron + manual dispatch) that exercises the real provider APIs — catches drift the mocked suite cannot

## What Is Intentionally Deferred

- remote execution backend
- async job model for agent-mode work
- centralized remote secrets management
- broader provider tool-surface exposure in the CLI
- quota-aware rotation
- cross-process key-pool coordination (single-tenant assumption removes the need)

## Next Implementation Priorities

The result cache (Gap A) — previously the top item — **shipped** (PR #26): read-through cache for `search`/`extract`, file-based JSON at `~/.config/coldsearch/cache/`, on by default, provider-agnostic key, `--no-cache` opt-out (and explicit `--providers`/`--single-provider` bypass it). Remaining cache work is Phase A2: `cache stats` / `cache clear` subcommands, a `--freshness` flag, and optional atomic-write + restrictive-permission hardening.

1. **Batch mode (Gap C)** — now unblocked by the cache. `coldsearch batch --input queries.jsonl --output results.jsonl --concurrency N` for enrichment workloads: intra-batch dedup, cache hits short-circuit, resumable by `id`. Search + extract first; crawl deferred.
2. **#6 — config bootstrap UX.** Better error classification (config vs credentials vs reachability), `status` enhancements, agent-LLM base URL in TOML (currently env-only via `OPENAI_BASE_URL`). Folds in the new `[cache]` config keys.
3. **#14 — structured run IDs** for agent trace correlation. Small; standalone.
4. **#8 — GitHub-as-search-corpus.** Long-term, deferred.

Concurrency / shared state across processes is intentionally **not** prioritized. ColdSearch is single-tenant on a single machine; per-process key pools and JSONL appends are adequate.

## Recently shipped

- Result cache (Gap A, Phase A1) — PR #26.
- Agent default LLM models refreshed to current, verified live (groq `llama-3.3-70b-versatile`, cerebras `gpt-oss-120b`, xai `grok-3`) — the old defaults had been decommissioned.
- Provider docs consolidated into a single `docs/PROVIDERS.md`; stale SKILL.md and dated session logs removed.
- `DEVELOPER.md` + `ADR 004` (SSRF) added (closed #10/#11); CLAUDE.md/SKILL.md doc-accuracy fixes (closed #12/#13).
- Live-provider canary + expanded smoke coverage (search/extract/crawl/agent).
- Stale remote branches cleaned up (`master`, `session/agent_*`, unmerged feature branches).
