# ADR 004: SSRF Protection in Agent Fetch

**Date:** 2026-05-28
**Status:** Accepted

## Context

Agent mode (`--agent`) lets the LLM call a `fetch("url")` tool to read arbitrary
URLs while researching. The URL is chosen by the model from untrusted search
results, so it is effectively attacker-influenceable input. Without controls, a
crafted page or prompt could steer the agent into Server-Side Request Forgery
(SSRF): fetching `http://169.254.169.254/…` (cloud instance metadata),
`http://localhost:…` (internal admin endpoints), or RFC 1918 hosts reachable
from wherever ColdSearch runs.

The agent must still be able to fetch the open web, so a pure allowlist is too
restrictive. We need a deny-by-default network policy that blocks private,
loopback, link-local, and metadata targets while letting genuine public URLs
through.

## Decision

**Validate every fetch target through layered checks before connecting, and pin
the connection to the validated IP** — implemented in `validateFetchUrl()` and
`fetchValidatedBody()` in `src/agent/agent.ts`.

Layers, in order:

1. **Protocol allowlist** — only `http:` and `https:` are accepted; anything
   else (e.g. `file:`, `ftp:`, `gopher:`) is rejected.
2. **Hostname blocklist** — `localhost`, any `*.localhost`, `metadata`,
   `metadata.google.internal`, and the literal `169.254.169.254` are refused
   outright (bracketed IPv6 literals are unwrapped first).
3. **Literal-IP blocking** — if the host is an IP literal, it is checked against
   the blocked ranges below before any DNS step.
4. **DNS resolution validation** — the host is resolved with `dns.lookup(host,
   { all: true })`; if **any** returned address falls in a blocked range, the
   fetch is refused (fail-closed).
5. **Address pinning (anti-rebinding)** — the request connects to the exact
   address that passed validation via a custom `lookup` callback, so a second
   DNS query cannot return a different (internal) address between validation and
   connection. This closes the DNS-rebinding TOCTOU gap.
6. **Response limits** — a 10 s timeout (`AGENT_FETCH_TIMEOUT_MS`), a 1 MiB body
   cap (`MAX_FETCH_BODY_BYTES`, enforced while streaming), and a content-type
   allowlist (`text/html`, `application/xhtml+xml`, `text/*`).

### Blocked ranges

| Family | Blocked |
|--------|---------|
| IPv4 | `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0/8` |
| IPv6 | `::1`, `::`, `fc00::/7` (ULA, `fc`/`fd`), link-local (`fe80::/10` → `fe8`/`fe9`/`fea`/`feb`), and IPv4-mapped (`::ffff:a.b.c.d` / `::ffff:hhhh:hhhh`) which are unwrapped and re-checked against the IPv4 rules |

### Redirects

Redirects are **not** followed. `fetchValidatedBody()` rejects any non-2xx
response, so a `3xx` to an internal Location cannot bypass validation. This is
deliberate: following redirects safely would require re-running the full
validation on each hop, and the agent does not need redirect support to read
public pages.

## Alternatives Considered

### Allowlist of permitted domains
Rejected. A research agent needs the open web; maintaining a domain allowlist
would cripple it and require constant edits.

### Third-party SSRF/validation library
Rejected for now. The check is small and auditable in one file; adding a
dependency for it increases supply-chain surface for little gain.

### Egress filtering at the network layer (proxy / firewall)
Deferred. This is the strongest mitigation but is an infrastructure concern
outside the CLI. Application-layer checks are necessary regardless, since
ColdSearch runs on developer machines and CI without a controlled egress proxy.

### Following redirects with per-hop validation
Deferred. Adds complexity (re-validate + re-pin each hop) for a capability the
agent does not currently need. Revisit if real public sources are commonly
missed because they redirect.

## Consequences

**Positive:**
- Deny-by-default: private, loopback, link-local, and cloud-metadata targets are
  blocked before a connection is opened.
- DNS-rebinding resistant via address pinning.
- IPv4-mapped IPv6 (`::ffff:127.0.0.1`) cannot be used to smuggle a blocked IPv4
  address past the filter.
- Bounded blast radius on response handling (timeout, size cap, content-type).

**Negative / known gaps:**
- **IPv6 coverage is prefix-heuristic**, not a full range parser; exotic
  representations of reserved ranges may not all be caught.
- **Not every IANA special-use IPv4 range is blocked** — e.g. `100.64.0.0/10`
  (CGNAT), `192.0.2.0/24`, `198.18.0.0/15`. Add ranges as needed.
- **No port restriction** beyond protocol — a public IP on a non-standard port
  is reachable.
- **Redirecting public URLs fail** rather than resolve (see Redirects above).
- DNS pinning trusts the first validated address; hosts mixing public and
  private addresses are refused entirely (intended fail-closed behavior).

## Implementation

- `src/agent/agent.ts`
  - `SearchAgent.fetchContent()` — entry point for the `fetch` tool
  - `validateFetchUrl()` — protocol, hostname, literal-IP, and DNS checks
  - `fetchValidatedBody()` — pinned connection, non-2xx rejection, size/type limits
  - `isBlockedIpAddress()` / `isIPv4InCidr()` / `extractIPv4FromMapped()` — range logic
  - `isBlockedHostname()` / `normalizeHostname()` — hostname rules
- Tests: agent SSRF cases live in the agent test suite (see `docs/contributing/testing.md` — "Security (agent SSRF, capability validation)" is a keep-forever invariant).
