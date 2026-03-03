---
id: 8
title: squashAndPush in branch-manager.ts
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

### Task 8: squashAndPush in branch-manager.ts [depends: 4, 5, 6]

**Files:**
- Modify: `extensions/megapowers/vcs/branch-manager.ts`
- Modify: `tests/branch-manager.test.ts`

**Step 1 — Write the failing test**

Add to `tests/branch-manager.test.ts`:

```typescript
import { squashAndPush } from "../extensions/megapowers/vcs/branch-manager.js";

describe("squashAndPush", () => {
  it("squashes onto base and force-pushes on success (AC10)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await squashAndPush(execGit, "feat/x", "main", "feat: done");
    expect(result).toEqual({ ok: true });
    expect(calls.some(c => c[0] === "reset" && c[1] === "--soft" && c[2] === "main")).toBe(true);
    expect(calls.some(c => c[0] === "push" && c.includes("--force-with-lease"))).toBe(true);
  });

  it("returns step: squash when squash fails (AC10)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "reset") throw new Error("reset failed");
      return { stdout: "", stderr: "" };
    };

    const result = await squashAndPush(execGit, "feat/x", "main", "feat: done");
    expect(result).toEqual({ ok: false, error: "reset failed", step: "squash" });
  });

  it("returns step: push when push fails (AC10)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      if (args[0] === "push") throw new Error("remote rejected");
      return { stdout: "", stderr: "" };
    };

    const result = await squashAndPush(execGit, "feat/x", "main", "feat: done");
    expect(result).toEqual({ ok: false, error: "remote rejected", step: "push" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/branch-manager.test.ts`
Expected: FAIL — squashAndPush is not exported from branch-manager.js

**Step 3 — Write minimal implementation**

Add import and function to `extensions/megapowers/vcs/branch-manager.ts`:

Update the import line to include `squashOnto` and `pushBranch`:
```typescript
import {
  createBranch, checkoutBranch, wipCommit, squashOnto, pushBranch,
  type ExecGit, type WipCommitResult,
} from "./git-ops.js";
```

Add the type and function:
```typescript
export type SquashAndPushResult = { ok: true } | { ok: false; error: string; step: "squash" | "push" };

/**
 * AC10: Squash all commits onto base branch and force-push.
 * Returns the failing step name on error for targeted retry/reporting.
 */
export async function squashAndPush(
  execGit: ExecGit,
  branchName: string,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashAndPushResult> {
  const squashResult = await squashOnto(execGit, baseBranch, commitMessage);
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

**Step 4 — Run test, verify it passes**
Run: `bun test tests/branch-manager.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
