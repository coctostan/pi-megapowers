---
id: 2
title: checkoutBranch in git-ops.ts
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/git-ops.ts
  - tests/git-ops.test.ts
files_to_create: []
---

### Task 2: checkoutBranch in git-ops.ts [depends: 1]

**Files:**
- Modify: `extensions/megapowers/vcs/git-ops.ts`
- Modify: `tests/git-ops.test.ts`

**Step 1 — Write the failing test**

Add to `tests/git-ops.test.ts`:

```typescript
import { checkoutBranch } from "../extensions/megapowers/vcs/git-ops.js";

describe("checkoutBranch", () => {
  it("calls git checkout with branch name", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await checkoutBranch(execGit, "feat/my-feature");
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["checkout", "feat/my-feature"]]);
  });

  it("returns ok: false with error message when git fails (AC23)", async () => {
    const execGit: ExecGit = async () => {
      throw new Error("pathspec 'feat/missing' did not match");
    };

    const result = await checkoutBranch(execGit, "feat/missing");
    expect(result).toEqual({ ok: false, error: "pathspec 'feat/missing' did not match" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/git-ops.test.ts`
Expected: FAIL — checkoutBranch is not exported from git-ops.js

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/vcs/git-ops.ts`:

```typescript
/**
 * AC3: Check out an existing branch.
 * Runs `git checkout <branchName>`.
 */
export async function checkoutBranch(
  execGit: ExecGit,
  branchName: string,
): Promise<GitResult> {
  try {
    await execGit(["checkout", branchName]);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "checkoutBranch failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/git-ops.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
