# BWS Integration

Bitwarden Secrets Manager runtime support has been removed.

ColdSearch now resolves secrets via Doppler.

## Migration

Replace old `bws:` references in `config.toml` with one of:

- implicit provider defaults
- `defaultSecretName = "..."`
- explicit `doppler:SECRET_NAME` references

Examples:

```toml
# Before
[providers.tavily.keyPool]
keys = ["bws:TAVILY_API_KEY"]

# After (implicit default)
[providers.tavily.keyPool]
strategy = "random"

# After (explicit override)
[providers.tavily.keyPool]
defaultSecretName = "TAVILY_API_KEY"

# After (multiple keys)
[providers.tavily.keyPool]
keys = ["doppler:TAVILY_API_KEY_1", "doppler:TAVILY_API_KEY_2"]
strategy = "random"
```

## Runtime auth

- Development: `doppler login`
- CI / production: `doppler run --token="$DOPPLER_TOKEN" -- ...`
