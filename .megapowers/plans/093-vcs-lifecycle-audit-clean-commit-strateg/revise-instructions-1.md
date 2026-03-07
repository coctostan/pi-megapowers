## Task 1: Export a branch-creation helper result through activation state

## Quick Fix Checklist

Work through these before resubmitting the plan:

- Remove or rewrite every task that is already GREEN on the current codebase: **1, 6, 11, 12, 13, 14**
- Fix every task that appends an `import` into the middle of an existing test file; move those imports to the file header instead: **2, 4, 5, 7, 9**
- Make sure any task that directly uses `resolveActivationBaseBranch()` depends on **Task 16**
- Revise **Task 16** so it extracts the helper from the current activation logic without removing stale-branch cleanup or remote-sync prompting
- Add explicit orchestrator-level coverage for **AC10**: if finalization aborts, shipping must stop before `git push` and before PR creation
- Update **Task 17** so the audit asserts the revised AC10 shipping test title too
- After edits, re-check every revised task against the 6 review criteria: coverage, dependencies, TDD completeness, granularity, no-test validity, and self-containment

Then do a final pass to verify:

- Step 1 is actually RED on the current code
- Step 2 names the specific expected failure output
- Step 3 uses real codebase APIs and valid imports
- Step 4 repeats the same focused test command and expects PASS
- Step 5 runs `bun test` and expects all passing

This task is not RED as written. `tests/vcs-commands.test.ts` already contains:

```ts
it("calls ensureBranch, saves branchName and baseBranch to state (AC14)", async () => {
  ...
  expect(state.branchName).toBe("feat/001-my-feature");
  expect(state.baseBranch).toBe("main");
});
```

Your new test:

```ts
it("records branchName only after ensureBranch succeeds during activation", async () => {
  ...
  expect(state.branchName).toBe("feat/003-activation-success");
});
```

will already pass on the current code. Do **not** keep a task whose Step 1 is already green.

Revise this task in one of these two concrete ways:
1. **Preferred:** remove Task 1 entirely and update later `[depends: ...]` annotations that reference it.
2. If you keep it, rewrite it to cover a behavior that is currently missing rather than duplicating the existing activation-success test.

## Task 2: Extract switch-away persistence helper for clean working trees

Step 1 says to **append** this import:

```ts
import { maybeSwitchAwayFromIssue } from "../extensions/megapowers/commands.js";
```

Appending an `import` into the middle of `tests/vcs-commands.test.ts` will make the file invalid TypeScript. Update the existing top import instead:

```ts
import { handleIssueCommand, maybeSwitchAwayFromIssue } from "../extensions/megapowers/commands.js";
```

Keep the test body the same. The expected failure can still be the missing export:

```txt
SyntaxError: Export named 'maybeSwitchAwayFromIssue' not found in module '../extensions/megapowers/commands.js'
```

## Task 4: Abort finalization on suspicious untracked files before push

Step 1 has the same mid-file import problem. Do **not** append this inside the body of `tests/shipping.test.ts`:

```ts
import { finalizeShipment } from "../extensions/megapowers/vcs/shipping.js";
```

Instead, update the file header created in Task 3 to include it in the top import list:

```ts
import { auditShipment, finalizeShipment, type ExecGit } from "../extensions/megapowers/vcs/shipping.js";
```

Keep the rest of the test unchanged.

## Task 5: Reject invalid shipping branch targets before squashing or pushing

Step 1 also appends a mid-file import. Fold it into the top import list instead of appending:

```ts
import {
  auditShipment,
  finalizeShipment,
  validateShipTarget,
  type ExecGit,
} from "../extensions/megapowers/vcs/shipping.js";
```

Do not leave `import { validateShipTarget ... }` inside the middle of the test file.

## Task 6: Commit allowed dirty work during shipment finalization

This task is not RED because Task 4 Step 3 already includes the exact implementation that Task 6 claims to add:

```ts
await execGit(["add", "-u"]);
for (const path of audit.includedUntracked) {
  await execGit(["add", "--", path]);
}

const status = await execGit(["status", "--porcelain"]);
if (!status.stdout.trim()) {
  return { ok: true, committed: false, audit };
}

await execGit(["commit", "-m", `chore: finalize ${issueSlug}`]);
return { ok: true, committed: true, audit };
```

Split the ownership correctly:
- **Task 4** should stop after `auditShipment()` + blocked-file handling + the no-op clean-tree return.
- **Task 6** should be the task that adds the staging sequence, second `git status --porcelain`, and final commit.

After revision, Task 4 Step 3 should look like this skeleton:

```ts
export async function finalizeShipment(execGit: ExecGit, issueSlug: string): Promise<FinalizeShipmentResult> {
  const audit = await auditShipment(execGit);

  if (audit.blockedUntracked.length > 0) {
    return {
      ok: false,
      error: `Blocked suspicious untracked files: ${audit.blockedUntracked.join(", ")}`,
      blockedFiles: audit.blockedUntracked,
    };
  }

  const hasTracked = audit.tracked.length > 0;
  const hasIncludedUntracked = audit.includedUntracked.length > 0;
  if (!hasTracked && !hasIncludedUntracked) {
    return { ok: true, committed: false, audit };
  }

  // staging + commit path added in Task 6
  return { ok: true, committed: false, audit };
}
```

Then Task 6 should add the real staging/commit path.

## Task 7: Extract squash-only shipping step and stop on squash failures

Step 1 says to append this import:

```ts
import { squashBranchToSingleCommit } from "../extensions/megapowers/vcs/branch-manager.js";
```

Do not append it mid-file. Update the existing header import instead:

```ts
import {
  ensureBranch,
  switchAwayCommit,
  squashAndPush,
  squashBranchToSingleCommit,
} from "../extensions/megapowers/vcs/branch-manager.js";
```

Keep the test body the same.

## Task 9: Orchestrate finalize, squash, push, and PR as one shipping path

There are two concrete problems here.

### 1) Step 1 test imports the wrong types
This line is wrong:

```ts
import { shipAndCreatePR, type ExecCmd } from "../extensions/megapowers/vcs/shipping.js";
```

`shipping.ts` does not export `ExecCmd` in the implementation you provided, and the test body also uses `ExecGit` without importing it.

Use these imports instead:

```ts
import { shipAndCreatePR } from "../extensions/megapowers/vcs/shipping.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
import type { ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";
```

### 2) Keep the import at the top of `tests/shipping.test.ts`
Do not append an `import` halfway through the file.

## Task 11: Add a self-contained dirty switch-away regression test

This task has both a dependency problem and a RED problem.

### Dependency problem
Step 3 uses `resolveActivationBaseBranch(...)`:

```ts
let baseBranch: string | null = prevState.branchName
  ? prevState.baseBranch
  : await resolveActivationBaseBranch(deps.execGit);
```

but Task 11 depends only on `1, 2`. That helper is introduced later in Task 16. Fix the dependency to include Task 16 **or** remove the helper reference from Task 11.

### RED problem
The current `handleIssueCommand()` already awaits switch-away persistence before base-branch detection and `ensureBranch()`. Your proposed test:

```ts
expect(wipCommitIndex).toBeLessThan(createNewBranchIndex);
```

is already true on the current code, so Step 2's expected failure is wrong.

Revise this task in one of these concrete ways:
1. **Preferred:** remove Task 11 and let the existing dirty switch-away test in `tests/vcs-commands.test.ts` plus Task 15's integration test carry AC3.
2. If you keep it, write a stricter ordering test that would actually fail without the intended refactor, for example by proving `resolveActivationBaseBranch()` is not entered until the switch-away promise resolves.

## Task 12: Stop the shipping pipeline before PR creation when push fails

As written, this task is redundant with Task 9. Task 9 Step 3 already contains:

```ts
if (!pushed.ok) {
  return { ok: false, step: pushed.step, error: pushed.error, pushed: false };
}
```

So Task 12 will already be green after Task 9.

Use Task 12 to cover the **missing acceptance criterion AC10** instead:
- when `finalizeShipment()` aborts (for example, blocked suspicious untracked files), `shipAndCreatePR()` must return `{ ok: false, step: "finalize", ... , pushed: false }`
- it must not attempt `git push`
- it must not attempt `createPR`

Replace the current test with an orchestrator-level finalize-failure test like this:

```ts
it("returns a finalize error and does not attempt push or PR when finalization blocks shipment", async () => {
  const gitCalls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    gitCalls.push(args);
    if (args[0] === "status" && args.includes("--ignored")) {
      return { stdout: "?? .env.local\n", stderr: "" };
    }
    throw new Error(`unexpected git call: ${args.join(" ")}`);
  };

  let prAttempted = false;
  const execCmd: ExecCmd = async () => {
    prAttempted = true;
    return { stdout: "", stderr: "" };
  };

  const result = await shipAndCreatePR({
    execGit,
    execCmd,
    issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
    branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
    baseBranch: "main",
    commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prTitle: "Ship 093",
    prBody: "Resolves 093",
  });

  expect(result).toEqual({
    ok: false,
    step: "finalize",
    error: "Blocked suspicious untracked files: .env.local",
    pushed: false,
  });
  expect(gitCalls.some(c => c[0] === "push")).toBe(false);
  expect(prAttempted).toBe(false);
});
```

## Task 13: Surface PR creation failures without hiding a successful push

This task is also already implemented by Task 9 Step 3:

```ts
if ("ok" in pr && pr.ok === false) {
  return { ok: false, step: "pr", error: pr.error, pushed: true, pr };
}
```

Do not keep a task whose Step 1 is already green.

Revise this task in one of these two concrete ways:
1. remove Task 13 entirely and update later dependencies, or
2. move the PR-error branch **out of Task 9** so Task 9 only covers success / skipped-PR, and Task 13 is the first task that adds the explicit `{ ok: false, step: "pr", ... }` branch.

## Task 14: Keep branch metadata empty when activation branch creation fails

This task is not RED on the current code. `handleIssueCommand()` already only assigns branch metadata inside:

```ts
if ("branchName" in result) {
  newState.branchName = result.branchName;
  newState.baseBranch = baseBranch;
}
```

and your `makeMockUI()` returns `createInitialState()`, so `branchName` and `baseBranch` are already `null` on the failure path.

Also, Step 3 again references `resolveActivationBaseBranch()` without depending on Task 16.

Revise this task by removing it from the plan and updating dependent task annotations, rather than keeping a non-RED task.

## Task 16: Record a non-feature base branch during activation

The new helper itself is fine, but the Step 3 instructions would regress existing behavior if implemented literally.

Your current `handleIssueCommand()` already does **three** things on fresh activation:
1. reads `HEAD`
2. if `HEAD` is a stale `feat/*` or `fix/*` branch with no tracked active issue, it checks out `main`
3. runs the remote-sync prompt / optional `git pull` flow via `checkBranchSync()`

Do **not** replace that with the oversimplified helper body:

```ts
export async function resolveActivationBaseBranch(execGit: ExecGit): Promise<string | null> {
  try {
    const r = await execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    const currentBranch = r.stdout.trim();
    return currentBranch || null;
  } catch {
    return null;
  }
}
```

That version would drop the existing stale-feature checkout behavior that is already covered by `tests/vcs-commands.test.ts` and would also sever the current remote-sync flow.

Revise Task 16 so it extracts the helper **from the existing logic** instead of replacing it. The helper should preserve stale-feature cleanup:

```ts
export async function resolveActivationBaseBranch(execGit: ExecGit): Promise<string | null> {
  try {
    const r = await execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    const currentBranch = r.stdout.trim();
    if (currentBranch && /^(feat|fix)\//.test(currentBranch)) {
      await execGit(["checkout", "main"]);
      return "main";
    }
    return currentBranch || null;
  } catch {
    return null;
  }
}
```

Then keep the existing `checkBranchSync()` / `ctx.ui.select(...)` / optional `git pull` block in `handleIssueCommand()` **after** the helper returns.

Finally, any task that uses `resolveActivationBaseBranch()` directly must depend on Task 16.

## Task 17: Add an automated coverage audit for VCS lifecycle test suites

Once Task 12 is revised to cover orchestrator-level finalization aborts, the audit should verify that coverage too. Right now the audit only checks for:

```ts
expect(shippingSource).toContain("blocks suspicious untracked files");
expect(shippingSource).toContain("returns a squash/push step ship result and does not attempt PR creation when squashAndPush fails");
```

That misses the acceptance-criterion-level guarantee that a finalization abort stops the ship flow before push.

Add an assertion for the revised Task 12 test title, for example:

```ts
expect(shippingSource).toContain("returns a finalize error and does not attempt push or PR when finalization blocks shipment");
```

Keep the rest of the audit structure the same.
