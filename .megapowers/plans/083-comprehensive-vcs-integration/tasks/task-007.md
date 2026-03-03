---
id: 7
title: switchAwayCommit in branch-manager.ts
status: approved
depends_on:
  - 3
  - 6
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/branch-manager.ts
  - tests/branch-manager.test.ts
files_to_create: []
---

### Task 7: switchAwayCommit in branch-manager.ts [depends: 3, 6]

**Files:**
- Modify: `extensions/megapowers/vcs/branch-manager.ts`
- Modify: `tests/branch-manager.test.ts`

**Step 1 — Write the failing test**

Add to `tests/branch-manager.test.ts`:

```typescript
import { switchAwayCommit } from "../extensions/megapowers/vcs/branch-manager.js";

describe("switchAwayCommit", () => {
  it("performs WIP commit with branch name in message (AC9)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await switchAwayCommit(execGit, "feat/old-feature");
    expect(result).toEqual({ ok: true, committed: true });
    expect(calls.some(c => c[0] === "commit" && c[2] === "WIP: feat/old-feature")).toBe(true);
  });

  it("returns committed: false when working tree is clean (AC9)", async () => {
    const execGit: ExecGit = async () => {
      return { stdout: "", stderr: "" };
    };

    const result = await switchAwayCommit(execGit, "feat/old-feature");
    expect(result).toEqual({ ok: true, committed: false });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/branch-manager.test.ts`
Expected: FAIL — switchAwayCommit is not exported from branch-manager.js

**Step 3 — Write minimal implementation**

Add import and function to `extensions/megapowers/vcs/branch-manager.ts`:

Update the import line to include `wipCommit` and `WipCommitResult`:
```typescript
import { createBranch, checkoutBranch, wipCommit, type ExecGit, type WipCommitResult } from "./git-ops.js";
```

Add the function:
```typescript
/**
 * AC9: Perform a WIP commit on the current branch before switching away.
 * Message format: "WIP: <currentBranch>". Skips if working tree is clean.
 */
export async function switchAwayCommit(
  execGit: ExecGit,
  currentBranch: string,
): Promise<WipCommitResult> {
  return wipCommit(execGit, `WIP: ${currentBranch}`);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/branch-manager.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
