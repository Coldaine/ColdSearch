---
title: Progress
date: 2026-04-12
author: Patrick MacLyman
status: living
---

# Progress

## Current State

ColdSearch now has:

- multi-provider capability routing
- provider docs and a capability matrix
- SearXNG planning and adapter support
- local execution backend as the only implemented backend
- shared request handling for adapter and LLM calls
- structured agent tool payloads instead of regex parsing

## What Is Working

### Runtime

- provider registry and capability validation
- random provider-pool routing
- keyless-provider support
- retry/timeout-aware request layer
- shared local execution backend seam

### Provider Coverage

- `search`: SearXNG, Tavily, Exa, Brave, Serper
- `extract`: Tavily, Exa, Jina, Firecrawl
- `crawl`: Tavily, Firecrawl, Exa

### Docs

- provider detail pages under `docs/providers/`
- required capability matrix in `docs/CAPABILITY_MATRIX.md`
- provider adoption plans under `docs/plans/`

## What Is Intentionally Deferred

- remote execution backend
- async job model for agent-mode work
- centralized remote secrets management
- broader provider tool-surface exposure in the CLI
- quota-aware rotation

## Next Implementation Priorities

1. Governance and CI
2. Tests for docs coverage and runtime seams
3. Further provider-doc normalization
4. Remote/hybrid execution design docs before code
