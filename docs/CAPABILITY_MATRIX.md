# Provider Capability Matrix

**Last Updated:** 2026-04-12  
**Status:** Required maintenance document  
**Rule:** Update this file whenever provider support, provider docs, or provider routing changes.

This matrix has two jobs:

1. record the documented vendor surface at a capability level
2. record what ColdSearch actually implements today

Use provider detail pages for full vendor tool inventories.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | supported |
| ⚠️ | partial or constrained |
| ❌ | not supported |

## Current Normalized Capabilities

| Capability | Description |
|------------|-------------|
| `search` | general web search routed through a configured provider pool |
| `extract` | retrieve page content from a single URL |
| `crawl` | gather multi-page site content |

## Dual Matrix

| Provider | Vendor Search Surface | Vendor Extract Surface | Vendor Crawl / Discovery Surface | ColdSearch `search` | ColdSearch `extract` | ColdSearch `crawl` | Notes |
|----------|-----------------------|------------------------|----------------------------------|---------------------|----------------------|--------------------|-------|
| Tavily | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Broadest current all-rounder |
| Firecrawl | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Vendor surface is richer than current adapter support |
| Exa | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | Strong semantic and research features |
| Brave | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | Search-focused provider |
| Serper | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | Search-focused Google-backed surface |
| Jina | ⚠️ | ✅ | ⚠️ | ❌ | ✅ | ❌ | ColdSearch currently uses Reader-style extraction only |
| SearXNG | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | Self-hosted / endpoint-configured search provider |

## Provider Docs

Every provider in the registry must have a matching detail page:

- `docs/providers/tavily.md`
- `docs/providers/firecrawl.md`
- `docs/providers/exa.md`
- `docs/providers/brave.md`
- `docs/providers/serper.md`
- `docs/providers/jina.md`
- `docs/providers/searxng.md`

## Implementation Notes

- The matrix is authoritative for capability-level comparison.
- Provider pages are authoritative for vendor-specific tool inventories.
- New provider work must include:
  - a `docs/plans/<provider>.md` adoption plan
  - a provider detail page
  - an updated row in this matrix

## Backlog

- document finer-grained vendor sub-tools under a generated or semi-generated metadata layer
- make matrix drift checkable in CI
- expand implemented coverage where vendor surface materially exceeds adapter support
