# Revise Instructions (iteration 1)

These revisions are required for correctness + keeping the suite green after *each* task.

---

## Task 5: parseReviewOutput fallback for unparseable output

### Problem
- **TDD Step 2 likely won’t fail**: Task 4’s `parseReviewOutput()` already returns findings containing the substring `"Review parse error"` for missing/invalid frontmatter (gray-matter yields `data: {}` → Zod failure), so the new tests in Task 5 will probably pass immediately.
- The task currently tests **multiple fallback paths at once**, but doesn’t introduce a *new* behavior that reliably fails first.

### Required change
Make Task 5 test a behavior that **does not exist after Task 4** and then implement it.

Concretely: keep Task 4’s behavior for invalid/missing frontmatter, but add a dedicated empty-output message.

#### Step 1 (test) — replace Task 5’s multiple cases with a single failing case
```ts
// tests/pipeline-results.test.ts

describe("parseReviewOutput empty output", () => {
  it("returns reject with a stable empty-output parse error finding", () => {
    const result = parseReviewOutput("\n\n");
    expect(result.verdict).toBe("reject");
    expect(result.findings).toEqual(["Review parse error: empty output"]);
  });
});
```

#### Step 2 (expected failure)
Run: `bun test tests/pipeline-results.test.ts`

Expected: FAIL — the first finding is currently something like:
- `"Review parse error: invalid frontmatter — ..."`

#### Step 3 (implementation)
Add the `if (!text.trim()) { ... }` guard as Task 5 suggests, but keep the rest of Task 4 intact.

---

## Task 7: createPipelineWorkspace temp-commit and reset behavior

### Problems
1. **Swallowing commit errors violates AC1/AC2.** The current plan says “If commit fails… proceed without temp commit”. That can reintroduce the exact bug (worktree missing uncommitted additions).
2. **`git commit` can fail in real usage** due to missing `user.name`/`user.email` (very common in tool contexts). We need to set an identity explicitly for the temp commit.
3. Coverage gap: there is no test that proves **worktree contains uncommitted additions** (AC2) or that the main working directory is restored (AC1).

### Required changes
#### A) Make temp commit mandatory and robust
- Do **not** ignore commit failures.
- Ensure commit succeeds by injecting identity config into the commit command.

Use this pattern (note: `-c` flags must appear before the `commit` subcommand):
```ts
// inside createPipelineWorkspace
await execGit(inDir(projectRoot, ["add", "-A"]));
await execGit(
  inDir(projectRoot, [
    "-c",
    "user.name=megapowers",
    "-c",
    "user.email=megapowers@local",
    "commit",
    "--allow-empty",
    "--no-gpg-sign",
    "-m",
    "temp-pipeline-commit",
  ]),
);
```

#### B) Guarantee reset happens via `finally`
Restructure to ensure `git reset HEAD~1` runs whenever the temp commit succeeded, **even if** worktree add fails:
```ts
let tempCommitted = false;
try {
  // add + commit
  tempCommitted = true;
  // worktree add
  return { ok: true, workspaceName, workspacePath };
} catch (err) {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
} finally {
  if (tempCommitted) {
    // IMPORTANT: if this fails, return an ok:false result instead of silently continuing.
    await execGit(inDir(projectRoot, ["reset", "HEAD~1"]));
  }
}
```
If you need to preserve the original error from `worktree add`, include it in the returned error string alongside any reset failure.

#### C) Add an integration regression test for AC2
Add a test that uses **real git** in a temp directory:
- `git init`
- create an initial commit (so `HEAD~1` is valid)
- create an **uncommitted** new file (the core bug case)
- call `createPipelineWorkspace()` with a real `execGit` wrapper
- assert the new file exists in the worktree path.

This is the minimum test that proves the bug is fixed.

---

## Task 9: squashPipelineWorkspace uses file-copy instead of git apply

### Problems
1. **Step 1 test snippet is missing imports**: it uses `join(...)` but doesn’t import it from `node:path`.
2. After switching away from `git apply`, existing tests that throw on `args[0] === "apply"` (notably in `tests/pipeline-workspace.test.ts` and `tests/oneshot-tool.test.ts`) must be updated or the suite will fail at Task 9 Step 5.
3. Task 9 needs to explicitly remove/replace the Task 8 “apply-based” assertions so they don’t contradict the new behavior.

### Required changes
#### A) Fix the new tests’ imports
Add:
```ts
import { join } from "node:path";
```

#### B) Update existing tests that assume `git apply`
Update these files as part of Task 9 (so Task 9 Step 5 can run `bun test` successfully):
- `tests/pipeline-workspace.test.ts`
- `tests/oneshot-tool.test.ts`

Example replacement for the “apply throws” failure simulation:
```ts
// make execGit throw on the name-only diff call
if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
  throw new Error("diff name-only failed");
}
```
Then assert:
- `r.ok === false`
- `r.error` contains `diff name-only failed`
- no `worktree remove` call was made (preserves worktree on failure)

#### C) Ensure Task 8/Task 9 tests don’t conflict
In `tests/pipeline-workspace.test.ts`, remove any expectation that `args[0] === "apply"` is called.

---

## Task 13: Rewrite pipeline-context.ts for bounded retry context

### Problem
As written, Task 13 rewrites `renderContextPrompt()` to remove the “Previous Steps” / “Accumulated Review Findings” sections.

But **current `pipeline-runner.ts` still relies on those exports**, and **current `tests/pipeline-runner.test.ts` asserts** that retry context contains strings like `"Accumulated Review Findings"`.

So Task 13, as scoped, will break the suite before Task 14 lands.

### Required change (pick one approach; preferred is A)

#### Approach A (preferred): Introduce a bounded context *V2* without breaking legacy behavior
- Keep the existing `PipelineContext` / `appendStepOutput` / `setRetryContext` / `renderContextPrompt` behavior intact for now.
- Add a new bounded API in a new file, e.g.:
  - `extensions/megapowers/subagent/pipeline-context-bounded.ts`
  - exports: `BoundedPipelineContext`, `RetryContext`, `buildInitialContext`, `withRetryContext`, `renderContextPrompt`
- Add tests for the bounded API in a new test file, e.g. `tests/pipeline-context-bounded.test.ts`.

Then Task 14 switches the runner to import from `pipeline-context-bounded.ts`.

#### Approach B: Update `pipeline-runner.ts` + its tests in Task 13 too
If you keep Task 13 as a rewrite-in-place, then Task 13 must also update:
- `extensions/megapowers/subagent/pipeline-runner.ts`
- `tests/pipeline-runner.test.ts`

…but that makes Task 13 too large. Prefer A.

---

## Task 14: Refactor runPipeline (shell verify, frontmatter review, bounded context, structured result)

### Problems
1. **AC26 not met**: infrastructure failures are not distinguished from semantic failures via separate result fields.
2. Retry reason typing: the bounded retry context reasons are limited to `implement_failed | verify_failed | review_rejected`, but the plan currently maps review execution failures onto `implement_failed`.

### Required changes
#### A) Add explicit infra error field(s) on the result
Update `PipelineResult` to include something like:
```ts
infrastructureError?: string;
```
(or a structured object).

Rules:
- Dispatcher crashes/timeouts (implementer/reviewer dispatch throws or returns exitCode!=0) should populate `infrastructureError`.
- Verify failures should populate `testsPassed: false`, `testOutput`, and should **not** populate `infrastructureError`.
- Review rejections should populate `reviewVerdict: "reject"`, `reviewFindings`, and should **not** populate `infrastructureError`.

Update the Task 14 tests to assert this separation.

#### B) Don’t overload retry reasons
If reviewer dispatch fails (infra), either:
- add a new retry reason (`review_failed`), or
- treat it as `implement_failed` but include `infrastructureError` and ensure the prompt labels it clearly.

---

## Task 16: Update pipeline-tool tests for new runner interface

### Problems
- The task claims “No source code changes needed” but then requires adding an `execShell` injection point to `handlePipelineTool()` to make the completed-path deterministic.
- The task mixes **API change** + **test updates** without clearly scoping them.

### Required changes
1. Make the API change explicit in this task:
   - Add optional `execShell?: ExecShell` parameter to `handlePipelineTool()` (as the draft suggests).
   - Pass it through to `runPipeline()` options.
   - Keep the existing call site in `extensions/megapowers/register-tools.ts` unchanged (optional param).

2. Update tests:
   - Remove any mock branches for `cfg.agent === "verifier"`.
   - Update reviewer mocks to return frontmatter:
     `"---\nverdict: approve\n---\n"`
   - For completed-path tests, pass a mock `execShell` that returns exitCode 0.

3. Ensure Step 2 specifies a concrete expected failure message (e.g. test hangs/fails because real `bun test` ran in empty tmp dir and verify fails).
