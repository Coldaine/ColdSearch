---
title: Progress
date: 2026-03-24
author: Patrick MacLyman
status: living
---

# Progress

## Current Status

**Multi-Provider Capability Alignment + Random Provider/Key Selection.** ✅ Complete.

Implemented capability-based architecture with random provider and key selection:
- **6 Providers**: Tavily, Brave, Exa, Serper, Jina, Firecrawl
- **3 Capabilities**: `search`, `extract`, `crawl`
- **Random Selection**: Provider-level and key-level random rotation

## Phases

1. **Single-provider CLI.** ✅ Done.
2. **Multi-provider fanout.** ✅ Done. 
   - Multiple adapters (Tavily, Brave, Exa, Serper)
   - Parallel fanout with key pooling
   - Reranker with RRF strategy
   - Mode 1 works end to end
3. **Capability taxonomy.** ✅ **COMPLETE**.
   - `search` - Web search across 4 providers
   - `extract` - URL content extraction across 3 providers
   - `crawl` - Website crawling across 2 providers
   - Random provider selection per capability
   - Random key selection per provider
4. **Search agent.** ✅ Done.
   - ReAct-style agent with tool use
   - Multi-step research workflow
   - Source tracking and citation
   - LLM abstraction (Claude, OpenAI)
5. **Harden.** ⏸️ Not started. Quota-aware rotation, graceful degradation.

## What's Implemented

### Adapters (6 Total)

| Provider | Search | Extract | Crawl | Key Required |
|----------|--------|---------|-------|--------------|
| **Tavily** | ✅ | ✅ | ✅ | Yes |
| **Brave** | ✅ | ❌ | ❌ | Yes |
| **Exa** | ✅ | ✅ | ❌ | Yes |
| **Serper** | ✅ | ❌ | ❌ | Yes |
| **Jina** | ❌ | ✅ | ❌ | No (free) |
| **Firecrawl** | ❌ | ✅ | ✅ | Yes |

### Capability Mapping

```
search:  [tavily, exa, brave, serper]  → random pick
extract: [tavily, exa, jina]           → random pick
crawl:   [tavily, firecrawl]           → random pick
```

### Mode 1: Fanout + Rerank
- ✅ Parallel provider queries
- ✅ Thread-safe key pooling
- ✅ RRF reranking
- ✅ Score normalization reranking
- ✅ Deduplication by URL
- ✅ Graceful partial failure
- ✅ **NEW: Random provider selection** (`strategy = "random"`)
- ✅ **NEW: Per-capability provider mapping**

### Mode 2: Search Agent
- ✅ ReAct reasoning loop
- ✅ Tool registry (search, fetch, refine)
- ✅ Context management
- ✅ Source tracking
- ✅ LLM abstraction (Claude, OpenAI)
- ✅ HTML content extraction

### CLI Commands
- ✅ `usearch search "query"` - Search the web
- ✅ `usearch extract "url"` - Extract content from URL
- ✅ `usearch crawl "url"` - Crawl website
- ✅ Mode selection (`--agent`)
- ✅ Provider filtering (`--providers`)
- ✅ Single provider mode (`--single-provider`)
- ✅ Rerank strategy (`--rerank`)
- ✅ Agent configuration (`--llm`, `--model`, `--max-steps`)

### Key Management
- ✅ Random key rotation (`strategy = "random"`)
- ✅ Round-robin key rotation (`strategy = "round-robin"`)
- ✅ Multiple keys per provider
- ✅ Environment variable key references
- ⚠️ **NOT IMPLEMENTED**: Quota-aware rotation, usage tracking

## Architecture Decisions

### Capability-Based Design
Each capability maps to multiple providers. The system randomly selects one provider per request, enabling:
- **Load distribution** - Spread requests across providers
- **Redundancy** - Fallback if one provider fails
- **Cost optimization** - Use cheaper providers when possible

### Two-Level Random Selection
1. **Provider level**: `strategy = "random"` in capability config
2. **Key level**: `strategy = "random"` in provider keyPool config

This means a single request goes through two random selections:
1. Pick random provider from capability's provider list
2. Pick random key from provider's key pool

### Config-Driven Capabilities
```toml
[capabilities.search]
providers = ["tavily", "exa", "brave", "serper"]
strategy = "random"

[capabilities.extract]
providers = ["tavily", "exa", "jina"]
strategy = "random"

[capabilities.crawl]
providers = ["tavily", "firecrawl"]
strategy = "random"
```

## New Documentation

- `SKILL.md` - Updated with new commands and providers
- `config.example.toml` - Shows multi-provider capability configuration
- `docs/KEY_MANAGEMENT.md` - Security and usage tracking documentation
- `docs/PROGRESS.md` - This file

## Next Steps

**Phase 5: Harden**
- Quota-aware key rotation (pick key with most remaining quota)
- Usage tracking and persistence
- Rate limiting per key
- Pre-request quota checks
- `usearch status` command for key health
- Result caching
- Streaming responses

Do not start Phase 5 without discussion.

## Changelog (This Branch)

### Added
- **Jina Adapter** - URL-to-markdown extraction (no API key required)
- **Firecrawl Adapter** - Extract and crawl capabilities
- **Exa Extract** - Added `extract()` method to Exa adapter
- **Capability Configuration** - Per-capability provider mapping with strategies
- **Random Provider Selection** - `strategy = "random"` picks one random provider
- **URL Validation** - All adapters validate URLs before requests

### Changed
- **Adapter Interface** - Added optional `options` parameter to `crawl()`
- **Tavily Crawl** - Now respects `limit` option
- **Fanout Engine** - Updated to support capability-based provider selection

### Documentation
- Updated `SKILL.md` with new providers and commands
- Updated `config.example.toml` with capability examples
- Created `docs/KEY_MANAGEMENT.md` for security documentation
