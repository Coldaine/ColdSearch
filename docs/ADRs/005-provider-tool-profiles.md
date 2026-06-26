# ADR 005: Provider Tool Profiles and Feature-Predicate Routing

**Date:** 2026-06-26
**Status:** Accepted

## Context

ColdSearch originally modeled provider coverage as a coarse capability tuple:

```ts
capabilities: ["search", "extract", "crawl"]
```

This says *which broad bucket a provider participates in* but nothing about the
provider-native tool that actually backs the bucket. That gap is dangerous
because provider tools are **not apples-to-apples**:

- Each tool has a different **parameter surface**, different semantics, a
  different cost model, and a different result shape.
- A provider's native tool **name is not authoritative**. Firecrawl `scrape` is
  known-URL retrieval (ColdSearch `extract`); Firecrawl's native `extract`
  endpoint is a *structured-LLM* tool — a different thing. Brave Web Search is
  SERP-style search; Brave LLM Context is search **plus** extracted context
  chunks for LLM grounding.
- A single tool can back **several** categories (Exa `/contents` backs `extract`
  and a synthesized `crawl`), and backing a category can be **partial or lossy**.
- Exa `/search` alone spans `instant` … `deep-reasoning`; flattening that into
  one "search" knob loses real semantic distinctions.

With only the tuple, routing could pick "any provider that claims `search`" even
when the chosen tool cannot honor the request (e.g. domain filters, freshness,
browser actions). The matrix that should sit underneath `search`, `extract`,
`crawl`, and `tool info` was the missing design artifact.

## Decision

**Introduce a provider-tool profile registry and feature-predicate routing,
layered over — not replacing — the existing capability tuple.**

1. **`ProviderToolProfile`** (`src/types.ts`, data in
   `src/registry/tool-profiles.ts`) records, per provider-native tool: native
   name + docs URL, required/optional native params, common-view mappings,
   feature predicates, execution mode (sync / async-job / streaming), output
   envelope (raw always preserved), schema source + last-verified date, and a
   wiring `status` (`wired` / `available` / `deferred`).

2. **`CommonViewMapping`** makes each category mapping explicit: `semanticFit`
   (`direct` / `partial` / `derived` / `not-recommended`), safe option mappings,
   unsupported options, lossy mappings with reasons, and native options that have
   no common equivalent. Partial support is allowed but must be declared.

3. **`CapabilityCategory`** is a superset of `CapabilityName` adding `map`,
   `research`, and `answer` as profile-level category views. `CapabilityName`
   (`search` / `extract` / `crawl`) remains the strict subset actually routed
   through adapters today, so all existing routing, config, and fanout behavior
   is unchanged by default.

4. **Feature-predicate routing.** `resolveEligibleTools(category, { requireFeatures })`
   filters wired tools by feature predicates, and `resolveCapabilityProviders`
   accepts an optional `requireFeatures` that narrows providers to those whose
   wired tool genuinely supports the requested features — failing visibly when
   none qualify.

5. **`coldsearch tool list` / `tool info`** expose the registry offline, so the
   live registry — not stale prose — is the source of truth for native params.

## Alternatives Considered

### Keep only the capability tuple
Rejected. It cannot express native parameters, name collisions, partial/lossy
mappings, or async semantics, so it lets the system lie about what `search`,
`extract`, and `crawl` mean.

### A flat per-provider `features: string[]` list
Rejected. Features belong to a **tool**, not a provider; a provider exposes
several tools with different feature sets (Brave Web Search vs LLM Context).

### Replace `CapabilityName` outright with `CapabilityCategory`
Rejected for now. It would churn routing, config, and fanout for no immediate
behavior gain. The subset relationship lets the richer model land additively.

## Consequences

**Positive:**
- Routing can be requirement-aware instead of "claims the category".
- Name collisions (Firecrawl scrape vs extract; Brave web vs llm-context) are
  encoded and drift-tested, not left to tribal knowledge.
- Unwired tools are recorded as `available`, so the registry cannot lie by
  omission and the roadmap is visible via `tool list`.
- `tool info` keeps parameter docs from going stale.

**Negative:**
- Profiles must be maintained and re-verified against provider docs
  (`schemaLastVerified`), enforced structurally by a drift test.
- Two registries (provider + provider-tool) must stay consistent — also drift-tested.

## Implementation

- `src/types.ts` — `ProviderToolProfile`, `CommonViewMapping`, `CapabilityCategory`,
  `CategoryRequirements`, and supporting enums.
- `src/registry/tool-profiles.ts` — profiles + `getToolProfile`, `listToolProfiles`,
  `resolveEligibleTools`, `wiredToolForProviderCategory`.
- `src/providers.ts` — `resolveCapabilityProviders` gains optional `requireFeatures`.
- `src/cli.ts` — `tool list` / `tool info` (offline, read-only).
- `test/provider-tool-profiles.test.mjs` — structural + behavioral drift checks.
- `docs/contributing/adding-a-provider.md` — the authoring contract.
