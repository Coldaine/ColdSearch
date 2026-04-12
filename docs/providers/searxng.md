# SearXNG Provider

**Website:** https://docs.searxng.org  
**Type:** Self-hosted metasearch engine  
**ColdSearch status:** Partial

## Overview

SearXNG is a privacy-oriented metasearch engine that aggregates results from multiple upstream engines. In ColdSearch it is treated as an operator-managed search backend rather than a vendor API with hosted credentials.

## Official Surface

ColdSearch currently documents SearXNG at the capability level:

- web search
- engine aggregation / metasearch
- self-hosted deployment and endpoint control

ColdSearch does not currently expose broader SearXNG customization features as first-class CLI concepts.

## Current ColdSearch Support

| Capability | Status | Notes |
|------------|--------|-------|
| `search` | ✅ | Supported via configured `baseUrl` |
| `extract` | ❌ | Not implemented |
| `crawl` | ❌ | Not implemented |

## Configuration

```toml
[providers.searxng]
[providers.searxng.keyPool]
keys = []

[providers.searxng.options]
baseUrl = "https://search.example.internal"
```

You can also provide `SEARXNG_BASE_URL` in the environment.

## Deployment Notes

- ColdSearch does not assume SearXNG runs on `localhost`.
- This repo may contain optional infrastructure assets for standing up SearXNG elsewhere.
- Local container execution is not the default workflow for `icarus-laptop`.

## Why It Matters

SearXNG gives ColdSearch a self-hosted search option that can later fit a hybrid remote execution model where search infrastructure and secrets live centrally.
