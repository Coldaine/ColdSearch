---
title: Progress
date: 2026-05-19
author: Patrick MacLyman
status: living
---

# Progress

## Current State

ColdSearch now has:

- multi-provider capability routing with fanout and single-provider modes
- RRF (Reciprocal Rank Fusion) reranking across provider results
- ReAct-style search agent with tool-based fetch/search/refine loop
- multi-layer SSRF protection in agent fetch (DNS, IP, hostname blocking)
- BWS (Bitwarden Secrets Manager) integration for provider keys
- LLM provider aliases: anthropic, openai, groq, openrouter, cerebras, xai
- LLM base URL override for custom endpoints
- provider docs and a capability matrix
- SearXNG planning and adapter support
- local execution backend as the only implemented backend
- shared request handling for adapter and LLM calls
- structured agent tool payloads instead of regex parsing
- JSONL usage logging with 7-day summary in `status` command
- dry-run mode for execution plan preview

## What Is Working

### Runtime

- provider registry and capability validation
- random and round-robin provider-pool routing
- keyless-provider support
- retry/timeout-aware request layer
- shared local execution backend seam
- fanout search with per-provider error isolation
- extract (single-provider) with fallback
- crawl (single-provider) with fallback

### Agent Mode

- ReAct loop: search → fetch → refine → repeat → synthesize
- structured JSON tool payloads (no regex parsing)
- research context tracker with source dedup and step logging
- max-steps guardrail with forced final-synthesis fallback
- retry on malformed LLM responses with format guidance

### Provider Coverage

- `search`: SearXNG, Tavily, Exa, Brave, Serper
- `extract`: Tavily, Exa, Jina, Firecrawl
- `crawl`: Tavily, Firecrawl, Exa

### LLM Provider Support

- anthropic (Claude)
- openai (GPT-4o, etc.)
- groq (Llama, Mixtral via OpenAI-compatible API)
- openrouter (any model via OpenAI-compatible API)
- cerebras (Llama via OpenAI-compatible API)
- xai (Grok via OpenAI-compatible API)
- custom endpoints via `--llm-base-url`

### Docs

- provider detail pages under `docs/providers/`
- required capability matrix in `docs/CAPABILITY_MATRIX.md`
- provider adoption plans under `docs/plans/`
- ADRs for key architectural decisions
- developer guide for adding providers

## What Is Intentionally Deferred

- remote execution backend
- async job model for agent-mode work
- centralized remote secrets management
- broader provider tool-surface exposure in the CLI
- quota-aware rotation
- agent mode streaming responses

## Next Implementation Priorities

1. Tests for agent mode (ReAct loop, tool execution, synthesis)
2. Streaming agent responses (SSE)
3. Quota-aware provider selection
4. Remote/hybrid execution design docs before code
5. Governance and CI for provider/doc drift
