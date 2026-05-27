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

### Provider Coverage

- `search`: SearXNG, Tavily, Exa, Brave, Serper
- `extract`: Tavily, Exa, Jina, Firecrawl
- `crawl`: Tavily, Firecrawl, Exa

### Docs

- provider detail pages under `docs/providers/`
- required capability matrix in `docs/CAPABILITY_MATRIX.md`
- provider adoption plans under `docs/plans/`
- design records under `docs/ADRs/` (fanout, RRF, ReAct)

## What Is Intentionally Deferred

- remote execution backend
- async job model for agent-mode work
- centralized remote secrets management
- broader provider tool-surface exposure in the CLI
- quota-aware rotation
- cross-process key-pool coordination (single-tenant assumption removes the need)

## Next Implementation Priorities

The original backlog (config UX, CI, docs) is real but is maintenance. Two strategic gaps are higher leverage and not yet tracked as issues:

1. **Result cache (Gap A — highest ROI).** Read-through cache for `search` and `extract`. On by default; opt-out via `--no-cache` or `[cache] enabled = false`. Single-tenant operation means no privacy concerns. Storage: SQLite at `~/.config/coldsearch/cache.db`, one table per capability, TTL configurable per capability in TOML. Provider-agnostic cache key (`capability + query/url + normalized options`) so any provider can serve a hit. Phase A1 lands read-through + `--no-cache`; Phase A2 adds `cache stats`/`cache clear` and a `--freshness` flag.
2. **Batch mode (Gap C).** `coldsearch batch --input queries.jsonl --output results.jsonl --concurrency N` for enrichment workloads. Intra-batch dedup, cache hits short-circuit, resumable by `id` field. Search + extract only for the first cut; crawl deferred.

Then the existing backlog:

3. **#6 — config bootstrap UX.** Better error classification (config vs credentials vs reachability), `status` enhancements, agent-LLM base URL in TOML (currently env-only via `OPENAI_BASE_URL`). Folds in the new `[cache]` config keys from item 1.
4. **#7 — CI consolidation and agent LLM test coverage.** Adds tests for cache hit/miss + batch dedup/resume once those land.
5. **#14 — structured run IDs** for agent trace correlation. Small; can run alongside any of the above.
6. **#10 / #11 — DEVELOPER.md and ADR 004 (SSRF).** Lower urgency.
7. **#8 — GitHub-as-search-corpus.** Long-term, deferred.

Concurrency / shared state across processes is intentionally **not** on the priority list. ColdSearch is single-tenant on a single machine; per-process key pools and JSONL appends are adequate.

## Branch Hygiene

The remote has several branches that should be cleaned up: `master` (stale, behind main), 12 ephemeral `session/agent_*` branches from Claude Code experiments, and two unmerged feature branches (`feat/unified-coldsearch`, `docs/bugs-and-documentation`) that need a PR-or-drop decision.
