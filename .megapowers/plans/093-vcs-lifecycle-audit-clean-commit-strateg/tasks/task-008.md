---
id: 8
title: Pass base branch into PR creation and preserve clear skip/error results
status: approved
depends_on:
  - 5
  - 7
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/pr-creator.ts
  - tests/pr-creator.test.ts
files_to_create: []
---

### Task 8: Pass base branch into PR creation and preserve clear skip/error results [depends: 5, 7]

**Files:**
- Modify: `extensions/megapowers/vcs/pr-creator.ts`
- Test: `tests/pr-creator.test.ts`

**Step 1 — Write the failing test**
`tests/pr-creator.test.ts` is an existing suite in this repository and should be updated in place.
Preserve all other existing test cases in that file; only replace the named test and update the other createPR call sites in the same suite to include the new base-branch argument.
In `tests/pr-creator.test.ts`, replace the existing test named `it("creates PR with correct gh arguments and returns URL (AC12)", ...)` with:
That named test already exists in the current `tests/pr-creator.test.ts`; replace it in place (do not add a duplicate).

```ts
it("checks gh availability, passes explicit base/head arguments, and returns the PR URL", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const execCmd: ExecCmd = async (cmd, args) => {
    calls.push({ cmd, args });
    if (args[0] === "pr") return { stdout: "https://github.com/org/repo/pull/42\n", stderr: "" };
    return { stdout: "gh version 2.0.0\n", stderr: "" };
  };

  const result = await createPR(execCmd, "main", "feat/my-feature", "Add feature", "Feature body");

  expect(result).toEqual({ ok: true, url: "https://github.com/org/repo/pull/42" });
  expect(calls[0]).toEqual({ cmd: "gh", args: ["--version"] });
  expect(calls[1]).toEqual({
    cmd: "gh",
    args: [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "feat/my-feature",
      "--title",
      "Add feature",
      "--body",
      "Feature body",
    ],
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pr-creator.test.ts -t "checks gh availability, passes explicit base/head arguments, and returns the PR URL"`
Expected: FAIL — `expect(received).toEqual(expected)` because `--base` is missing from the `gh pr create` argument list

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/vcs/pr-creator.ts` so the exported `PRResult` union is explicit before the new `createPR()` signature:

```ts
export type PRResult =
  | { ok: true; url: string }
  | { ok: false; error: string }
  | { skipped: true; reason: string };

export async function createPR(
  execCmd: ExecCmd,
  baseBranch: string,
  branchName: string,
  title: string,
  body: string,
): Promise<PRResult> {
  try {
    await execCmd("gh", ["--version"]);
  } catch {
    return { skipped: true, reason: "gh CLI not installed" };
  }

  try {
    const result = await execCmd("gh", [
      "pr",
      "create",
      "--base",
      baseBranch,
      "--head",
      branchName,
      "--title",
      title,
      "--body",
      body,
    ]);
    return { ok: true, url: result.stdout.trim() };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "createPR failed";
    return { ok: false, error: message };
  }
}
```

At this point in the plan, the only existing `createPR()` call sites are the three tests in `tests/pr-creator.test.ts`. Update the other two tests in that file to pass `"main"` as the first argument, and keep every mock executor returning both `stdout` and `stderr` for both the `gh --version` and `gh pr create` branches.
The two additional existing tests to update are:
- `it("returns skipped when gh is not installed (AC12)", ...)`
- `it("returns ok: false when gh pr create fails (AC12)", ...)`
Both must pass `"main"` as the new first argument to `createPR(...)`.
Call-site reconciliation required in later tasks:
- Task 9 must call `createPR(request.execCmd, request.baseBranch!, request.branchName!, request.prTitle, request.prBody)`.
- Task 10/18 `ship-cli` flow passes these fields via `shipAndCreatePR`, so argument order consistency is enforced transitively.
Use these exact call updates in the other two tests:

```ts
const result = await createPR(execCmd, "main", "feat/my-feature", "Title", "Body");
expect(result).toEqual({ skipped: true, reason: "gh CLI not installed" });
```

```ts
const result = await createPR(execCmd, "main", "feat/my-feature", "Title", "Body");
expect(result).toEqual({ ok: false, error: "authentication required" });
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pr-creator.test.ts -t "checks gh availability, passes explicit base/head arguments, and returns the PR URL"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
