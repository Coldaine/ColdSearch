# Summary

- describe the change
- describe why it exists

## Checklist

- [ ] updated `docs/PROVIDERS.md` if provider support, coverage, or routing changed
- [ ] added or updated tests for behavior changes
- [ ] called out any secret, config, or migration impact

## Merge protocol

`main` requires the **`merge-gate`** check: a ~15-min cooldown since the head commit, **plus** an attestation comment. After reading all checks and review comments, post a **comment** (not this body) containing exactly:

> I have read all checks and review comments on this PR and affirm I have addressed all valid findings.

If `merge-gate` is red, its summary shows the remaining cooldown + this phrase. CodeRabbit and other review bots are advisory — read them and address valid findings, but the merge does not require them to be green. See `AGENTS.md` → "Merge protocol".
