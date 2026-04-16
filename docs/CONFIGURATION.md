# Configuration Reference

ColdSearch is configured via a TOML file at:

- `~/.config/coldsearch/config.toml` (preferred)
- `~/.config/usearch/config.toml` (legacy fallback)

You can override the path with `--config`.

## Overview

The config has three major parts:

- **Capability routing**: maps `search` / `extract` / `crawl` to provider pools.
- **Provider configuration**: key pools and provider-specific options.
- **Operational logging**: optional usage logging output path.

See `config.example.toml` for a runnable starting point.

## Capability routing

```toml
[capabilities.search]
providers = ["searxng", "tavily", "exa", "brave", "serper"]
strategy = "random" # or "all"

[capabilities.extract]
providers = ["tavily", "exa", "jina", "firecrawl"]
strategy = "random"

[capabilities.crawl]
providers = ["tavily", "firecrawl", "exa"]
strategy = "random"
```

- **`providers`**: ordered list of providers eligible for the capability.
- **`strategy`**:
  - **`random`**: pick exactly one provider per request
  - **`all`**: fan out to all configured providers (primarily for `search` + reranking)

## Provider configuration

Each provider must appear under `[providers.<name>]`.

### Key pools

```toml
[providers.tavily]
[providers.tavily.keyPool]
keys = ["env:TAVILY_API_KEY_1", "env:TAVILY_API_KEY_2"]
strategy = "random" # or "round-robin"
```

- **`keys`**: list of key references.
- **`strategy`**:
  - **`round-robin`** (default): rotate sequentially
  - **`random`**: pick a random key per call

#### Key reference formats

- **`env:VAR_NAME`**: environment variable lookup
- **`bws:SECRET_NAME_OR_ID`**: Bitwarden Secrets Manager lookup
- **raw literal**: interpreted as the key itself (useful for tests)

### Provider options

Some providers support per-provider options.

#### SearXNG

```toml
[providers.searxng.options]
baseUrl = "https://search.example.internal"
```

Environment fallback: `SEARXNG_BASE_URL`.

## Operational logging

ColdSearch logs a JSONL entry after **every adapter invocation** (success or failure).

Default path: `~/.config/coldsearch/usage.jsonl`

```toml
[logging.usage]
path = "~/.config/coldsearch/usage.jsonl"
```

Each entry contains:

- `timestamp`
- `provider`
- `capability`
- `key` (masked identifier)
- `success`
- `response_time_ms`
- `error` (when present)

## CLI flags that interact with config

- `--providers a,b,c`: restrict to a subset of the configured pool
- `--single-provider`: force a single provider (even when strategy is `all`)
- `--dry-run`: print the execution plan (providers + key pool summary) without making network calls

