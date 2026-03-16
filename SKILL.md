# SKILL: usearch - Unified Search CLI

## When to Use

Use `usearch` when you need to search the web and return structured results. It normalizes responses across multiple search providers into a single consistent schema.

Use **Mode 1** (default) for quick search across multiple providers with reranking.
Use **Mode 2** (`--agent`) for multi-step research that synthesizes an answer from multiple sources.

## Installation

```bash
npm install -g usearch
```

Or from the repo:

```bash
git clone <repo>
cd usearch
npm install
npm run build
npm link
```

## Configuration

Create `~/.config/usearch/config.toml`:

```toml
[capabilities.basic_search]
providers = ["tavily", "brave", "exa"]

[providers.tavily]
[providers.tavily.keyPool]
keys = ["env:TAVILY_API_KEY"]

[providers.brave]
[providers.brave.keyPool]
keys = ["env:BRAVE_API_KEY"]

[providers.exa]
[providers.exa.keyPool]
keys = ["env:EXA_API_KEY"]
```

Then set your API keys:

```bash
export TAVILY_API_KEY=tvly-...
export BRAVE_API_KEY=BS...
export EXA_API_KEY=...
# For agent mode:
export ANTHROPIC_API_KEY=sk-ant-...
```

## Mode 1: Fanout + Rerank (Default)

Search across all configured providers in parallel, combine and rerank results.

```bash
usearch "your search query"
usearch --limit 5 --pretty "machine learning"
usearch --providers tavily,brave --rerank rrf "query"
```

### Options

- `--limit N` or `-l N` — Return at most N results (default: 10)
- `--pretty` or `-p` — Pretty print JSON output
- `--json` or `-j` — Force JSON output
- `--providers LIST` — Comma-separated providers (default: all configured)
- `--rerank STRATEGY` — Reranker: `rrf` (default), `score`, or `none`
- `--config PATH` or `-c PATH` — Use custom config file

### Output Schema

```json
{
  "mode": "fanout",
  "query": "the search query",
  "results": [
    {
      "title": "Result title",
      "url": "https://example.com",
      "snippet": "Content summary...",
      "score": 0.95,
      "source": "tavily"
    }
  ],
  "providers_used": ["tavily", "brave", "exa"],
  "total": 10
}
```

## Mode 2: Search Agent

Multi-step research agent that searches, reads sources, and synthesizes an answer.

```bash
usearch --agent "explain quantum computing in simple terms"
usearch --agent --max-steps 10 --max-sources 5 "latest fusion energy developments"
```

### Agent Options

- `--agent` or `-a` — Enable agent mode
- `--llm PROVIDER` — LLM provider: `anthropic` (default) or `openai`
- `--model MODEL` — LLM model name (e.g., `claude-3-opus`, `gpt-4o`)
- `--max-steps N` — Maximum research steps (default: 5)
- `--max-sources N` — Maximum sources to collect (default: 5)

### Output Schema

```json
{
  "mode": "agent",
  "goal": "the research goal",
  "answer": "Synthesized answer with citations [1], [2]...",
  "sources": [
    {
      "url": "https://example.com",
      "title": "Source Title",
      "snippet": "..."
    }
  ],
  "steps": 5
}
```

## Examples

```bash
# Quick search (Mode 1 - fanout)
usearch "what is firecrawl"

# Control which providers
usearch --providers tavily,brave "rust async runtime"

# Research mode (Mode 2 - agent)
usearch --agent "compare tokamak vs stellarator fusion approaches"

# Deep research with more steps
usearch --agent --max-steps 15 --max-sources 8 "history of quantum computing"
```

## Requirements

- Node.js >= 18
- Config file at `~/.config/usearch/config.toml`
- API keys for configured providers
- For agent mode: ANTHROPIC_API_KEY or OPENAI_API_KEY

## Troubleshooting

**"Config file not found"** — Create `~/.config/usearch/config.toml` or specify with `--config`.

**"Environment variable X is not set"** — Export the required API key.

**"No providers configured"** — Check that `capabilities.basic_search.providers` is set in config.

**"All providers failed"** — Check your API keys and network connection.

## Available Providers

- `tavily` — Tavily Search API (best for AI apps)
- `brave` — Brave Search API (privacy-focused)
- `exa` — Exa/Metaphor (neural search)
- `serper` — Serper.dev (Google Search API)
