# SKILL: coldsearch - Unified Search CLI

## When to Use

Use `coldsearch` when you need to search the web and return structured results. It normalizes responses across multiple search providers into a single consistent schema.

`usearch` remains available as a compatibility alias, but `coldsearch` is the canonical command in this guide.

Use **Mode 1** (default) for quick search across multiple providers with reranking.
Use **Mode 2** (`--agent`) for multi-step research that synthesizes an answer from multiple sources.
Use **extract** command to extract content from a URL.
Use **crawl** command to crawl a website.

## Installation

```bash
npm install -g coldsearch
```

Or from the repo:

```bash
git clone <repo>
cd coldsearch
npm install
npm run build
npm link
```

## Configuration

Create `~/.config/coldsearch/config.toml`:

```toml
# Search capability - search the web
[capabilities.search]
providers = ["tavily", "brave", "exa"]
strategy = "all"  # "all" = fanout, "random" = pick one random provider

# Extract capability - extract content from URLs
[capabilities.extract]
providers = ["tavily"]
strategy = "random"

# Crawl capability - crawl websites
[capabilities.crawl]
providers = ["tavily"]
strategy = "random"

# Provider configurations
[providers.tavily]
[providers.tavily.keyPool]
keys = ["env:TAVILY_API_KEY"]
strategy = "round-robin"  # "round-robin" or "random"

[providers.brave]
[providers.brave.keyPool]
keys = ["env:BRAVE_API_KEY"]
strategy = "round-robin"

[providers.exa]
[providers.exa.keyPool]
keys = ["env:EXA_API_KEY"]
strategy = "round-robin"
```

Then set your API keys:

```bash
export TAVILY_API_KEY=tvly-...
export BRAVE_API_KEY=BS...
export EXA_API_KEY=...
# For agent mode:
export ANTHROPIC_API_KEY=sk-ant-...
```

## Commands

### search - Search the Web

Search across all configured providers in parallel, combine and rerank results.

```bash
coldsearch search "your search query"
coldsearch search --limit 5 --pretty "machine learning"
coldsearch search --providers tavily,brave --rerank rrf "query"
```

#### Search Options

- `--limit N` or `-l N` — Return at most N results (default: 10)
- `--pretty` or `-p` — Pretty print JSON output
- `--json` or `-j` — Force JSON output
- `--providers LIST` — Comma-separated providers (default: all configured)
- `--single-provider` — Use one random provider instead of fanout
- `--rerank STRATEGY` — Reranker: `rrf` (default), `score`, or `none`
- `--config PATH` or `-c PATH` — Use custom config file

#### Search Output Schema

```json
{
  "mode": "fanout",
  "command": "search",
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

### extract - Extract Content from URL

Extract content from a specific URL using the configured extract provider.

```bash
coldsearch extract "https://example.com/article"
coldsearch extract --single-provider "https://example.com"
```

#### Extract Options

- `--single-provider` — Use one random provider instead of trying all
- `--config PATH` or `-c PATH` — Use custom config file
- `-p`, `--pretty` — Pretty print JSON output
- `-j`, `--json` — Force JSON output

#### Extract Output Schema

```json
{
  "mode": "single-provider",
  "command": "extract",
  "url": "https://example.com/article",
  "result": {
    "content": "Extracted content...",
    "url": "https://example.com/article",
    "title": "Article Title",
    "source": "tavily"
  },
  "provider": "tavily"
}
```

### crawl - Crawl a Website

Crawl a website and extract content from multiple pages.

```bash
coldsearch crawl "https://example.com"
coldsearch crawl --limit 5 "https://docs.example.com"
```

#### Crawl Options

- `--limit N` or `-l N` — Return at most N pages (default: 10)
- `--single-provider` — Use one random provider
- `--config PATH` or `-c PATH` — Use custom config file
- `-p`, `--pretty` — Pretty print JSON output
- `-j`, `--json` — Force JSON output

#### Crawl Output Schema

```json
{
  "mode": "fanout",
  "command": "crawl",
  "url": "https://example.com",
  "results": [
    {
      "url": "https://example.com/page1",
      "title": "Page 1",
      "content": "Content..."
    }
  ],
  "provider": "tavily",
  "total": 5
}
```

## Agent Mode

Multi-step research agent that searches, reads sources, and synthesizes an answer.

```bash
coldsearch --agent "explain quantum computing in simple terms"
coldsearch --agent --max-steps 10 --max-sources 5 "latest fusion energy developments"
```

### Agent Options

- `--agent` or `-a` — Enable agent mode
- `--llm PROVIDER` — LLM provider: `anthropic` (default) or `openai`
- `--model MODEL` — LLM model name (e.g., `claude-3-opus`, `gpt-4o`)
- `--max-steps N` — Maximum research steps (default: 5)
- `--max-sources N` — Maximum sources to collect (default: 5)

### Agent Output Schema

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

## Provider Strategies

### Capability Strategy

In `config.toml`, each capability can have a strategy:

- `strategy = "all"` — Query all providers in parallel (fanout mode)
- `strategy = "random"` — Pick one random provider

Example:
```toml
[capabilities.search]
providers = ["tavily", "brave"]
strategy = "random"  # Pick one random provider for each search
```

### Key Pool Strategy

Each provider's key pool can also have a strategy:

- `strategy = "round-robin"` — Rotate through keys sequentially (default)
- `strategy = "random"` — Pick a random key each time

Example:
```toml
[providers.tavily.keyPool]
keys = ["env:TAVILY_KEY_1", "env:TAVILY_KEY_2"]
strategy = "random"  # Pick random key for each request
```

## Examples

```bash
# Quick search (fanout mode)
coldsearch "what is firecrawl"

# Search with specific providers
coldsearch --providers tavily,brave "rust async runtime"

# Single provider mode (via CLI flag)
coldsearch --single-provider "machine learning"

# Extract content from URL
coldsearch extract "https://blog.example.com/post"

# Crawl a website
coldsearch crawl --limit 5 "https://docs.example.com"

# Research mode (agent)
coldsearch --agent "compare tokamak vs stellarator fusion approaches"

# Deep research with more steps
coldsearch --agent --max-steps 15 --max-sources 8 "history of quantum computing"
```

## Requirements

- Node.js >= 18
- Config file at `~/.config/coldsearch/config.toml`
- API keys for configured providers
- For agent mode: ANTHROPIC_API_KEY or OPENAI_API_KEY

## Troubleshooting

**"Config file not found"** — Create `~/.config/coldsearch/config.toml` or specify with `--config`.

**"Environment variable X is not set"** — Export the required API key.

**"No providers configured"** — Check that `capabilities.search.providers` is set in config.

**"All providers failed"** — Check your API keys and network connection.

## Available Providers

- `tavily` — Tavily Search API (best for AI apps)
  - Capabilities: `search`, `extract`, `crawl`
- `brave` — Brave Search API (privacy-focused)
  - Capabilities: `search`
- `exa` — Exa/Metaphor (neural search)
  - Capabilities: `search`, `extract`
- `serper` — Serper.dev (Google Search API)
  - Capabilities: `search`
- `jina` — Jina AI Reader (URL to markdown)
  - Capabilities: `extract` (no API key required)
- `firecrawl` — Firecrawl (web scraping)
  - Capabilities: `extract`, `crawl`
