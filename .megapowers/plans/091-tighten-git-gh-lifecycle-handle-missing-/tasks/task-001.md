---
id: 1
title: checkBranchSync returns hasRemote false when no remote configured
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/vcs/sync-check.ts
  - tests/sync-check.test.ts
---

### Task 1: checkBranchSync returns hasRemote false when no remote configured

**Files:**
- Create: `extensions/megapowers/vcs/sync-check.ts`
- Create: `tests/sync-check.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/sync-check.test.ts
import { describe, it, expect } from "bun:test";
import { checkBranchSync } from "../extensions/megapowers/vcs/sync-check.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

describe("checkBranchSync", () => {
  it("returns hasRemote false when git remote produces no output (AC3)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "remote") return { stdout: "", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await checkBranchSync(execGit, "main");
    expect(result).toEqual({ hasRemote: false, behind: 0, ahead: 0 });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/sync-check.test.ts`
Expected: FAIL — `error: Cannot find module "../extensions/megapowers/vcs/sync-check.js"`

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/vcs/sync-check.ts
import type { ExecGit } from "./git-ops.js";

export type BranchSyncStatus = {
  hasRemote: boolean;
  behind: number;
  ahead: number;
};

export async function checkBranchSync(
  execGit: ExecGit,
  baseBranch: string,
): Promise<BranchSyncStatus> {
  // Check if any remote is configured
  try {
    const remoteResult = await execGit(["remote"]);
    if (!remoteResult.stdout.trim()) {
      return { hasRemote: false, behind: 0, ahead: 0 };
    }
  } catch {
    return { hasRemote: false, behind: 0, ahead: 0 };
  }

  // Fetch from origin
  try {
    await execGit(["fetch", "origin"]);
  } catch {
    // Fail-open: treat as in-sync if fetch fails
    return { hasRemote: true, behind: 0, ahead: 0 };
  }

  // Compare local vs remote
  try {
    const result = await execGit([
      "rev-list", "--left-right", "--count",
      `${baseBranch}...origin/${baseBranch}`,
    ]);
    const parts = result.stdout.trim().split(/\s+/);
    const ahead = parseInt(parts[0] ?? "0", 10) || 0;
    const behind = parseInt(parts[1] ?? "0", 10) || 0;
    return { hasRemote: true, behind, ahead };
  } catch {
    return { hasRemote: true, behind: 0, ahead: 0 };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
