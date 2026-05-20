# Provider Documentation

This directory contains the per-provider reference pages for ColdSearch.

## Authority

- `../CAPABILITY_MATRIX.md` is the required maintenance matrix for capability-level comparison.
- `docs/providers/*.md` are the detailed provider pages for vendor surface area and ColdSearch implementation notes.

## Available Providers

| Provider | File | ColdSearch Status | Notes |
|----------|------|-------------------|-------|
| Tavily | [tavily.md](tavily.md) | complete | search, extract, crawl |
| Firecrawl | [firecrawl.md](firecrawl.md) | complete | search, extract, crawl |
| Exa | [exa.md](exa.md) | complete | search, extract, crawl |
| Brave | [brave.md](brave.md) | partial | search |
| Serper | [serper.md](serper.md) | partial | search |
| Jina | [jina.md](jina.md) | partial | extract |
| SearXNG | [searxng.md](searxng.md) | partial | search |

## Required Update Rule

When provider support changes, update all of the following together:

1. the adapter/registry entry
2. `../CAPABILITY_MATRIX.md`
3. the matching provider page in this directory
4. any relevant adoption plan in `../plans/`
