# Routing and Request Policy

## Routing (Current)

Operators configure provider pools per capability in `config.toml`. The runtime:

1. Validates the capability and configured providers.
2. Resolves API keys (Doppler-injected env vars, explicit env refs, optional BWS refs, or keyless providers).
3. Selects from the pool (random or fanout per config).
4. Does not silently hop to another provider after selection.

See `docs/ADRs/001-fanout-architecture.md`, `config.example.toml`, and `docs/KEY_MANAGEMENT.md`.

## Request lifecycle (Current)

All networked operations use shared request handling:

- explicit timeouts
- abort control
- bounded transient retries
- classified error reporting

Applies to provider adapters and agent LLM calls. Agent LLM uses OpenAI-compatible endpoints only; ColdSearch does not call Anthropic APIs.
