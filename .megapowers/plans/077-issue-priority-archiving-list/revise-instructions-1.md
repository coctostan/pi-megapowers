## Task 4: Add pure active-issue sorting grouping and triage filtering helpers

Step 1 test has a wrong assertion for `filterTriageableIssues`. The function uses `.filter()` only (no sorting), so it preserves input array order. The input array has IDs in order `[4, 2, 1, 3, 5]`. After filtering out id 5 (archived), the result is `[4, 2, 1, 3]`.

**Current (broken):**
```ts
const triageable = filterTriageableIssues(issues);
expect(triageable.map(i => i.id)).toEqual([1, 2, 3, 4]);
```

**Fix — change expected to match input order minus filtered items:**
```ts
const triageable = filterTriageableIssues(issues);
expect(triageable.map(i => i.id)).toEqual([4, 2, 1, 3]);
```

This is confirmed by the existing test in `tests/ui.test.ts:1033-1035` which asserts `expect(result.map(i => i.id)).toEqual([1, 4])` — preserving input order `[1, 2, 3, 4]` after filtering.

## Task 7: Exclude archived issues from idle prompt open-issues summary

Two issues:

### 1. Missing dependency on Task 2

The test calls `store.archiveIssue(archived.slug)` but `depends_on` is `[1, 5]`. Add Task 2: `depends_on: [1, 2, 5]`.

### 2. TDD cycle is broken — test passes before implementation

After Task 2, `store.archiveIssue()` moves the file to `.megapowers/issues/archive/`. Since `store.listIssues()` only reads the active directory (`.megapowers/issues/`), the archived issue is never returned. The assertion `expect(prompt).not.toContain("Archived task")` passes BEFORE adding `i.status !== "archived"` to the filter. There is no RED→GREEN cycle.

**Fix — rewrite the test to create an archived-status issue directly in the active directory:**

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createStore } from "../extensions/megapowers/state/store.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "prompt-inject-archived-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("buildInjectedPrompt archived issue filtering (AC29)", () => {
  it("does not include archived issues in the open issue list", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const store = createStore(tmp);

    store.createIssue("Open task", "feature", "Still open", undefined, "M2", 2);

    // Write an issue with status "archived" directly in the active directory.
    // This tests the filter itself (not the directory separation).
    const issuesDir = join(tmp, ".megapowers", "issues");
    writeFileSync(
      join(issuesDir, "002-archived-task.md"),
      `---\nid: 2\ntype: feature\nstatus: archived\ncreated: 2026-03-01T00:00:00.000Z\nmilestone: M1\npriority: 1\n---\n# Archived task\nNo longer active\n`,
    );

    const prompt = buildInjectedPrompt(tmp, store)!;
    expect(prompt).toContain("Open task");
    expect(prompt).not.toContain("Archived task");
  });
});
```

**Step 2 expected failure:**
```
Expected: FAIL — `expect(received).not.toContain(expected) // Expected substring: not "Archived task"`
```

This fails because the current filter is `i.status !== "done"`, which does NOT exclude `status: "archived"` issues in the active directory. After adding `i.status !== "archived"` to the filter in Step 3, the test passes.

**Step 3 implementation remains the same** (add `&& i.status !== "archived"` to the filter in `buildIdlePrompt`).
