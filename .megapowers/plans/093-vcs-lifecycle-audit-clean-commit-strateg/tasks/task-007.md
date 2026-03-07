---
id: 7
title: Extract squash-only shipping step and stop on squash failures
status: approved
depends_on:
  - 4
  - 5
  - 6
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/branch-manager.ts
  - tests/branch-manager.test.ts
files_to_create: []
---

### Task 7: Extract squash-only shipping step and stop on squash failures [depends: 4, 5, 6]
**Covers:** AC12, AC13

**Files:**
- Modify: `extensions/megapowers/vcs/branch-manager.ts`
- Test: `tests/branch-manager.test.ts`

**Step 1 — Write the failing test**
In `tests/branch-manager.test.ts`, update the existing header import:

```ts
import {
  ensureBranch,
  switchAwayCommit,
  squashAndPush,
  squashBranchToSingleCommit,
} from "../extensions/megapowers/vcs/branch-manager.js";
```

Then append this test:

```ts
it("soft-resets onto the base branch and writes one clean squash commit", async () => {
  const calls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    calls.push(args);
    if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
    return { stdout: "", stderr: "" };
  };

  const result = await squashBranchToSingleCommit(execGit, "main", "feat: ship 093");

  expect(result).toEqual({ ok: true, committed: true });
  expect(calls).toEqual([
    ["reset", "--soft", "main"],
    ["status", "--porcelain"],
    ["commit", "-m", "feat: ship 093"],
  ]);
});
```

The existing `returns step: squash when squash fails` test stays in place and continues to cover the stop-on-squash-failure path.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/branch-manager.test.ts -t "soft-resets onto the base branch and writes one clean squash commit"`
Expected: FAIL — `SyntaxError: Export named 'squashBranchToSingleCommit' not found in module '../extensions/megapowers/vcs/branch-manager.js'`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/vcs/branch-manager.ts`, preserve the existing import because `ensureBranch()` and `switchAwayCommit()` still need `createBranch`, `checkoutBranch`, and `wipCommit`:

```ts
import { createBranch, checkoutBranch, wipCommit, squashOnto, pushBranch, type ExecGit, type WipCommitResult } from "./git-ops.js";
```

Keep the existing `SquashAndPushResult` declaration, add a new squash-only result type, and refactor the existing `squashAndPush()` to call the new helper instead of duplicating or redefining the public API:

```ts
export type SquashStepResult =
  | { ok: true; committed: boolean }
  | { ok: false; error: string; step: "squash" };

export async function squashBranchToSingleCommit(
  execGit: ExecGit,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashStepResult> {
  const squashResult = await squashOnto(execGit, baseBranch, commitMessage);
  if (!squashResult.ok) {
    return { ok: false, error: squashResult.error, step: "squash" };
  }

  return { ok: true, committed: squashResult.committed };
}

export async function squashAndPush(
  execGit: ExecGit,
  branchName: string,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashAndPushResult> {
  const squashResult = await squashBranchToSingleCommit(execGit, baseBranch, commitMessage);
  if (!squashResult.ok) {
    return { ok: false, error: squashResult.error, step: "squash" };
  }

  const pushResult = await pushBranch(execGit, branchName, true);
  if (!pushResult.ok) {
    return { ok: false, error: pushResult.error, step: "push" };
  }

  return { ok: true };
}
```

AC12 mapping: `squashBranchToSingleCommit()` + `squashAndPush()` enforce the single clean squash commit before push, covered by `soft-resets onto the base branch and writes one clean squash commit` in `tests/branch-manager.test.ts`.
AC13 mapping: a squash failure returns `step: "squash"` and exits before `pushBranch()` is attempted, covered by `returns step: squash when squash fails` in `tests/branch-manager.test.ts`.
AC13 stop mapping: this is a targeted squash error path (`step: "squash"`), and the shipping flow must stop here without attempting any push.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/branch-manager.test.ts -t "soft-resets onto the base branch and writes one clean squash commit"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
