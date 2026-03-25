---
title: Architecture
date: 2026-03-24
author: Patrick MacLyman
status: draft
doc_type: architecture
---

# Architecture

## Three Commands, One System

The CLI exposes three capabilities as top-level commands:

| Command | Description | Providers | Selection |
|---------|-------------|-----------|-----------|
| `search` | Search the web | Tavily, Exa, Brave, Serper | Random pick |
| `extract` | Extract content from URL | Tavily, Exa, Jina | Random pick |
| `crawl` | Crawl website | Tavily, Firecrawl | Random pick |

Plus **Mode 2: Search Agent** for multi-step research (`--agent` flag).

## Capability-Based Architecture

### The Core Idea

Instead of thinking "which provider should I use?", think "what do I want to do?"

```
┌─────────────────────────────────────────────────────────────┐
│                      Capability Layer                        │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐                     │
│  │ search  │  │ extract  │  │  crawl  │                     │
│  └────┬────┘  └────┬─────┘  └────┬────┘                     │
└───────┼────────────┼────────────┼───────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Provider Selection                        │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐            │
│  │Tavily  │  │ Exa    │  │ Brave  │  │ Serper │  ...       │
│  └────────┘  └────────┘  └────────┘  └────────┘            │
│                    ↓ Random pick                             │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                     Key Selection                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ Key 1      │  │ Key 2      │  │ Key 3      │             │
│  └────────────┘  └────────────┘  └────────────┘             │
│                    ↓ Random pick                             │
└─────────────────────────────────────────────────────────────┘
```

### Config-Driven Provider Mapping

```toml
[capabilities.search]
providers = ["tavily", "exa", "brave", "serper"]
strategy = "random"  # "all" = fanout, "random" = single provider

[providers.tavily.keyPool]
keys = ["env:TAVILY_KEY_1", "env:TAVILY_KEY_2"]
strategy = "random"  # "round-robin" or "random"
```

### Two-Level Random Selection

**Level 1: Provider Selection**
- Config defines which providers back each capability
- `strategy = "random"` → Pick one random provider
- `strategy = "all"` → Fan out to all providers (search only)

**Level 2: Key Selection**
- Each provider has a key pool
- `strategy = "random"` → Pick random key per request
- `strategy = "round-robin"` → Cycle through keys

## Key Abstractions

**Capability.** An abstract operation (`search`, `extract`, `crawl`). Capabilities map to one or more providers. The CLI exposes capabilities, not providers.

**Adapter.** A module per provider. Declares which capabilities it supports. Implements capability methods with provider-specific logic. Normalizes all responses to shared schemas.

**Key Pool.** A set of API keys for a single provider. Supports random or round-robin selection strategies.

**Config.** Maps capabilities → providers → key pools. Human-editable TOML. The sole authority on routing decisions.

**Result Schemas.** Normalized output shapes regardless of provider:
- `NormalizedResult[]` for search
- `ExtractResult` for extract
- `CrawlResult[]` for crawl

## Adapter Capabilities Matrix

| Provider | Search | Extract | Crawl | Notes |
|----------|--------|---------|-------|-------|
| Tavily | ✅ | ✅ | ✅ | Best all-rounder |
| Exa | ✅ | ✅ | ❌ | Neural search, good extract |
| Brave | ✅ | ❌ | ❌ | Privacy-focused |
| Serper | ✅ | ❌ | ❌ | Google Search results |
| Jina | ❌ | ✅ | ❌ | Free, no API key |
| Firecrawl | ❌ | ✅ | ✅ | Best crawl quality |

## Provider Selection Flow

```
Request: usearch extract "https://example.com"
                │
                ▼
    Look up "extract" capability
                │
                ▼
    Get providers: [tavily, exa, jina]
    Strategy: "random"
                │
                ▼
    Pick random: "jina"
                │
                ▼
    Get Jina key pool: [] (no keys needed)
                │
                ▼
    Call JinaAdapter.extract(url, "")
                │
                ▼
    Return normalized ExtractResult
```

## Fallback Behavior

When a provider fails:
1. Log the error
2. Try next provider in list (if not using random strategy)
3. Return first successful result
4. If all fail, throw aggregate error

## Anti-Patterns

1. **Model picks the provider.** MCP exposes `tavily_search`, `brave_search` as separate tools. The model picks. This project inverts that control: humans configure, system executes.

2. **Config drift into code.** Adding providers, changing capabilities, or adjusting weights must never require code changes.

3. **Hardcoded provider logic.** No provider-specific code outside adapters.

## Security

See `docs/KEY_MANAGEMENT.md` for:
- Key storage practices
- Environment variable configuration
- Security considerations
- Usage tracking (planned)

## Decisions

| Decision | Status | Rationale |
|----------|--------|-----------|
| CLI, not MCP server | **Decided** | Inverts control: human configures, system executes |
| Config-driven provider mapping | **Decided** | Provider landscape changes faster than code |
| One adapter per provider | **Decided** | Isolation, single-file changes |
| Capability taxonomy | **Decided** | `search`, `extract`, `crawl` cover 90% of use cases |
| Random provider selection | **Decided** | Load distribution, redundancy |
| Random key selection | **Decided** | Simple load balancing |
| TypeScript | **Decided** | Best SDK coverage, npm distribution |
| TOML config | **Decided** | Human-editable, comments, clear nesting |
| Quota-aware rotation | **Deferred** | Complex, provider APIs don't expose quotas |
