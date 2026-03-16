---
title: Progress
date: 2026-03-16
author: Patrick MacLyman
status: living
---

# Progress

## Current Status

**Phase 2 & 4: Multi-provider fanout + Search Agent.** ✅ Complete.

Both modes are now implemented:
- **Mode 1 (Fanout + Rerank)**: Parallel search across multiple providers with RRF reranking
- **Mode 2 (Search Agent)**: ReAct-style agent for multi-step research

## Phases

1. **Single-provider CLI.** ✅ Done.
2. **Multi-provider fanout.** ✅ Done. 
   - Multiple adapters (Tavily, Brave, Exa, Serper)
   - Parallel fanout with key pooling
   - Reranker with RRF strategy
   - Mode 1 works end to end
3. **Capability taxonomy.** ⏸️ Deferred. Basic taxonomy established (`basic_search`).
4. **Search agent.** ✅ Done.
   - ReAct-style agent with tool use
   - Multi-step research workflow
   - Source tracking and citation
   - LLM abstraction (Claude, OpenAI)
5. **Harden.** ⏸️ Not started. Quota-aware rotation, graceful degradation.

## What's Implemented

### Adapters
- ✅ Tavily
- ✅ Brave Search
- ✅ Exa (Metaphor)
- ✅ Serper.dev

### Mode 1: Fanout + Rerank
- ✅ Parallel provider queries
- ✅ Thread-safe key pooling
- ✅ RRF reranking
- ✅ Score normalization reranking
- ✅ Deduplication by URL
- ✅ Graceful partial failure

### Mode 2: Search Agent
- ✅ ReAct reasoning loop
- ✅ Tool registry (search, fetch, refine)
- ✅ Context management
- ✅ Source tracking
- ✅ LLM abstraction (Claude, OpenAI)
- ✅ HTML content extraction

### CLI
- ✅ Mode selection (`--agent`)
- ✅ Provider filtering (`--providers`)
- ✅ Rerank strategy (`--rerank`)
- ✅ Agent configuration (`--llm`, `--model`, `--max-steps`)

## Next Steps

**Phase 5: Harden**
- Quota-aware key rotation
- Rate limiting
- Better error recovery
- Result caching
- Streaming responses

Do not start Phase 5 without discussion.
