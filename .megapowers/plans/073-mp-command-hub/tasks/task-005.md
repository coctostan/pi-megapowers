---
id: 5
title: Extend store.createIssue with optional milestone and priority, update
  formatIssueFile and consumers
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/state/store.ts
  - extensions/megapowers/prompt-inject.ts
  - tests/store.test.ts
files_to_create:
  - tests/store-milestone-priority.test.ts
---

### Task 5: Extend store.createIssue with optional milestone and priority, update formatIssueFile and consumers

**Covers:** AC12, AC13, AC14, AC15
**Files:**
- Modify: `extensions/megapowers/state/store.ts`
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `tests/store.test.ts`
- Test: `tests/store-milestone-priority.test.ts`
**Step 1 — Write the failing test**
Create `tests/store-milestone-priority.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";
let tmp: string;
let store: Store;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-ms-pr-"));
  store = createStore(tmp);
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("createIssue milestone and priority frontmatter (AC12-AC15)", () => {
  it("includes milestone: and priority: in frontmatter when provided", () => {
    const issue = store.createIssue("With both", "feature", "desc", undefined, "M2", 2);
    const content = readFileSync(join(tmp, ".megapowers", "issues", `${issue.slug}.md`), "utf-8");
    expect(content).toContain("milestone: M2");
    expect(content).toContain("priority: 2");
  });

  it("omits milestone: and priority: from frontmatter when not provided", () => {
    const issue = store.createIssue("Without extras", "feature", "desc");
    const content = readFileSync(join(tmp, ".megapowers", "issues", `${issue.slug}.md`), "utf-8");
    expect(content).not.toContain("milestone:");
    expect(content).not.toContain("priority:");
  });

  it("round-trips milestone and priority through getIssue", () => {
    const created = store.createIssue("Roundtrip", "feature", "desc", undefined, "M3", 5);
    const fetched = store.getIssue(created.slug);
    expect(fetched!.milestone).toBe("M3");
    expect(fetched!.priority).toBe(5);
  });

  it("returns undefined for milestone and priority when not provided", () => {
    const created = store.createIssue("Bare", "feature", "desc");
    const fetched = store.getIssue(created.slug);
    expect(fetched!.milestone).toBeUndefined();
    expect(fetched!.priority).toBeUndefined();
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/store-milestone-priority.test.ts`
Expected: FAIL — `TS2554: Expected 3-4 arguments, but got 6.` (because current `createIssue` only accepts `title, type, description, sources?`)
**Step 3 — Write minimal implementation**
Modify `extensions/megapowers/state/store.ts`:
1) Update `Issue` interface — change `milestone` and `priority` from required to optional:

Old:
```ts
  milestone: string;
  priority: number;
```

New:
```ts
  milestone?: string;
  priority?: number;
```

2) Update `Store.createIssue` interface signature:

Old:
```ts
  createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[]): Issue;
```

New:
```ts
  createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[], milestone?: string, priority?: number): Issue;
```

3) Replace `formatIssueFile` entirely:

Old:
```ts
function formatIssueFile(issue: Issue): string {
  const sourcesLine = issue.sources.length > 0 ? `sources: [${issue.sources.join(", ")}]\n` : "";
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
created: ${new Date(issue.createdAt).toISOString()}
${sourcesLine}---

# ${issue.title}

${issue.description}
`;
}
```

New:
```ts
function formatIssueFile(issue: Issue): string {
  const sourcesLine = issue.sources.length > 0 ? `sources: [${issue.sources.join(", ")}]\n` : "";
  const milestoneLine = issue.milestone?.trim() ? `milestone: ${issue.milestone.trim()}\n` : "";
  const priorityLine = typeof issue.priority === "number" ? `priority: ${issue.priority}\n` : "";
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
created: ${new Date(issue.createdAt).toISOString()}
${sourcesLine}${milestoneLine}${priorityLine}---

# ${issue.title}

${issue.description}
`;
}
```

4) Update the `createIssue(...)` implementation signature and object construction:

Old:
```ts
    createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[]): Issue {
```

New:
```ts
    createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[], milestone?: string, priority?: number): Issue {
```

And in the issue object, replace:
```ts
        milestone: "",
        priority: 0,
```
with:
```ts
        milestone: milestone?.trim() ? milestone.trim() : undefined,
        priority: typeof priority === "number" ? priority : undefined,
```

5) Update `listIssues()` — in the returned object, change:

Old:
```ts
            milestone: parsed.milestone ?? "",
            priority: parsed.priority ?? 0,
```

New:
```ts
            milestone: parsed.milestone,
            priority: parsed.priority,
```

6) Update `getIssue()` — same change:

Old:
```ts
            milestone: parsed.milestone ?? "",
            priority: parsed.priority ?? 0,
```

New:
```ts
            milestone: parsed.milestone,
            priority: parsed.priority,
```

7) Update `tests/store.test.ts` — find the test `"defaults milestone to empty string and priority to 0"` (around line 100):

Old assertions:
```ts
    expect(fetched!.milestone).toBe("");
    expect(fetched!.priority).toBe(0);
```

New assertions:
```ts
    expect(fetched!.milestone).toBeUndefined();
    expect(fetched!.priority).toBeUndefined();
```

8) Update `extensions/megapowers/prompt-inject.ts` — inside `buildIdlePrompt` (line 32), change:

Old:
```ts
      `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority})`,
```

New:
```ts
      `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority ?? "none"})`,
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/store-milestone-priority.test.ts`
Expected: PASS
Run: `bun test`
Expected: all passing
