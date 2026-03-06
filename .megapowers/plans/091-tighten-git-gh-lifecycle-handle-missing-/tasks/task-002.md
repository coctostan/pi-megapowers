---
id: 2
title: checkBranchSync returns in-sync when local matches remote
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - tests/sync-check.test.ts
files_to_create: []
---

### Task 2: checkBranchSync returns in-sync when local matches remote [depends: 1]

**Files:**
- Modify: `tests/sync-check.test.ts`

**Step 1 — Write the failing test**

Add to `tests/sync-check.test.ts` inside the `describe("checkBranchSync", ...)` block:

```typescript
  it("returns hasRemote true, behind 0, ahead 0 when local and remote are identical (AC4)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") return { stdout: "", stderr: "" };
      if (args[0] === "rev-list") return { stdout: "0\t0\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await checkBranchSync(execGit, "main");
    expect(result).toEqual({ hasRemote: true, behind: 0, ahead: 0 });
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — This test should pass immediately since the implementation from Task 1 already handles this case. This is a verification test.

**Step 3 — Write minimal implementation**

No code changes needed — the implementation from Task 1 already handles this correctly via `rev-list --left-right --count`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — 2 tests passing

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
