# Key Management

ColdSearch now uses **Doppler** for runtime secret resolution.

## Resolution order

For each provider, ColdSearch resolves API keys in this order:

1. Explicit `keyPool.keys`, if present
2. `keyPool.defaultSecretName`, if present
3. A built-in provider default secret name, when ColdSearch knows one

## Supported explicit reference forms

- `doppler:SECRET_NAME`
- `env:VAR_NAME`
- raw literal values (discouraged; mainly for tests)

Bitwarden runtime support has been removed.

## Provider default secret names

Verified from official docs:

- Tavily → `TAVILY_API_KEY`
- Exa → `EXA_API_KEY`
- Firecrawl → `FIRECRAWL_API_KEY`

Practical defaults used by ColdSearch, but easily overridden:

- Brave → `BRAVE_API_KEY`
- Serper → `SERPER_API_KEY`

If you want a different name, set `defaultSecretName`.

```toml
[providers.brave.keyPool]
defaultSecretName = "BRAVE_SEARCH_API_KEY"
```

If you want multiple keys with rotation, use explicit `keys`.

```toml
[providers.tavily.keyPool]
keys = ["doppler:TAVILY_API_KEY_1", "doppler:TAVILY_API_KEY_2"]
strategy = "random"
```

## Doppler auth pattern

### Development

Use a normal Doppler login once, then run ColdSearch through Doppler.

```bash
doppler login
doppler run -- coldsearch search "query"
```

### CI / production

Use a Doppler service token and inject it only for the target process.

```bash
doppler run --token="$DOPPLER_TOKEN" -- coldsearch search "query"
```

Or, if the environment already injects the token for the process, ColdSearch can call the Doppler CLI directly.

## Why this shape

This keeps config small for the common case:

```toml
[providers.tavily.keyPool]
strategy = "random"
```

But still makes overrides trivial when a provider, environment, or account needs a different secret name.
