# Configuration Reference

ColdSearch is configured via a TOML file at `~/.config/coldsearch/config.toml`.

You can override the path with `--config`.

## Overview

The config has three major parts:

- **Capability routing**: maps `search` / `extract` / `crawl` to provider pools
- **Provider configuration**: secrets and provider-specific options
- **Operational logging**: optional usage logging output path

## Capability routing

```toml
[capabilities.search]
providers = ["searxng", "tavily", "exa", "brave", "serper"]
strategy = "random"

[capabilities.extract]
providers = ["tavily", "exa", "jina", "firecrawl"]
strategy = "random"

[capabilities.crawl]
providers = ["tavily", "firecrawl", "exa"]
strategy = "random"
```

- `providers`: ordered list of providers eligible for the capability
- `strategy`:
  - `random`: pick exactly one provider per request
  - `all`: fan out to all configured providers

## Provider configuration

Each provider appears under `[providers.<name>]`.

### Key pool shape

```toml
[providers.tavily.keyPool]
strategy = "random"
```

That minimal shape works when ColdSearch knows the provider’s default secret name.

When `keyPool.keys` is omitted or empty, ColdSearch resolves secrets in this order:

1. `defaultSecretName`, if set
2. provider default secret name, if known

Override a single secret name like this:

```toml
[providers.brave.keyPool]
defaultSecretName = "BRAVE_SEARCH_API_KEY"
```

Use explicit keys only when you need multiple secrets and rotation:

```toml
[providers.tavily.keyPool]
keys = ["doppler:TAVILY_API_KEY_1", "doppler:TAVILY_API_KEY_2"]
strategy = "random"
```

Supported explicit key reference formats:

- `doppler:SECRET_NAME`
- `env:VAR_NAME`
- raw literal (discouraged)

## Provider default secret names

Verified from official docs:

- Tavily → `TAVILY_API_KEY`
- Exa → `EXA_API_KEY`
- Firecrawl → `FIRECRAWL_API_KEY`

Practical defaults used by ColdSearch:

- Brave → `BRAVE_API_KEY`
- Serper → `SERPER_API_KEY`

## SearXNG options

```toml
[providers.searxng.options]
baseUrl = "https://search.example.internal"
```

Environment fallback: `SEARXNG_BASE_URL`.

## Doppler authentication

ColdSearch uses the Doppler CLI for secret retrieval.

### Development

```bash
doppler login
doppler run -- coldsearch search "query"
```

### CI / production

```bash
doppler run --token="$DOPPLER_TOKEN" -- coldsearch search "query"
```

## Operational logging

ColdSearch logs a JSONL entry after every adapter invocation.

Default path: `~/.config/coldsearch/usage.jsonl`

```toml
[logging.usage]
path = "~/.config/coldsearch/usage.jsonl"
```

Each entry contains:

- `timestamp`
- `provider`
- `capability`
- `key` (safe identifier)
- `success`
- `response_time_ms`
- `error`, when present

## Agent LLM

Agent mode (`--agent`) uses an OpenAI-compatible chat completions endpoint:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` (optional)

This is separate from provider key resolution in `config.toml`.
