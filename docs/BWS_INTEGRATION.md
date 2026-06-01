# Bitwarden Secrets Manager — Deprecated

**BWS support is deprecated.** All ColdSearch secrets should now be managed in Doppler. `bws:` references in `config.toml` will produce a clear deprecation error.

## Why Deprecated

ColdSearch now uses **Doppler** as its primary secrets manager, which provides:
- Zero-setup auth on dev machines (`doppler login` → OS keyring)
- Identical auth pattern between dev and CI (service token via `DOPPLER_TOKEN`)
- No per-request HTTP overhead (Doppler CLI caches in-memory after first `doppler secrets list`)
- Unified with all other Coldaine projects

BWS required a separate CLI, a verbose access token, an organization ID lookup, and had per-request latency from the Bitwarden API.

## Migration

See `docs/KEY_MANAGEMENT.md` → "Migration: BWS → Doppler" for the full procedure. In short:

1. Create a Doppler project `coldsearch` if it doesn't exist
2. Add your secrets there: `doppler secrets set TAVILY_API_KEY_1 "tvly-..." --project coldsearch --config dev`
3. Update `config.toml` key references: `bws:SECRET_NAME` → `doppler:SECRET_NAME`
4. Run `doppler login` on your dev machine
5. Remove BWS env vars from your shell

## BWS Config Still Works (Graceful Error)

Existing configs with `bws:` references will produce a **clear error message** instead of silently failing or falling back unexpectedly:

```
Bitwarden Secrets Manager support is deprecated.
Migrate to Doppler: set SECRET_NAME in Doppler, then use doppler:SECRET_NAME in config.
See docs/KEY_MANAGEMENT.md
```

## Getting Help

- Doppler docs: `docs/KEY_MANAGEMENT.md`
- Doppler CLI: `doppler --help`
- If you hit a case the migration guide doesn't cover, open an issue
