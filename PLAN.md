# Implementation Plan: Modes 2 & 4

## Overview

This plan implements both **Mode 1 (Fanout + Rerank)** and **Mode 2 (Search Agent)** to complete the vision of a unified search layer.

---

## Mode 1: Fanout + Rerank

### What It Does

When you call `usearch "query"`:
1. Looks up which providers are mapped to `basic_search` in config
2. Fans out to ALL providers in parallel
3. Each provider returns normalized results
4. Reranker combines and ranks results from all providers
5. Returns top N deduplicated results

### Implementation

**New Adapters:**
- `BraveAdapter` - Brave Search API
- `ExaAdapter` - Exa (formerly Metaphor) API
- `SerperAdapter` - Serper.dev Google Search API

**Core Components:**
- `FanoutEngine` - Parallel execution with key rotation
- `Reranker` - Combine and rank heterogeneous results
- `KeyPoolManager` - Thread-safe key rotation

### CLI

```bash
# Mode 1 (default): Fanout to all providers
usearch "machine learning"

# Control fanout behavior
usearch --providers tavily,brave "query"  # Use specific providers
usearch --fanout --rerank reciprocal "query"  # Explicit mode 1 with rerank strategy
```

---

## Mode 2: Search Agent

### What It Does

When you call `usearch --agent "research question"`:
1. Internal LLM agent receives the goal (not a query string)
2. Agent orchestrates multi-step research:
   - Initial search to understand landscape
   - Read promising results
   - Refine queries based on findings
   - Search again with better queries
   - Synthesize final answer with citations
3. Returns researched answer with sources

### Implementation

**Components:**
- `SearchAgent` - ReAct-style agent with tool access
- `ToolRegistry` - Internal tools: search, fetch, synthesize
- `LLMClient` - Pluggable LLM backend (OpenAI, Anthropic, etc.)
- `ContextManager` - Maintains research state across steps

### Agent Workflow

```
1. RECEIVE goal: "What are the latest developments in fusion energy?"

2. INITIAL_SEARCH: "fusion energy breakthroughs 2024 2025"
   → Gets 10 results across providers

3. FETCH: Read top 3 most promising URLs
   → Extracts key findings

4. REFINE: "tokamak vs stellarator recent advances"
   → Searches again with better query

5. FETCH: Read more sources

6. SYNTHESIZE: Compile answer with citations
   → Returns structured response with sources
```

### CLI

```bash
# Mode 2: Search agent
usearch --agent "explain quantum computing in simple terms"

# With model selection
usearch --agent --model claude-3-opus "research question"

# Control depth
usearch --agent --max-steps 10 --max-sources 5 "complex topic"
```

---

## Architecture Changes

### New Directory Structure

```
src/
├── adapters/
│   ├── tavily.ts
│   ├── brave.ts          # NEW
│   ├── exa.ts            # NEW
│   ├── serper.ts         # NEW
│   └── index.ts          # NEW: Adapter registry
├── engine/
│   ├── fanout.ts         # NEW: Parallel fanout engine
│   ├── reranker.ts       # NEW: Result reranking
│   └── keypool.ts        # NEW: Thread-safe key pool
├── agent/
│   ├── agent.ts          # NEW: Search agent core
│   ├── tools.ts          # NEW: Agent tools
│   ├── llm.ts            # NEW: LLM client interface
│   └── context.ts        # NEW: Research context
├── types.ts
├── config.ts
└── cli.ts
```

### Config Additions

```toml
[capabilities.basic_search]
providers = ["tavily", "brave", "exa"]

[providers.brave]
[providers.brave.keyPool]
keys = ["env:BRAVE_API_KEY"]

[providers.exa]
[providers.exa.keyPool]
keys = ["env:EXA_API_KEY"]

[providers.serper]
[providers.serper.keyPool]
keys = ["env:SERPER_API_KEY"]

# NEW: Agent configuration
[agent]
model = "claude-3-sonnet"
max_steps = 5
max_sources = 5
```

---

## Reranker Strategies

### 1. Reciprocal Rank Fusion (RRF)
Combines ranks from multiple providers:
```
score = Σ 1 / (k + rank_i)
```
Simple, effective, no ML required.

### 2. Score Normalization
Normalizes provider-specific scores to 0-1, then weighted average.

### 3. Content-Based (Future)
Cross-encoder or embedding similarity for semantic reranking.

---

## Implementation Phases Within This Branch

1. **Add Provider Adapters** - Brave, Exa, Serper
2. **Fanout Engine** - Parallel execution with error handling
3. **Reranker** - RRF implementation
4. **Key Pool Manager** - Thread-safe rotation
5. **Search Agent** - ReAct loop with tools
6. **CLI Updates** - Mode flags and options
7. **Documentation** - Update SKILL.md and examples

---

## Success Criteria

- [ ] `usearch "query"` fans out to 3+ providers
- [ ] Results are deduplicated and reranked
- [ ] `usearch --agent "question"` performs multi-step research
- [ ] Agent returns synthesized answer with sources
- [ ] Config controls all provider mappings
- [ ] Key pools rotate correctly under concurrent load
