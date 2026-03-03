---
id: 5
title: pushBranch in git-ops.ts
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/git-ops.ts
  - tests/git-ops.test.ts
files_to_create: []
---

### Task 5: pushBranch in git-ops.ts [depends: 1]

**Files:**
- Modify: `extensions/megapowers/vcs/git-ops.ts`
- Modify: `tests/git-ops.test.ts`

**Step 1 — Write the failing test**

Add to `tests/git-ops.test.ts`:

```typescript
import { pushBranch } from "../extensions/megapowers/vcs/git-ops.js";

describe("pushBranch", () => {
  it("pushes to origin without force flag (AC6)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await pushBranch(execGit, "feat/my-feature", false);
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["push", "origin", "feat/my-feature"]]);
  });

  it("pushes with --force-with-lease when force is true (AC6)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await pushBranch(execGit, "feat/my-feature", true);
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["push", "origin", "feat/my-feature", "--force-with-lease"]]);
  });

  it("returns ok: false when push fails (AC23)", async () => {
    const execGit: ExecGit = async () => {
      throw new Error("remote: permission denied");
    };

    const result = await pushBranch(execGit, "feat/my-feature", false);
    expect(result).toEqual({ ok: false, error: "remote: permission denied" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/git-ops.test.ts`
Expected: FAIL — pushBranch is not exported from git-ops.js

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/vcs/git-ops.ts`:

```typescript
/**
 * AC6: Push a branch to origin.
 * Uses --force-with-lease when force is true (safe force push after squash).
 */
export async function pushBranch(
  execGit: ExecGit,
  branchName: string,
  force: boolean,
): Promise<GitResult> {
  try {
    const args = ["push", "origin", branchName];
    if (force) args.push("--force-with-lease");
    await execGit(args);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "pushBranch failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/git-ops.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
