# usearch - Unified Search CLI

One CLI for web search, content extraction, and crawling. Randomly distributes requests across multiple providers for redundancy and cost optimization.

## Quick Start

```bash
# Install
npm install -g usearch

# Configure (see config.example.toml)
mkdir -p ~/.config/usearch
cp config.example.toml ~/.config/usearch/config.toml

# Set your API keys
export TAVILY_API_KEY="tvly-..."
export EXA_API_KEY="..."
export BRAVE_API_KEY="BS..."
export SERPER_API_KEY="..."
export FIRECRAWL_API_KEY="fc-..."

# Search (random provider from 4 options)
usearch search "machine learning"

# Extract content (random provider from 3 options)
usearch extract "https://example.com/article"

# Crawl website (random provider from 2 options)
usearch crawl "https://docs.example.com"
```

## Why usearch?

**Problem:** AI agents pick search providers arbitrarily, burning through one provider's credits while others sit idle.

**Solution:** Humans configure which providers back which capabilities. The system randomly selects providers and keys per request.

```
┌────────────────────────────────────────┐
│  usearch extract "https://..."         │
└─────────────────┬──────────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │ extract capability│
        │ [tavily, exa, jina]│
        └────────┬────────┘
                 │ random pick
                 ▼
              "exa"
                 │
                 ▼
        ┌─────────────────┐
        │ exa key pool     │
        │ [key1, key2]     │
        └────────┬────────┘
                 │ random pick
                 ▼
              "key2"
                 │
                 ▼
           API Request
```

## Providers

| Provider | Search | Extract | Crawl | API Key |
|----------|--------|---------|-------|---------|
| Tavily | ✅ | ✅ | ✅ | Required |
| Exa | ✅ | ✅ | ❌ | Required |
| Brave | ✅ | ❌ | ❌ | Required |
| Serper | ✅ | ❌ | ❌ | Required |
| Jina | ❌ | ✅ | ❌ | **Free** |
| Firecrawl | ❌ | ✅ | ✅ | Required |

## Configuration

`~/.config/usearch/config.toml`:

```toml
# Capability → Provider mapping
[capabilities.search]
providers = ["tavily", "exa", "brave", "serper"]
strategy = "random"  # or "all" for fanout

[capabilities.extract]
providers = ["tavily", "exa", "jina"]
strategy = "random"

[capabilities.crawl]
providers = ["tavily", "firecrawl"]
strategy = "random"

# Provider → Key mapping
[providers.tavily.keyPool]
keys = ["env:TAVILY_KEY_1", "env:TAVILY_KEY_2"]
strategy = "random"  # or "round-robin"

[providers.exa.keyPool]
keys = ["env:EXA_API_KEY"]

[providers.jina.keyPool]
keys = []  # Free, no key needed
```

## Commands

### Search
```bash
usearch search "machine learning"
usearch search --limit 5 --pretty "rust async"
usearch search --providers tavily,exa "query"
```

### Extract
```bash
usearch extract "https://example.com/article"
usearch extract --single-provider "https://..."
```

### Crawl
```bash
usearch crawl "https://docs.example.com"
usearch crawl --limit 10 "https://..."
```

### Agent Mode (Multi-step Research)
```bash
usearch --agent "explain quantum computing"
usearch --agent --max-steps 10 "latest fusion energy"
```

## Key Management

See `docs/KEY_MANAGEMENT.md` for:
- Secure key storage practices
- Environment variable configuration
- Multi-key rotation strategies
- Usage tracking (planned)

## Architecture

- **Capability Layer**: `search`, `extract`, `crawl`
- **Provider Selection**: Random pick from configured providers
- **Key Selection**: Random pick from provider's key pool
- **Adapter Pattern**: One adapter per provider, normalized output
- **Config-Driven**: All routing in TOML, no code changes needed

See `docs/architecture.md` for details.

## Documentation

- `SKILL.md` - Agent invocation guide
- `docs/architecture.md` - System design
- `docs/PROGRESS.md` - Implementation status
- `docs/KEY_MANAGEMENT.md` - Security & keys
- `config.example.toml` - Configuration reference

## Development

```bash
git clone <repo>
cd usearch
npm install
npm run build
npm link  # Makes `usearch` available globally
```

## Roadmap

- [x] Multi-provider search (Tavily, Exa, Brave, Serper)
- [x] Multi-provider extract (Tavily, Exa, Jina)
- [x] Multi-provider crawl (Tavily, Firecrawl)
- [x] Random provider/key selection
- [x] Capability-based architecture
- [ ] Quota-aware rotation (Phase 5)
- [ ] Usage tracking (Phase 5)
- [ ] Result caching (Phase 5)

## License

MIT
