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
- Some provider-native tools are deliberately useful **without** backing a
  normalized category at all. Bright Data's site-specific product/company/data
  scrapers are directly callable tools, but flattening their structured schemas
  into generic `extract` would be semantically wrong.
- A single tool can back **several** categories (Exa `/contents` backs `extract`
  and a synthesized `crawl`), and backing a category can be **partial or lossy**.
- Exa `/search` alone spans `instant` … `deep-reasoning`; flattening that into
  one "search" knob loses real semantic distinctions.

With only the tuple, routing could pick "any provider that claims `search`" even
when the chosen tool cannot honor the request. A separate profile layer is also
needed to describe provider-native tools that should remain explicit rather than
enter normalized routing.

## Decision

**Introduce a provider-tool profile registry and feature-predicate routing,
layered over — not replacing — the existing capability tuple.**

1. **`ProviderToolProfile`** (`src/types.ts`, data in
   `src/registry/tool-profiles.ts` and focused provider-specific registry modules)
   records, per provider-native tool: native name + docs URL, required/optional
   native params, common-view mappings, feature predicates, execution mode
   (sync / async-job / streaming), output envelope (raw always preserved), schema
   source + last-verified date, and a wiring `status`:

   - `wired` — implemented as an adapter-backed normalized category tool.
   - `direct` — implemented and callable through `coldsearch tool call`, but
     deliberately **not** a normalized category backer.
   - `available` — documented upstream surface that is not implemented yet.
   - `deferred` — intentionally not built (for example niche or high-risk work).

   This distinction prevents the registry from calling an implemented direct tool
   "available" while also preventing provider-specific structured tools from
   entering generic routing merely because they are callable.

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
   filters **`wired`** tools by feature predicates, and `resolveCapabilityProviders`
   accepts an optional `requireFeatures` that narrows providers to those whose
   normalized backer genuinely supports the requested features. `direct` tools
   never become eligible for normalized routing solely because they are callable.

5. **`coldsearch tool list` / `tool info`** expose the registry offline, so the
   live registry — not stale prose — is the source of truth for native params and
   whether a tool is normalized (`wired`) or provider-native-only (`direct`).

## Alternatives Considered

### Keep only the capability tuple
Rejected. It cannot express native parameters, name collisions, partial/lossy
mappings, async semantics, or explicit provider-native tools that should not back
a category.

### Treat every implemented direct tool as `wired`
Rejected. `wired` is the routing signal for normalized category backers. Marking
a product scraper `wired` would invite accidental use as generic `extract` even
though its schema and semantics are site-specific.

### Treat directly callable tools as `available`
Rejected once the generic `tool call` substrate existed. `available` means the
upstream surface is documented but not implemented; using it for executable tools
makes `tool info` factually wrong.

### A flat per-provider `features: string[]` list
Rejected. Features belong to a **tool**, not a provider; a provider exposes
several tools with different feature sets.

### Replace `CapabilityName` outright with `CapabilityCategory`
Rejected for now. It would churn routing, config, and fanout for no immediate
behavior gain. The subset relationship lets the richer model land additively.

## Consequences

**Positive:**
- Routing can be requirement-aware instead of "claims the category".
- Direct provider-native power can be exposed without corrupting normalized
  category semantics.
- Name collisions are encoded and drift-tested, not left to tribal knowledge.
- Unimplemented upstream tools are recorded as `available`, while implemented
  provider-native-only tools are truthfully recorded as `direct`.
- `tool info` keeps parameter docs from going stale.

**Negative:**
- Profiles must be maintained and re-verified against provider docs
  (`schemaLastVerified`), enforced structurally by tests.
- Provider and provider-tool registries must stay consistent.
- Callers that intentionally use `direct` tools own their provider-native
  semantics; ColdSearch does not pretend those results are portable categories.

## Implementation

- `src/types.ts` — `ProviderToolProfile`, `CommonViewMapping`, `CapabilityCategory`,
  `CategoryRequirements`, `ToolWiringStatus`, and supporting enums.
- `src/registry/tool-profiles.ts` — core profiles + `getToolProfile`,
  `listToolProfiles`, `resolveEligibleTools`, `wiredToolForProviderCategory`.
- Provider-specific profile modules may extend the same runtime registry when a
  provider has a large native tool surface (for example Bright Data).
- `src/providers.ts` — `resolveCapabilityProviders` gains optional `requireFeatures`.
- `src/cli.ts` — `tool list` / `tool info` (offline, read-only).
- `test/provider-tool-profiles.test.mjs` — structural + behavioral drift checks.
- `docs/contributing/adding-a-provider.md` — the authoring contract.
