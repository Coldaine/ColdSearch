# Key Management

**Doppler is the primary secrets manager.** All production and development API keys live there. Bitwarden Secrets Manager (`bws:`) is deprecated and will be removed in a future release.

---

## Supported Secret Reference Schemes

| Scheme | Status | Use Case |
|--------|--------|----------|
| `doppler:SECRET_NAME` | **Preferred** | All environments — dev, CI, production |
| `env:VAR_NAME` | Fallback | Dev only; avoids Doppler setup on a given machine |
| `bws:SECRET_NAME\|UUID` | **Deprecated** | Migration only; remove via `doppler secrets get` |
| Literal string | **Discouraged** | Never commit actual keys to config |

---

## Authentication Patterns by Environment

### Dev Machine

Doppler CLI stores tokens in the OS keyring after one-time `doppler login`. No environment variables needed.

```bash
# One-time setup
doppler login

# Verify auth
doppler me

# Run coldsearch with secrets injected
doppler run -- coldsearch search "query"

# Or with a custom project/config
doppler run --project coldsearch --config dev -- coldsearch search "query"
```

Doppler auto-discovers `doppler.yaml` in the current directory or a parent. Run `doppler setup` in the project root to create one (add to `.gitignore` — never commit it).

### CI / Production

Pass a Doppler service token via `DOPPLER_TOKEN`. Create one scoped to a specific config:

```bash
# Create via Doppler CLI (one-time, in your dev environment)
doppler configs tokens create ci-token \
  --project coldsearch \
  --config prd \
  --plain
```

Store the returned `dp.st.xxx` value as `DOPPLER_TOKEN` in your CI secrets store (GitHub Secrets, etc.). ColdSearch picks it up automatically — no different code path between dev and CI.

```bash
# GitHub Actions pattern
- name: Run ColdSearch
  env:
    DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN }}
  run: doppler run -- coldsearch search "health check"
```

**Never `export DOPPLER_TOKEN=dp.st.xxx`** in shell config files. **Never** commit tokens anywhere.

---

## Runtime Resolution

When `keypool.ts` encounters a secret reference, it resolves it in this order:

```
doppler:SECRET_NAME  →  doppler secrets get SECRET_NAME --plain
env:VAR_NAME         →  process.env[VAR_NAME]
bws:SECRET           →  (deprecated) Bitwarden Secrets Manager
Literal              →  used as-is (never recommended)
```

Resolution happens per-request inside the fanout loop. Keys are held in process memory for the duration of the request, then eligible for GC. No keys are ever written to disk.

---

## Error Messages

| Condition | Error surfaces as |
|-----------|-------------------|
| `doppler:SECRET` but `DOPPLER_TOKEN` not set | `"DOPPLER_TOKEN environment variable not set and no Doppler CLI login found"` |
| `env:VAR` referenced but not set | `"Environment variable VAR is not set"` |
| `bws:SECRET` (deprecated) | `"Bitwarden Secrets Manager support is deprecated; migrate to Doppler"` |
| Key pool is empty | `"Key pool for PROVIDER is empty"` |

---

## Migration: BWS → Doppler

If your config currently has `bws:` references, migrate them:

1. **In Doppler**, create secrets with the same logical names (e.g., `TAVILY_API_KEY_1`).
2. **Update** `config.toml` to use `doppler:SECRET_NAME` instead of `bws:SECRET_NAME`.
3. **Verify** dev auth: `doppler run -- coldsearch status`
4. **Verify** CI auth: push and confirm the CI job succeeds.
5. **Remove** `bws:SECRET` references from the config — no code change needed; the resolver rejects them with a clear deprecation message.

For an automated migration script, see `docs/MIGRATION_BWS_DOPPLER.md`.

---

## Configuring a New Machine

```bash
# 1. Install Doppler CLI (macOS)
brew install doppler-cli

# 2. Authenticate
doppler login

# 3. Navigate to ColdSearch repo
cd ~/GitHub/coldaine-github-repos/ColdSearch

# 4. Setup Doppler project config (creates doppler.yaml locally)
doppler setup

# 5. Confirm secrets are accessible
doppler secrets list
# Should show: TAVILY_API_KEY_1, TAVILY_API_KEY_2, EXA_API_KEY, ...

# 6. Run
doppler run -- coldsearch status
```

---

## Security Properties

| Property | With Doppler |
|----------|-------------|
| Keys in config | ✅ Only secret names, never values |
| Keys in disk | ✅ None (Doppler never writes to disk in `doppler run --` mode) |
| Keys in memory | ⚠️ Resolved at request time, eligible for GC after |
| Key leakage via logs | ⚠️ `safeKeyRef()` strips all but last 4 chars |
| Token on disk | ✅ `doppler login` stores in OS keyring; `DOPPLER_TOKEN` stays in CI secrets only |
| Key rotation | ✅ Update in Doppler; all environments pick up on next run |

---

## Quick Reference

```bash
# Authenticate
doppler login

# Run with secrets injected
doppler run -- coldsearch search "query"

# Fetch a single secret (useful in scripts)
doppler secrets get TAVILY_API_KEY_1 --plain

# List available secrets
doppler secrets list

# Set a new secret
doppler secrets set TAVILY_API_KEY_3 "tvly-xxx"

# Create a service token (CI/production)
doppler configs tokens create ci-token --project coldsearch --config prd --plain

# Verify current auth
doppler me
```
