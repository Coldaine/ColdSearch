---
title: Architecture
date: 2026-04-12
author: Patrick MacLyman
status: living
doc_type: architecture
---

# Architecture

## Current Shape

ColdSearch is a CLI-first system with three normalized capabilities:

| Capability | Intent | Current providers |
|------------|--------|-------------------|
| `search` | find web results | SearXNG, Tavily, Exa, Brave, Serper |
| `extract` | retrieve page content | Tavily, Exa, Jina, Firecrawl |
| `crawl` | gather content across a site | Tavily, Firecrawl |

These are not the full provider surfaces. They are the normalized interface ColdSearch exposes today.

## Actual Source Model

The runtime is driven by provider overlap:

1. Vendors expose overlapping tool surfaces.
2. ColdSearch groups that overlap into normalized capabilities.
3. Config defines which providers back each capability.
4. Runtime selects from that configured pool.
5. Adapters normalize output into shared schemas.

`docs/CAPABILITY_MATRIX.md` is the required comparison document for this layer.

## Layers

### 1. Interface Layer

- `coldsearch` CLI is the current entrypoint.
- A future remote executor may expose the same core behind async jobs.
- The CLI should remain usable in both local and future hybrid modes.

### 2. Execution Backend Layer

- Local execution is the only implemented backend today.
- The backend boundary exists so remote execution can be added later.
- Agent mode is the most likely first consumer of remote async execution.

### 3. Shared Routing/Core Layer

- capability lookup
- provider-pool selection
- provider validation
- key/secret resolution
- retry/timeout policy
- normalization and reranking

This is the layer that must stay interface-agnostic.

### 4. Provider Adapter Layer

One adapter per provider. Adapters convert provider-specific APIs into normalized ColdSearch schemas and use the shared request policy.

### 5. Documentation and Registry Layer

- provider registry in code defines implemented capabilities and provider docs linkage
- provider docs explain vendor surface area
- capability matrix records both vendor surface and ColdSearch implementation status

## Routing Policy

Current routing is manual random pools by capability.

- operators configure which providers belong to a capability pool
- runtime picks randomly from that pool when configured for random selection
- runtime does not silently hop to another provider after choosing one in this phase

This keeps behavior explicit while still distributing load.

## Request Lifecycle

All networked operations should run through shared request handling with:

- explicit timeouts
- abort control
- bounded transient retries
- normalized error reporting

This applies to provider adapters and LLM calls.

## Future Hybrid Direction

The long-term target is not MCP. The long-term target is hybrid execution with the CLI still in front.

Future flow:

1. CLI submits a job.
2. Remote executor performs provider calls and small-agent orchestration.
3. CLI polls status or fetches the final result.

The point of that future mode is centralization:

- secrets live in one place
- async job handling becomes tractable
- retries and state live with the executor

## Non-Goals For This Phase

- no remote executor yet
- no container-based workflow on this laptop
- no provider-hopping fallback after selection
- no attempt to expose every vendor tool directly in the CLI
