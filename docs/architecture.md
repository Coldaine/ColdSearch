---
title: Architecture
date: 2026-03-16
author: Patrick MacLyman
status: draft
doc_type: architecture
---

# Architecture

## Two Modes, One System

The CLI exposes two entry points:

**Mode 1: Fanout + Rerank.** A capability is invoked (e.g. `basic_search`). The layer looks up which providers are mapped to that capability in config, fans out to them in parallel using pooled keys, normalizes all results to the shared schema, runs a reranker, and returns the top N.

**Mode 2: Search Agent.** The caller passes a goal or question, not a query string. An internal search agent has direct access to all provider tools and orchestrates multi-step strategies: search, read a result, refine, search again, synthesize. Returns a researched answer with sources.

Both modes share: provider adapters, key pools, config, and the normalized result schema.

## Key Abstractions

**Capability.** An abstract search function ("basic_search", "extract", "deep_research"). The taxonomy is TBD; see Tricky Parts. Capabilities are the only thing the calling agent sees.

**Adapter.** A module per provider. Declares which capabilities it supports. Accepts a query, calls the provider API, normalizes the response to the shared schema. One adapter per provider; nothing else touches provider-specific logic.

**Key Pool.** A set of API keys for a single provider. The layer picks a key per request based on rotation strategy (TBD; round-robin as starting point, quota-aware as a goal).

**Config.** Maps capabilities → providers → key pools. Human-editable. The sole authority on which providers back which capabilities.

**Result Schema.** The normalized shape every adapter outputs and every downstream consumer (reranker, search agent, caller) depends on. TBD; must capture at minimum: title, URL, snippet, relevance signal, source provider (for internal debugging only, never exposed to caller).

## Anti-Patterns

Earned, not hypothetical.

1. **Model picks the provider.** The entire reason this project exists. MCP omnisearch exposes `tavily_search`, `brave_search`, `exa_search` as separate tools. The model picks whichever it wants. It has no basis for this decision and regularly burns through one provider's credits while others sit idle. If the design reintroduces model-driven provider selection at any layer, the project has failed.

2. **Config drift into code.** Adding a new API key, changing which providers back a capability, or adjusting rerank weights must never require editing source. If it does, the config layer is broken.

## Tricky Parts

These are the genuinely hard problems. Everything else is plumbing.

**Capability taxonomy.** What are the abstract capabilities? "basic_search" and "extract" are obvious. But where's the line between "deep_research" as a capability and Mode 2 as a whole mode? Too few capabilities and you lose provider-specific strengths. Too many and you've just renamed the providers. This is a design problem; we need to survey what the selected providers actually expose and find the natural equivalence classes. Deferred until we have adapters to look at.

**Reranking across heterogeneous results.** Brave, Tavily, and Exa return different metadata shapes and different relevance signals. Normalizing to the shared schema necessarily loses information. The reranker operates on the normalized shape, so normalization quality directly determines rerank quality. If the schema is too lossy, the reranker is picking at random. If the schema is too rich, it's not really normalized. The right balance is unknown until we have real results flowing through.

**Mode 2's autonomy boundary.** How much latitude does the search agent get? A hard-coded multi-step workflow is predictable but brittle. A full ReAct loop is flexible but expensive and slow. The answer depends on latency budget and model cost tolerance, both of which are personal preferences that may change over time. Should be configurable, not baked in.

**Key rotation under concurrent load.** Round-robin is trivial for sequential requests. Under parallel fanout, multiple requests hit the pool simultaneously. Need to avoid thundering herd on one key. Probably needs a lightweight lock or token-bucket approach per key. Not hard conceptually but easy to get wrong in practice.

## Decisions

Decisions are recorded here with rationale. Deferred decisions are marked as such.

| Decision | Status | Rationale |
|---|---|---|
| CLI, not MCP server | **Decided** | MCP exposes N tools; model picks. CLI + skill inverts control. |
| Config-driven provider mapping | **Decided** | Provider landscape changes faster than code release cycles. |
| One adapter per provider | **Decided** | Isolation. Adding/removing a provider is one-file change. |
| Language / runtime | **Decided: TypeScript** | Best SDK coverage across providers (Tavily, Firecrawl, Brave, Exa, Serper all JS-first or JS-available). npm global install for distribution. The work is HTTP orchestration and JSON wrangling; TS is native territory. |
| Config format (TOML/YAML/JSON) | **Decided: TOML** | Human-editable, supports comments, clear nesting for our config structure. |
| Reranker implementation | **Deferred** | Need real results flowing before choosing. |
| Capability taxonomy | **Deferred** | Need adapter survey first. |
| Key rotation strategy | **Deferred** | Round-robin first; quota-aware later. |
| Mode 2 model / architecture | **Deferred** | ReAct vs hard-coded workflow vs hybrid. |
| Result schema fields | **Deferred** | Need multiple adapters returning real data to find the right shape. |
