# Code Review — Issue 091: Tighten Git/GH Lifecycle

## Files Reviewed

- `extensions/megapowers/vcs/sync-check.ts` *(new)* — `checkBranchSync` helper: remote detection, fetch, rev-list parsing
- `extensions/megapowers/commands.ts` *(modified)* — stale branch detection and remote sync prompt in `handleIssueCommand`
- `tests/sync-check.test.ts` *(new)* — 4 unit tests covering all `checkBranchSync` scenarios
- `tests/vcs-commands.test.ts` *(modified)* — 6 new integration tests for AC1 and AC7–AC10
- `prompts/done.md` *(modified)* — updated push-and-pr and close-issue action guidance

---

## Strengths

**`sync-check.ts` is clean and well-scoped.** The three-phase structure (remote check → fetch → rev-list) maps clearly to the AC, each with an appropriate catch. The fail-open design for fetch failures (`sync-check.ts:26-29`) is safe for offline/CI scenarios.

**Layered guards in `commands.ts` are correct.** The stale-branch check runs only on fresh activation (`!prevState.branchName`), doesn't interfere with issue-switch flows, and the sync check correctly runs after stale-checkout — so if the user was on `feat/old`, we checkout main *then* verify main is up-to-date. Both behaviors compose well.

**`ctx.ui.select` guard at `commands.ts:99`** is correct — `select` is a pi context UI method not guaranteed in headless sessions, distinct from `notify`. Other callers in ui.ts follow the same `ctx.ui.select(...)` pattern after checking `ctx.hasUI`.

**Test quality is high.** The vcs-commands tests use `calls[]` arrays to verify ordering (checkout main comes before checkout -b, `commands.ts:298-300`), not just existence of calls. The sync-check tests use precise mocks that only respond to the exact args the implementation produces — they test real logic, not hollow mocks.

**done.md changes are clear and actionable.** The step-by-step structure (push → check gh → create PR) makes it unambiguous for the LLM. The failure paths for each gh scenario are spelled out explicitly.

---

## Findings

### Critical
None.

### Important
None.

### Minor

**`commands.ts:97` — redundant `deps.execGit` guard**

```typescript
if (baseBranch && deps.execGit) {   // deps.execGit already confirmed truthy at line 66
```

`deps.execGit` is already guaranteed truthy — we're inside `if (deps.execGit && ...)` from line 66. The redundant check adds noise without value. Not a bug, but inconsistent with the rest of the block which calls `deps.execGit(...)` directly.

**`sync-check.ts:6` — `ahead` is computed but never acted on**

The `ahead` field is part of the `BranchSyncStatus` type and is returned, but no caller reads it or takes action on it. It's technically YAGNI — though it's explicitly required by AC2's type signature, making it a spec decision rather than an implementation over-engineering. Documented here for awareness if the type is ever audited.

**`sync-check.ts:38-39` — double-default pattern is slightly redundant**

```typescript
const ahead = parseInt(parts[0] ?? "0", 10) || 0;
```

`parts[0] ?? "0"` guards against undefined (unnecessary since `split` always returns at least one element). `parseInt("", 10) || 0` handles the empty-string case anyway. Could be simplified to `parseInt(parts[0] ?? "", 10) || 0` or `Number(parts[0]) || 0`. Functionally identical.

---

## Recommendations

- The `deps.execGit` guard at `commands.ts:97` can be removed in a future cleanup — it's the only redundant guard in the VCS block.
- If `ahead` is never intended to be used, consider whether the field should remain on the public type or be removed at a future point when/if callers are added.

---

## Assessment

**ready**

The implementation is correct, well-tested, and follows project conventions throughout. Error handling is appropriately fail-open. The done.md changes are clear and additive without breaking the existing prompt structure. All 14 acceptance criteria verified passing. No blocking issues found. The three minor findings are all cosmetic and do not warrant blocking merge.
