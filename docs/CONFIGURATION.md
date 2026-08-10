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

## Result cache

Read-through exact-replay cache for `search` / `extract` and for provider
tools with an explicit replay-safe policy. On by default; a hit serves the
stored response without calling any provider.

```toml
[cache]
enabled = true
search_ttl = "6h"
extract_ttl = "24h"
tool_ttl = "6h"
# path = "~/.config/coldsearch/cache"
```

- `enabled`: set to `false` to disable the cache entirely
- `search_ttl` / `extract_ttl` / `tool_ttl`: freshness windows (`s`/`m`/`h`/`d`
  suffix or bare seconds). `tool_ttl` applies to explicitly replay-safe
  provider tools only.
- `path`: storage directory (default `~/.config/coldsearch/cache`)

Per-invocation overrides:

- `--no-cache` bypasses the cache for that call
- `--freshness <duration>` overrides the TTL for that invocation only; it
  neither persists nor changes the configured defaults. Applies to `search`,
  `extract`, and replay-safe provider tools.

Maintenance:

- `coldsearch cache stats` describes replay-cache storage
- `coldsearch cache clear` deletes replay-cache entries (history is kept)

Crawl results are never replay-cached; crawls are recorded in history only.

## Execution history

Every `search` / `extract` / `crawl` / `tool call` invocation is recorded as
one top-level execution record in a local JSONL history — including cache
replays, partial successes, and failures.

Default path: `~/.config/coldsearch/history.jsonl`

```toml
[history]
path = "~/.config/coldsearch/history.jsonl"
```

History is independent of the replay cache: cache expiry and `cache clear`
never erase it, and `history clear` never touches the cache.

Commands:

- `coldsearch history recent [--limit N] [--json]` — newest executions first
- `coldsearch history search <query> [--limit N] [--json]` — local-only search
  over prior executions (requests, result titles/URLs, content, provider
  metadata); makes zero provider calls
- `coldsearch history show <execution-id> [--json]` — full record of one
  execution; `--by-provider` shows stored fanout partitions and the merged
  result
- `coldsearch history clear --all [--json]` — explicitly delete all history
  (requires `--all`; replay cache is untouched)

Records are scrubbed before persistence: resolved credential values, signed-URL
tokens, and credential fields are redacted from inputs, options, results, and
provider-supplied raw detail.

## Batch execution

`coldsearch batch` runs `search` / `extract` / `crawl` / provider-tool records
from a JSONL input file, writing one JSONL output line per processed record.

```bash
coldsearch batch --input queries.jsonl --output results.jsonl --concurrency 4
coldsearch batch --input queries.jsonl --output results.jsonl --concurrency 4 --retry-errors
coldsearch batch --input queries.jsonl --output results.jsonl --dry-run --json
```

Flags:

- `--input FILE` — input JSONL of batch records (required)
- `--output FILE` — output JSONL, appended in completion order (required)
- `--concurrency N` — maximum concurrent items (default: `1`)
- `--retry-errors` — retry records that errored in a prior run
- `--dry-run` — report the planned records without executing or writing
- `--json` — print the run summary as JSON on stdout

Behavior:

- Every item executes through the same backend / tool substrate as the
  standalone command, so routing, cache, and execution-history behavior are
  identical; batch does not create a second history model.
- The output file is append-only. Reruns resume by stable `id`: existing
  success records are skipped, existing error records are retried only with
  `--retry-errors`.
- Resume is keyed on `id` only: if you change an item's input, give it a new
  `id` or it will be skipped as already-succeeded.
- Batch items are configured per-record; the global `--limit`, `--providers`,
  `--no-cache`, and `--freshness` flags do not apply to `batch`.
- Duplicate `id`s resolve to the first occurrence: identical later records are
  skipped; later records with different input emit a visible
  `DUPLICATE_ID_CONFLICT` error record that is never retried.
- A failing item never aborts unrelated items; the run completes and exits
  non-zero when any executed item failed.

## Agent LLM

Agent mode (`--agent`) uses an OpenAI-compatible chat completions endpoint:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` (optional)

This is separate from provider key resolution in `config.toml`.
