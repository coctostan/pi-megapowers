---
id: 13
title: Surface PR creation failures without hiding a successful push
status: approved
depends_on:
  - 9
  - 12
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/shipping.ts
  - tests/shipping.test.ts
files_to_create: []
---

### Task 13: Surface PR creation failures without hiding a successful push [depends: 9, 12]
**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
Append this single-scenario test to `tests/shipping.test.ts`:
```ts
it("returns a targeted PR error while preserving the earlier successful push result", async () => {
  const execGit: ExecGit = async (args) => {
    if (args[0] === "status" && args.includes("--ignored")) return { stdout: "", stderr: "" };
    if (args[0] === "status" && !args.includes("--ignored")) return { stdout: "", stderr: "" };
    return { stdout: "", stderr: "" };
  };
  const execCmd: ExecCmd = async (_cmd, args) => {
    if (args[0] === "--version") return { stdout: "gh version 2.0.0\n", stderr: "" };
    throw new Error("authentication required");
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
    step: "pr",
    error: "authentication required",
    pushed: true,
    pr: { ok: false, error: "authentication required" },
  });
});
```

This task is intentionally focused on AC17 only. GH-missing skip behavior remains covered by Task 8 + Task 9.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "returns a targeted PR error while preserving the earlier successful push result"`
Expected: FAIL — `expect(received).toEqual(expected)` because Task 9 currently returns `{ ok: true, pushed: true, pr }` even when `pr.ok === false`.

**Step 3 — Write minimal implementation**
Use the existing `PRResult` export from `extensions/megapowers/vcs/pr-creator.ts` when refining the `ShipResult` union, and preserve Task 12's blocked-file payload on the non-pushed branch:

```ts
export type ShipResult =
  | { ok: true; finalized: boolean; pushed: true; pr: PRResult }
  | {
      ok: false;
      step: "validate" | "finalize" | "squash" | "push";
      error: string;
      pushed: false;
      blockedFiles?: string[];
    }
  | { ok: false; step: "pr"; error: string; pushed: true; pr: { ok: false; error: string } };

const pr = await createPR(
  request.execCmd,
  request.baseBranch!,
  request.branchName!,
  request.prTitle,
  request.prBody,
);
if ("error" in pr) {
  return { ok: false, step: "pr", error: pr.error, pushed: true, pr };
}
return { ok: true, finalized: finalized.committed, pushed: true, pr };
```

This preserves `{ skipped: true, reason: "gh CLI not installed" }` on the success branch while surfacing a clear PR failure when push already succeeded.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "returns a targeted PR error while preserving the earlier successful push result"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
