# ColdSearch

`coldsearch` is a unified search CLI for web search, extraction, and crawling across overlapping provider APIs. The CLI stays simple; the routing, provider selection, and key management live in config and shared runtime code.

`usearch` remains available as a compatibility alias for now.

## Quick Start

```bash
npm install
npm run build

# Primary command
coldsearch --help

# Compatibility alias
usearch --help
```

Configuration lives at `~/.config/coldsearch/config.toml`. The runtime also falls back to `~/.config/usearch/config.toml` if the new path does not exist yet.

## What ColdSearch Is

- A CLI-first interface over multiple search providers
- A normalized runtime that hides provider-specific quirks behind shared schemas
- A config-driven routing layer that lets humans decide provider pools and rotation
- A local-first tool today, with explicit architectural seams for a future hybrid remote execution backend

## What ColdSearch Is Becoming

ColdSearch is not aiming at MCP as the long-term interface. The long-term direction is still CLI-first, but with optional remote execution:

1. The CLI remains the operator-facing interface.
2. Some work, especially agentic or long-running jobs, can later be submitted to a remote backend.
3. That backend can centralize secrets, job state, retries, and async orchestration.

The current implementation remains local-first, but the runtime is now being organized so the CLI and a future remote executor can share the same provider registry, routing logic, and normalization layer.

## Current Capabilities

| Capability | Implemented Providers | Selection |
|------------|-------------------|-----------|
| `search` | SearXNG, Tavily, Exa, Brave, Serper | Manual random pool |
| `extract` | Tavily, Exa, Jina, Firecrawl | Manual random pool |
| `crawl` | Tavily, Firecrawl, Exa | Manual random pool |

## Provider Overlap

The core architectural truth is provider overlap, not just three coarse commands.

- Tavily, Exa, Brave, Serper, and SearXNG overlap heavily on search.
- Tavily, Exa, Jina, and Firecrawl overlap on content extraction.
- Tavily and Firecrawl overlap on site discovery and crawl-like workflows.
- Several providers expose richer surfaces than ColdSearch currently implements.

The authoritative comparison lives in:

- `docs/CAPABILITY_MATRIX.md`
- `docs/providers/README.md`
- `docs/providers/*.md`

## SearXNG

SearXNG is treated as a self-hosted or operator-managed provider.

- ColdSearch supports SearXNG via an explicit `baseUrl` provider option or `SEARXNG_BASE_URL`.
- The product code does not assume `localhost`.
- Optional self-hosting assets may exist in the repo, but they are infrastructure aids for another machine, not the default local workflow for this laptop.

Example config:

```toml
[providers.searxng]
[providers.searxng.keyPool]
keys = []

[providers.searxng.options]
baseUrl = "https://search.example.internal"
```

## Development

```bash
npm install
npm run build
npm test
```

## Documentation

- `docs/NORTH_STAR.md` - Product direction and architectural intent
- `docs/architecture.md` - Runtime architecture and seams
- `docs/PROGRESS.md` - Current implementation status
- `docs/CONFIGURATION.md` - Configuration reference and precedence
- `docs/CAPABILITY_MATRIX.md` - Required maintenance matrix for providers vs capabilities
- `docs/providers/README.md` - Provider docs index
- `docs/providers/*.md` - Per-provider detail pages
- `docs/plans/*.md` - Provider adoption plans that must exist before implementation

## Roadmap

- Harden request lifecycle: timeouts, retries, normalized errors
- Expand provider coverage without bloating the CLI surface
- Add lightweight governance for provider/doc drift
- Prepare a future hybrid execution model for agent-mode async jobs
