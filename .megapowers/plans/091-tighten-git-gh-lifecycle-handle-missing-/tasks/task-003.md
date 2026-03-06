---
id: 3
title: checkBranchSync returns correct behind count when local is behind remote
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - tests/sync-check.test.ts
files_to_create: []
---

### Task 3: checkBranchSync returns correct behind count when local is behind remote [depends: 1]

**Files:**
- Modify: `tests/sync-check.test.ts`

**Step 1 — Write the failing test**

Add to `tests/sync-check.test.ts` inside the `describe("checkBranchSync", ...)` block:

```typescript
  it("returns correct behind count when local is behind origin (AC5)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") return { stdout: "", stderr: "" };
      if (args[0] === "rev-list") return { stdout: "0\t3\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await checkBranchSync(execGit, "main");
    expect(result).toEqual({ hasRemote: true, behind: 3, ahead: 0 });
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — This test should pass with existing implementation since rev-list parsing is already in place.

**Step 3 — Write minimal implementation**

No code changes needed — the implementation from Task 1 already parses the `rev-list --left-right --count` output correctly.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — 3 tests passing

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
