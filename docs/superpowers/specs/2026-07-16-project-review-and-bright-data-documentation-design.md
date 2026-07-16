# Project Review and Bright Data Documentation Design

**Date:** 2026-07-16  
**Status:** Approved

## Purpose

Capture the verified project review and Bright Data account findings in durable repository documentation without mixing dated operational state into ColdSearch's evergreen authority documents.

## Documentation Shape

1. Add a dated review under `docs/reviews/` containing the complete evidence-backed snapshot: project intent, current implementation state, Bright Data account facts, safe-use guardrails, issue and pull-request reconciliation, memory drift, validation evidence, and recommended next actions.
2. Make narrow corrections to evergreen documents:
   - `docs/architecture.md` corrects the stale statement that provider-tool execution is still a next step.
   - `docs/PROVIDERS.md` records Bright Data as a candidate, not a supported provider, and defines the evidence and cost-control gates required before implementation.
3. Refresh the remaining implementation master plan with a dated status note showing which PR1 work landed, which open PR is superseded, and where active implementation resumes.
4. Add README routing so contributors can find the dated review and understand which documents are authoritative.
5. Leave `docs/NORTH_STAR.md` unchanged because its intent, goals, anti-goals, and pillars already match the reviewed project direction.

## Data Boundaries

- Dated account balances, promotional-credit details, issue state, PR state, and test results belong only in the dated review.
- Evergreen provider documentation describes Bright Data as a candidate and must not imply that an adapter, credential path, or live verification exists.
- No Bright Data request, proxy session, scrape, crawl, browser action, or provider API call is authorized by this documentation task.
- The earlier Bright Data retail-pricing guidance is adjacent evidence, not ColdSearch product authority.

## Bright Data Adoption Guardrails

The documentation will map Bright Data capabilities to ColdSearch category views while keeping the provider disabled from default routing until implementation and verification exist:

- SERP/search products may back `search`.
- Web Unlocker or page retrieval may back `extract`.
- Crawling products may back `crawl`.
- Structured datasets and browser/proxy products remain provider-native tools with explicit opt-in.
- Any future implementation requires request and spend caps, usage logging, secret-safe configuration, provider-native comparison evidence, and no paid live CI.

## Validation

Run `npm run build`, `npm test`, `npm run test:docs`, `git diff --check`, link/path inspection, and a final PR diff review. After publication, inspect checks, flat comments, reviews, and unresolved review threads before reporting completion.

