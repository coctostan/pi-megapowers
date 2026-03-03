---
id: 4
title: squashOnto in git-ops.ts
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/git-ops.ts
  - tests/git-ops.test.ts
files_to_create: []
---

### Task 4: squashOnto in git-ops.ts [depends: 1]

**Files:**
- Modify: `extensions/megapowers/vcs/git-ops.ts`
- Modify: `tests/git-ops.test.ts`

**Step 1 — Write the failing test**

Add to `tests/git-ops.test.ts`:

```typescript
import { squashOnto, type SquashResult } from "../extensions/megapowers/vcs/git-ops.js";

describe("squashOnto", () => {
  it("performs soft reset and commits when there are changes (AC5)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await squashOnto(execGit, "main", "feat: complete feature");
    expect(result).toEqual({ ok: true, committed: true });
    expect(calls).toEqual([
      ["reset", "--soft", "main"],
      ["status", "--porcelain"],
      ["commit", "-m", "feat: complete feature"],
    ]);
  });

  it("returns committed: false when nothing to commit after reset (AC5)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await squashOnto(execGit, "main", "feat: complete");
    expect(result).toEqual({ ok: true, committed: false });
    // Should not call commit
    expect(calls).toEqual([
      ["reset", "--soft", "main"],
      ["status", "--porcelain"],
    ]);
  });

  it("returns ok: false when reset fails (AC23)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "reset") throw new Error("reset failed: ambiguous argument");
      return { stdout: "", stderr: "" };
    };

    const result = await squashOnto(execGit, "main", "feat: complete");
    expect(result).toEqual({ ok: false, error: "reset failed: ambiguous argument" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/git-ops.test.ts`
Expected: FAIL — squashOnto is not exported from git-ops.js

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/vcs/git-ops.ts`:

```typescript
export type SquashResult = { ok: true; committed: boolean } | { ok: false; error: string };

/**
 * AC5: Soft-reset to base branch and commit all changes as a single squash commit.
 * Returns committed: false when there is nothing to commit after reset.
 */
export async function squashOnto(
  execGit: ExecGit,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashResult> {
  try {
    await execGit(["reset", "--soft", baseBranch]);
    const status = await execGit(["status", "--porcelain"]);
    if (!status.stdout.trim()) {
      return { ok: true, committed: false };
    }
    await execGit(["commit", "-m", commitMessage]);
    return { ok: true, committed: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "squashOnto failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/git-ops.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
