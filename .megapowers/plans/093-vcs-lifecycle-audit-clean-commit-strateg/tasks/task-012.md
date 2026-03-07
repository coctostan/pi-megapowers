---
id: 12
title: Stop the shipping pipeline before push/PR when finalization aborts
status: approved
depends_on:
  - 9
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/shipping.ts
  - tests/shipping.test.ts
files_to_create: []
---

### Task 12: Stop the shipping pipeline before push/PR when finalization aborts [depends: 9]

**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
Append this test to `tests/shipping.test.ts`:

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
    blockedFiles: [".env.local"],
    pushed: false,
  });
  expect(gitCalls).toEqual([["status", "--porcelain", "--untracked-files=all", "--ignored"]]);
  expect(gitCalls.some((c) => c[0] === "push")).toBe(false);
  expect(prAttempted).toBe(false);
  // Explicit guard verification: PR executor was never invoked after finalize abort.
  expect(prAttempted).toBe(false);
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "returns a finalize error and does not attempt push or PR when finalization blocks shipment"`
Expected: FAIL — `Error: unexpected git call: reset --soft main` because the orchestrator still continues into squash/push after finalization returns `{ ok: false }`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/vcs/shipping.ts`, update `ShipResult` and add the finalization guard in `shipAndCreatePR()`:

```ts
export type ShipResult =
  | { ok: true; finalized: boolean; pushed: true; pr: PRResult }
  | { ok: false; step: "validate" | "finalize" | "squash" | "push"; error: string; pushed: false; blockedFiles?: string[] };

const finalized = await finalizeShipment(request.execGit, request.issueSlug);
if (!finalized.ok) {
  return { ok: false, step: "finalize", error: finalized.error, pushed: false, blockedFiles: finalized.blockedFiles };
  // Preserve blocked-file detail from finalizeShipment for AC9 caller visibility.
}
```

Keep this guard before `squashAndPush(...)` and before `createPR(...)`.
This guard only triggers when `finalized.ok === false` (blocked suspicious files). Clean working trees still return `{ ok: true, committed: false }`, so Task 9’s clean-tree happy path remains valid.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "returns a finalize error and does not attempt push or PR when finalization blocks shipment"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
