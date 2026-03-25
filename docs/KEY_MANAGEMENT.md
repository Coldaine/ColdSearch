# Key Management & Security Documentation

## Current State (As Built)

### Key Storage

**Where keys are stored:**
- **Environment variables** - `env:VAR_NAME` references
- **Bitwarden Secrets Manager** - `bws:SECRET_NAME` or `bws:SECRET_ID` references (NEW)
- **Config file** (`~/.config/usearch/config.toml`) only stores key **references**, not actual keys
- **In-memory** - Keys are resolved at runtime and held in memory during request processing

### Supported Key References

```toml
# Environment variable
keys = ["env:TAVILY_API_KEY"]

# Bitwarden Secrets Manager - by name
keys = ["bws:tavily-production-key"]

# Bitwarden Secrets Manager - by ID
keys = ["bws:550e8400-e29b-41d4-a716-446655440000"]
```

**Security characteristics:**
```toml
[providers.tavily.keyPool]
keys = ["env:TAVILY_KEY_1", "env:TAVILY_KEY_2"]  # References only
strategy = "random"
```

```bash
# Actual keys in environment
export TAVILY_KEY_1="tvly-..."
export TAVILY_KEY_2="tvly-..."
```

| Aspect | Status | Notes |
|--------|--------|-------|
| Keys in repo | ✅ Safe | Only `env:` references |
| Keys in config file | ✅ Safe | Only `env:` references |
| Keys in memory | ⚠️ Vulnerable | Resolved at runtime, not encrypted |
| Key logging | ⚠️ Risk | No explicit protection against logging |
| Key rotation | ✅ Supported | Round-robin or random selection |

### Current Key Pool (As Configured)

Based on `config.example.toml`:

| Provider | Keys Configured | Strategy | API Required |
|----------|-----------------|----------|--------------|
| **Tavily** | 2 keys (`TAVILY_KEY_1`, `TAVILY_KEY_2`) | `random` | ✅ Yes |
| **Exa** | 1 key (`EXA_API_KEY`) | default | ✅ Yes |
| **Brave** | 1 key (`BRAVE_API_KEY`) | default | ✅ Yes |
| **Serper** | 1 key (`SERPER_API_KEY`) | default | ✅ Yes |
| **Jina** | 0 keys | - | ❌ No (free tier) |
| **Firecrawl** | 1 key (`FIRECRAWL_API_KEY`) | default | ✅ Yes |

**Total API keys in rotation: 6 keys across 5 providers**

### Key Rotation (Implemented)

**Per-request random selection:**
```typescript
// keypool.ts
if (strategy === "random") {
  keyIndex = Math.floor(Math.random() * pool.keys.length);
}
```

**What this achieves:**
- Distributes load across multiple keys
- Reduces chance of hitting rate limits on single key
- No guarantee of equal distribution (random is random)

**What's missing:**
- No tracking of which key was used for which request
- No quota awareness (may exhaust one key while others sit idle)
- No automatic failover when a key is exhausted

---

## Usage Tracking (NOT IMPLEMENTED)

### Current Gap

**We have ZERO visibility into:**
- Remaining quota per key
- Requests made per key
- Cost per request
- Which key failed and why
- Historical usage patterns

### Why This Matters

| Provider | Free Tier | Paid Tier | Rate Limit |
|----------|-----------|-----------|------------|
| Tavily | 1,000 credits/mo | $0.008/credit | 1,000 req/min |
| Exa | $10 credits | $5/1K searches | Varies |
| Brave | 2,000 queries/mo | $3/1K queries | 1 QPS free |
| Serper | 2,500 credits | $50/50K credits | Unknown |
| Jina | 1M tokens free | ~$0.02/M tokens | 100 RPM |
| Firecrawl | 500 credits | ~$0.005/credit | Varies |

**Without tracking, you will:**
- Hit rate limits unexpectedly
- Exhaust credits on one key while others have plenty
- Have no visibility into costs
- Fail requests with no warning

---

## What's Missing (Phase 5: Harden)

### 1. Quota-Aware Key Rotation

**Current:** Random pick from available keys  
**Needed:** Pick key with most remaining quota

```typescript
// Proposed
interface KeyState {
  key: string;
  remainingQuota: number;
  lastUsed: Date;
  errorCount: number;
  isExhausted: boolean;
}

// Select key with max remaining quota
const key = keys
  .filter(k => !k.isExhausted)
  .sort((a, b) => b.remainingQuota - a.remainingQuota)[0];
```

### 2. Usage Persistence

**Current:** Nothing persisted  
**Needed:** SQLite or file-based tracking

```typescript
// Proposed schema
interface UsageRecord {
  timestamp: Date;
  provider: string;
  keyIndex: number;
  operation: 'search' | 'extract' | 'crawl';
  cost: number;  // In provider credits
  success: boolean;
  error?: string;
}
```

**Storage options:**
- SQLite: `~/.config/usearch/usage.db`
- JSONL: `~/.config/usearch/usage.jsonl`
- External: PostHog, analytics service

### 3. Provider-Specific Quota Fetching

**Challenge:** Each provider has different quota APIs

| Provider | Quota Endpoint | Auth |
|----------|---------------|------|
| Tavily | ❌ No API | - |
| Exa | ❌ No API | - |
| Brave | ❌ No API | - |
| Serper | ❌ No API | - |
| Jina | ❌ No API | - |
| Firecrawl | ❌ No API | - |

**Reality:** Most providers don't expose quota via API.  
**Workaround:** Track usage client-side, estimate remaining.

### 4. Pre-Request Quota Check

```typescript
// Before making request
if (estimatedRemaining < SAFETY_THRESHOLD) {
  // Try next key
  // Or throw "All keys near exhaustion"
}
```

### 5. Secure Key Storage Alternatives

**Current:** Environment variables  
**Alternatives:**

| Method | Security | Complexity | Use Case |
|--------|----------|------------|----------|
| Environment vars | Low | Low | Dev/local |
| 1Password CLI | High | Medium | Personal |
| AWS Secrets Manager | High | High | Production AWS |
| HashiCorp Vault | High | High | Enterprise |
| macOS Keychain | Medium | Medium | Mac dev |
| systemd credentials | Medium | Medium | Linux prod |

---

## Recommended Setup (Production)

### 1. Environment Isolation

```bash
# .env.local (never commit)
TAVILY_KEY_1="tvly-..."
TAVILY_KEY_2="tvly-..."
EXA_API_KEY="..."
BRAVE_API_KEY="..."
SERPER_API_KEY="..."
FIRECRAWL_API_KEY="fc-..."
```

```gitignore
# .gitignore
.env*
*.key
config.toml  # If it contains real keys
```

### 2. Multiple Key Strategy

```toml
# config.toml
[providers.tavily.keyPool]
keys = [
  "env:TAVILY_PROD_1",   # Primary
  "env:TAVILY_PROD_2",   # Secondary
  "env:TAVILY_BACKUP",   # Emergency
]
strategy = "random"
```

### 3. Usage Monitoring (To Be Implemented)

```bash
# Check usage
usearch status --provider tavily

# Output:
# Tavily Key 1: 450/1000 credits remaining (45 days left)
# Tavily Key 2: 980/1000 credits remaining (12 days left)
```

### 4. Alerts (To Be Implemented)

```bash
# Configure alerts
usearch config set alert.threshold 100  # Alert at 100 credits remaining
usearch config set alert.webhook "https://hooks.slack.com/..."
```

---

## Action Items

### Immediate (Do Now)
- [ ] Verify `.env` files are in `.gitignore`
- [ ] Confirm no keys in shell history (`history | grep -E "(tvly-|fc-)"`)
- [ ] Document actual key count in `~/.config/usearch/.keys` (secure file)

### Short Term (This Week)
- [ ] Implement usage logging to JSONL
- [ ] Add `--dry-run` flag to estimate cost
- [ ] Create `usearch status` command

### Medium Term (This Month)
- [ ] Build quota estimation from usage patterns
- [ ] Add provider health checks
- [ ] Implement key exhaustion alerts

### Long Term (Phase 5)
- [ ] SQLite usage database
- [ ] Provider-specific quota fetching (if APIs become available)
- [ ] Automatic key suspension on exhaustion
- [ ] Integration with secrets managers

---

## Key Inventory Template

Create `~/.config/usearch/.keys` (chmod 600):

```
Provider: Tavily
- Key 1: tvly-****XXXX (last 4: XXXX) - 450/1000 credits
- Key 2: tvly-****YYYY (last 4: YYYY) - 980/1000 credits

Provider: Exa
- Key 1: ****ZZZZ - $7.50 remaining

Provider: Firecrawl
- Key 1: fc-****AAAA - 320/500 credits

Last Updated: 2026-03-24
```

**Keep this file secure and updated manually until automated tracking is built.**
