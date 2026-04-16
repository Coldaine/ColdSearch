# Provider Adoption Plan Template

Copy this file to `docs/plans/<provider>.md` for any new provider.

## Objective

Describe what capability coverage this provider should add (search/extract/crawl), and why it matters to ColdSearch routing policy.

## Product Constraints

- List constraints that should not be violated (e.g. no localhost assumptions, config-over-code, key handling rules).

## Scope

### In scope

- `src/adapters/<provider>.ts`
- provider registry entry in `src/providers.ts`
- provider doc in `docs/providers/<provider>.md`
- `docs/CAPABILITY_MATRIX.md`
- tests that enforce contract behavior and docs sync

### Out of scope

- List explicit non-goals for this adoption pass.

## Runtime Contract

- Provider name: `<provider>`
- Capabilities: `search` / `extract` / `crawl`
- Required configuration: list required keys and options
- Key pool: describe whether keys are required and how they are referenced
- Errors: describe expected error behavior for missing config/auth/capability

## Verification

1. Add config entries and keys.
2. Run representative CLI commands per capability.
3. Confirm normalized output shapes.
4. Confirm CI docs-sync checks pass.

## Follow-up Questions

- List unanswered questions that should be resolved before marking this provider “complete”.

