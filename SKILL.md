# SKILL: usearch - Unified Search CLI

## When to Use

Use `usearch` when you need to search the web and return structured results. It normalizes responses across multiple search providers into a single consistent schema.

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
providers = ["tavily"]

[providers.tavily]
[providers.tavily.keyPool]
keys = ["env:TAVILY_API_KEY"]
```

Then set your API key:

```bash
export TAVILY_API_KEY=tvly-...
```

## Invocation

```bash
usearch "your search query"
```

### Options

- `--limit N` or `-l N` — Return at most N results (default: 10)
- `--pretty` or `-p` — Pretty print JSON output
- `--json` or `-j` — Force JSON output
- `--config PATH` or `-c PATH` — Use custom config file

## Output Schema

Returns a JSON object:

```json
{
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
  "total": 1
}
```

Fields:
- `title` — Result title
- `url` — Result URL
- `snippet` — Content summary/snippet
- `score` — Normalized relevance score (0-1)
- `source` — Provider name (for debugging, never change behavior based on this)

## Examples

```bash
# Basic search
usearch "what is firecrawl"

# Limit results, pretty print
usearch --limit 5 --pretty "rust async runtime"

# Custom config
usearch -c ./config.toml "machine learning"
```

## Requirements

- Node.js >= 18
- Config file at `~/.config/usearch/config.toml`
- API key configured via environment variable

## Troubleshooting

**"Config file not found"** — Create `~/.config/usearch/config.toml` or specify with `--config`.

**"Environment variable TAVILY_API_KEY is not set"** — Export your Tavily API key.

**"No providers configured for 'basic_search' capability"** — Check that `capabilities.basic_search.providers` is set in config.
