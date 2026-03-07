# Code Review — 093-vcs-lifecycle-audit-clean-commit-strateg

## Files Reviewed

| File | Change |
|---|---|
| `extensions/megapowers/commands.ts` | Added `maybeSwitchAwayFromIssue` and `resolveActivationBaseBranch` exports; refactored inline logic |
| `extensions/megapowers/vcs/branch-manager.ts` | Added `squashBranchToSingleCommit` intermediate step; refactored `squashAndPush` to delegate to it |
| `extensions/megapowers/vcs/pr-creator.ts` | Added `baseBranch` parameter; reordered `gh pr create` flags to `--base/--head` before `--title/--body` |
| `extensions/megapowers/vcs/shipping.ts` | New file — `auditShipment`, `finalizeShipment`, `validateShipTarget`, `shipAndCreatePR` |
| `extensions/megapowers/vcs/ship-cli.ts` | New file — `buildShipRequest`, `runShipCli`, `import.meta.main` entrypoint |
| `prompts/done.md` | Replaced step-by-step manual VCS instructions with single `bun ship-cli.ts` directive |
| `tests/shipping.test.ts` | New — 11 unit tests for shipment audit, finalize, validate, and full orchestration |
| `tests/vcs-lifecycle-integration.test.ts` | New — 1 end-to-end integration test with a real git repo |
| `tests/vcs-base-branch-activation.test.ts` | New — 1 test for AC1/AC2 base-branch capture |
| `tests/vcs-commands.test.ts` | Extended — activation, switch-away, stale branch detection, remote sync (14 tests) |
| `tests/branch-manager.test.ts` | Extended — ensureBranch, switchAwayCommit, squashAndPush, squashBranchToSingleCommit (10 tests) |
| `tests/ship-cli.test.ts` | New — 1 test for CLI runner contract |
| `tests/pr-creator.test.ts` | Updated — adds `baseBranch` param to existing tests; renames for clarity |
| `tests/done-prompt.test.ts` | New — 1 test verifying done-phase prompt routes through ship-cli |

---

## Strengths

**Architecture**: The `shipping.ts` orchestrator follows a clean pipeline pattern with well-defined discriminated result types (`ShipResult`, `FinalizeShipmentResult`, `ShipTargetResult`). Each step (`validate → finalize → squash → push → pr`) either aborts or passes results forward — no hidden state, no early side effects.

**`auditShipment` design** (`shipping.ts:36-63`): A single `git status --porcelain --untracked-files=all --ignored` call produces all four categories (tracked, includedUntracked, ignoredUntracked, blockedUntracked). The denylist regex `/^\.env(?:\..+)?$/` covering all `.env*` variants plus OS/log junk is well-chosen and commented.

**Integration test** (`tests/vcs-lifecycle-integration.test.ts:40-86`): Validates end-to-end against a real `git init` repo — one commit on the remote branch, correct file contents, no WIP history leakage. This is the right level of confidence for a squash+push flow.

**`pr-creator.ts` hardening** (explicit `--base`/`--head` flags): Previously relied on `gh` to infer the base branch from the current HEAD. Now it passes explicit `--base` and `--head`, which is more robust when HEAD may not be on the expected branch after squash.

**`done.md` simplification**: The old multi-step manual VCS instructions (push → check gh → create PR) are replaced with a single delegating command. This removes a category of LLM error (doing the steps partially or in wrong order).

**`maybeSwitchAwayFromIssue` / `resolveActivationBaseBranch` extraction**: Both functions are now independently testable and exported. The refactoring doesn't change behavior relative to the inlined code but makes it unit-testable without going through the full `handleIssueCommand` fixture.

**`squashBranchToSingleCommit`** (`branch-manager.ts:59-70`): Clean extraction of the squash-only step. Useful for testing the squash path independently of push.

---

## Findings

### Critical

None.

---

### Important

None.

---

### Minor

**1. `commands.ts:70` — `"error" in switchResult` vs `.ok` pattern inconsistency**

```typescript
const switchResult = await switchAwayCommit(execGit, previousBranchName);
if ("error" in switchResult) {           // ← style outlier
  return { ok: false, error: switchResult.error };
}
```

Every other result-check in this codebase uses `if (!result.ok)`. Both forms work (the `WipCommitResult` type has `{ ok: false; error: string }`), but `"error" in switchResult` is a style outlier. Prefer `if (!switchResult.ok)` for consistency.

---

**2. `shipping.ts:89` — Unconditional `add -u` when only untracked files exist**

```typescript
const hasTracked = audit.tracked.length > 0;
const hasIncludedUntracked = audit.includedUntracked.length > 0;
if (!hasTracked && !hasIncludedUntracked) { return ...; }

await execGit(["add", "-u"]);   // ← called even when hasTracked is false
for (const path of audit.includedUntracked) { ... }
```

When a repo has only untracked files to ship (no tracked modifications), `git add -u` is a no-op but is still executed. `git add -u` only stages changes to already-tracked files, so it will do nothing — no harm, no incorrect staging — but it wastes one git subprocess. The fix is a one-liner guard: `if (hasTracked) await execGit(["add", "-u"]);`. The existing test covers this path (`"runs the audit status first..."`) but doesn't assert the absence of the `add -u` call in the untracked-only case.

---

**3. `shipping.ts:113` — Dead comment after `return`**

```typescript
  return { ok: true };
  // Exporting `ShipTargetResult` keeps the orchestration contract explicit for downstream callers/tests.
}
```

The comment on line 113 is unreachable (after `return { ok: true }`). Move it above the return or to the exported type's JSDoc, or remove it.

---

**4. `shipping.test.ts:307-308` — Duplicate assertion**

```typescript
expect(prAttempted).toBe(false);
// Explicit guard verification: PR executor was never invoked after finalize abort.
expect(prAttempted).toBe(false);
```

`prAttempted` is asserted `false` twice in the same test ("returns a finalize error and does not attempt push or PR when finalization blocks shipment"). Delete one of them — duplicate assertions add noise without adding coverage.

---

**5. `ship-cli.ts` — No `process.exit(1)` for failure in `import.meta.main`**

```typescript
if (import.meta.main) {
  ...
  await runShipCli(state, { ... });
  // exit code is always 0 regardless of result
}
```

The `done.md` prompt correctly instructs the LLM to parse the JSON result, so this is the intended interface. However, if this script were ever called from a shell script or CI job that checks exit codes, a failed ship would still return exit 0. Not a bug in the current LLM-driven context, but worth noting for future non-LLM use.

---

**6. `vcs-base-branch-activation.test.ts:36-84` — Two concepts in one test with a fragile shared counter**

The single test `"records branchName/baseBranch on activation success (AC1/AC2)"` tests both `resolveActivationBaseBranch` standalone AND `handleIssueCommand` integration, sharing a single mock whose behavior depends on how many times `rev-parse --abbrev-ref` has already been called:

```typescript
return { stdout: headSequence[Math.min(calls.filter((c) => c[0] === "rev-parse" && c[1] === "--abbrev-ref").length - 1, 1)], stderr: "" };
```

This is correct but fragile to any future change in call ordering. Two separate tests — one for `resolveActivationBaseBranch` alone, one for `handleIssueCommand` base-branch capture — would be clearer and more robust. Not a blocking concern since the test passes and the behavior is correct.

---

## Recommendations

- **`shipping.ts`**: Consider making `blockedFiles` a required field on the `step: "finalize"` discriminant (narrowing the union further) rather than `blockedFiles?: string[]` on all `ok: false` variants. This would be a safe non-breaking refinement.
- **Denylist coverage**: The current denylist covers env files, OS cruft, and log files. Consider adding `.npmrc`, `.pypirc`, `*.pem`, `*.key` in a follow-up if security scanning is a concern. Out of scope for this issue, but a natural extension point.
- **`resolveActivationBaseBranch`**: The hardcoded `"main"` checkout target when on a stale feature branch was pre-existing. A follow-up could detect the repo's default branch dynamically via `git symbolic-ref refs/remotes/origin/HEAD --short`.

---

## Assessment

**ready**

All 18 acceptance criteria are met and verified by tests. The code is clean, well-typed, and follows codebase conventions. Findings are all minor nits (dead comment, duplicate assertion, style inconsistency, unnecessary no-op git call, fragile test mock). None block correctness or safety. The integration test gives strong end-to-end confidence.
