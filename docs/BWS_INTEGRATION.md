# Bitwarden Secrets Manager (BWS) Integration

## Overview

usearch now supports **Bitwarden Secrets Manager** as a secure key storage backend alongside environment variables. Store your API keys in BWS and reference them by name or ID in your configuration.

## Why BWS?

| Feature | Environment Variables | BWS |
|---------|----------------------|-----|
| Encryption at rest | ❌ No | ✅ Yes |
| Access audit logs | ❌ No | ✅ Yes |
| Centralized rotation | ❌ No | ✅ Yes |
| Team sharing | ❌ No | ✅ Yes |
| Machine accounts | ❌ N/A | ✅ Yes |
| Works without env vars | ❌ No | ✅ Yes |

## Quick Start

### 1. Install BWS CLI

```bash
# macOS
brew install bitwarden/bws/bws

# Windows
choco install bws

# Linux
npm install -g @bitwarden/bws
```

### 2. Create Machine Account

```bash
# Login to Bitwarden (web)
# Go to: Admin Console → Machine Accounts → New Machine Account
# Assign to projects with your secrets
# Generate Access Token
```

### 3. Store Secrets in BWS

```bash
# Set up BWS CLI
export BWS_ACCESS_TOKEN="0.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.xxxxxx:xxxxxx"

# Create secrets
bws secret create TAVILY_API_KEY_PROD "tvly-..." --project-id "xxx"
bws secret create TAVILY_API_KEY_BACKUP "tvly-..." --project-id "xxx"
bws secret create EXA_API_KEY "xxx" --project-id "xxx"
```

### 4. Configure usearch

```toml
# ~/.config/usearch/config.toml

[providers.tavily.keyPool]
# Reference BWS secrets by name
keys = [
  "bws:TAVILY_API_KEY_PROD",
  "bws:TAVILY_API_KEY_BACKUP"
]
strategy = "random"

[providers.exa.keyPool]
keys = ["bws:EXA_API_KEY"]
```

### 5. Set Environment Variables

```bash
# Required for BWS authentication
export BWS_ACCESS_TOKEN="0.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.xxxxxx:xxxxxx"
export BWS_ORGANIZATION_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Optional: BWS settings
export BWS_SERVER_URL="https://api.bitwarden.com"  # Default
```

### 6. Run usearch

```bash
usearch search "machine learning"
# Keys automatically retrieved from BWS
```

## Key Reference Formats

### Environment Variable (Existing)
```toml
keys = ["env:TAVILY_API_KEY"]
```
Resolves to: `process.env.TAVILY_API_KEY`

### BWS by Name (Recommended)
```toml
keys = ["bws:tavily-api-key-prod"]
```
- Looks up secret by `key` (name) field
- Requires `BWS_ORGANIZATION_ID` env var
- Cached after first lookup (per process)

### BWS by ID (Fastest)
```toml
keys = ["bws:550e8400-e29b-41d4-a716-446655440000"]
```
- Direct UUID lookup
- No organization ID needed
- No caching needed (direct fetch)

### Plain Value (Not Recommended)
```toml
keys = ["tvly-actual-api-key-here"]
```
- Stored directly in config
- **Security risk**: Config may be committed to git

## BWS Authentication

### Access Token Format
```
0.<client_id>.<client_secret>.<encryption_key>
```

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BWS_ACCESS_TOKEN` | ✅ Yes | Machine account access token |
| `BWS_ORGANIZATION_ID` | ⚠️ For name lookups | Your Bitwarden org UUID |
| `BWS_SERVER_URL` | ❌ Optional | Custom BWS server |

### Getting Your Organization ID

```bash
# Using BWS CLI
bws organization list

# Output:
# ID                                    Name
# ------------------------------------  -----------------
# xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  My Organization
```

## Architecture

```
usearch search "query"
       │
       ▼
┌─────────────────────────────┐
│  KeyPoolManager             │
│  - Pick random key ref      │
│  - "bws:tavily-api-key"     │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  resolveKeyRef()            │
│  - Detects "bws:" prefix    │
│  - Calls BWSSecretResolver  │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  BWSSecretResolver          │
│  - Authenticates with BWS   │
│  - Checks name→ID cache     │
│  - Fetches secret value     │
└────────────┬────────────────┘
             │
             ▼
       Secret Value
             │
             ▼
        API Request
```

## Caching Behavior

### Name → ID Cache
When looking up by name:
1. First call: List all secrets, build name→ID map
2. Subsequent calls: Use cached ID
3. Cache lifetime: Process lifetime (in-memory)

**Why cache?** BWS `list()` returns all secret metadata. Caching avoids repeated API calls.

### Cache Invalidation
- Cache cleared on process restart
- No automatic refresh (restart to refresh)

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `BWS access token required` | `BWS_ACCESS_TOKEN` not set | Export the token |
| `Organization ID required` | Name lookup without org ID | Set `BWS_ORGANIZATION_ID` |
| `Secret "X" not found` | Wrong name or no access | Check BWS permissions |
| `Secret X not found` | Wrong UUID | Verify secret ID |
| `401 Unauthorized` | Invalid token | Regenerate access token |

## Security Considerations

### ✅ Best Practices
- Use machine accounts (not personal accounts)
- Grant least-privilege access (read-only if possible)
- Rotate access tokens regularly
- Use secret names (not IDs) for readability
- Store `BWS_ACCESS_TOKEN` in 1Password/shell profile, not config

### ⚠️ Warnings
- Secret values are held in memory during requests
- Secret values may appear in crash logs
- BWS access token is as powerful as the secrets it can access
- Cache means name lookups use stale data (secrets added mid-process won't be found)

### 🔒 Threat Model
| Threat | Mitigation |
|--------|------------|
| Config file leaked | Only contains references, not actual keys |
| Memory dump | Keys in memory temporarily (during request) |
| BWS token leaked | Rotate token, revoke old one |
| Man-in-the-middle | BWS uses HTTPS, certificates pinned |

## Migration Guide

### From Environment Variables to BWS

**Before:**
```toml
# config.toml
[providers.tavily.keyPool]
keys = ["env:TAVILY_API_KEY"]
```

```bash
# .bashrc
export TAVILY_API_KEY="tvly-..."
```

**After:**
```toml
# config.toml
[providers.tavily.keyPool]
keys = ["bws:tavily-api-key"]
```

```bash
# .bashrc
export BWS_ACCESS_TOKEN="0..."
export BWS_ORGANIZATION_ID="..."
```

```bash
# One-time: Store in BWS
bws secret create TAVILY_API_KEY "tvly-..."
```

### Mixed Setup
You can mix env vars and BWS:
```toml
[providers.tavily.keyPool]
keys = [
  "env:TAVILY_API_KEY_PROD",      # From env
  "bws:tavily-api-key-backup"     # From BWS
]
```

## Troubleshooting

### Debug Mode
```bash
# Enable verbose logging
DEBUG=bws usearch search "query"
```

### Verify BWS Access
```bash
# Test BWS CLI
bws secret list

# Should show your secrets
```

### Test Key Resolution
```bash
# Dry-run mode (if implemented)
usearch config test --provider tavily
```

## Provider-Specific Notes

### Jina
Jina doesn't require an API key. Use empty keys array:
```toml
[providers.jina.keyPool]
keys = []
```

### Multiple Keys
Rotate between multiple BWS secrets:
```toml
[providers.tavily.keyPool]
keys = [
  "bws:tavily-key-1",
  "bws:tavily-key-2",
  "bws:tavily-key-3"
]
strategy = "random"
```

## Comparison: Storage Backends

| Feature | `env:` | `bws:` | Plain |
|---------|--------|--------|-------|
| Encrypted at rest | ❌ | ✅ | ❌ |
| Audit logging | ❌ | ✅ | ❌ |
| Team sharing | ❌ | ✅ | ❌ |
| Works offline | ✅ | ❌ | ✅ |
| Startup latency | None | ~100-500ms | None |
| Complexity | Low | Medium | Lowest |
| Security | Medium | High | Low |

## Future Enhancements

- [ ] BWS secret caching to disk (encrypted)
- [ ] Automatic token refresh
- [ ] Multiple BWS organizations
- [ ] Secret version history
- [ ] BWS secret creation from CLI

## References

- [Bitwarden Secrets Manager Docs](https://bitwarden.com/products/secrets-manager/)
- [BWS CLI Reference](https://bitwarden.com/help/secrets-manager-cli/)
- [BWS SDK for Node.js](https://github.com/bitwarden/sdk)
