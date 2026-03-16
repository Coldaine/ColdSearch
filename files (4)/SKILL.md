---
name: unified-search
description: >
  Search the web through a unified layer that abstracts away individual
  search providers. Supports basic search with fanout+rerank across
  multiple providers, and an agent mode for multi-step research.
triggers: web search, search the web, find information, look up, research
---

# Unified Search

## When to Use

Use this skill when you need to search the web, look up current information, or research a topic. Do not call individual search provider APIs directly.

## Commands

### Basic Search

```bash
usearch "your query here"
```

Returns JSON to stdout: an array of results, each with title, url, snippet, and relevance score.

### Search Agent (Research Mode)

```bash
usearch --agent "your goal or question here"
```

Accepts a goal, not a query. Orchestrates multi-step search internally. Returns a synthesized answer with sources.

### Options

```bash
usearch --capability <name>    # Override the default capability (e.g. extract, deep_research)
usearch --limit <n>            # Max results to return (default: 10)
usearch --json                 # Force JSON output (default for piped stdout)
usearch --pretty               # Pretty-print JSON
```

## What You Should Know

- You do not choose which provider answers. The layer handles that.
- Results come in a single consistent schema regardless of source.
- If a search fails, the layer retries with alternate providers/keys before returning an error.
- The `--agent` flag is slower but smarter. Use it for complex questions that benefit from multi-step reasoning. Use basic search for simple lookups.
