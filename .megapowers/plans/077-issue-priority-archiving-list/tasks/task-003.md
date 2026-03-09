---
id: 3
title: Return clear archive errors for missing and already archived issues
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/state/store.ts
files_to_create:
  - tests/store-archive-errors.test.ts
---

### Task 3: Return clear archive errors for missing and already archived issues [depends: 2]

**Files:**
- Modify: `extensions/megapowers/state/store.ts`
- Test: `tests/store-archive-errors.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-archive-errors-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("store.archiveIssue errors (AC23-AC24)", () => {
  it("returns clear errors for missing issues and already archived issues", () => {
    const missing = store.archiveIssue("999-missing-issue");
    expect(missing).toEqual({ ok: false, error: "Issue not found: 999-missing-issue" });

    const created = store.createIssue("Archive me", "feature", "desc");
    const first = store.archiveIssue(created.slug);
    expect(first.ok).toBe(true);

    const second = store.archiveIssue(created.slug);
    expect(second).toEqual({ ok: false, error: `Issue already archived: ${created.slug}` });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/store-archive-errors.test.ts`
Expected: FAIL — `Expected: { ok: false, error: "Issue already archived: 001-archive-me" } Received: { ok: false, error: "Issue not found: 001-archive-me" }`

**Step 3 — Write minimal implementation**
```ts
// extensions/megapowers/state/store.ts
archiveIssue(slug: string) {
  ensureRoot();
  const activePath = join(issuesDir, `${slug}.md`);
  const archivedPath = join(archiveDir, `${slug}.md`);

  if (existsSync(archivedPath)) {
    return { ok: false as const, error: `Issue already archived: ${slug}` };
  }

  if (!existsSync(activePath)) {
    return { ok: false as const, error: `Issue not found: ${slug}` };
  }

  const current = this.getIssue(slug);
  if (!current) {
    return { ok: false as const, error: `Issue not found: ${slug}` };
  }

  const archivedIssue: Issue = { ...current, status: "archived" };
  const archivedAt = new Date().toISOString();
  writeFileSync(archivedPath, formatIssueFile(archivedIssue, archivedAt));
  rmSync(activePath);
  return { ok: true as const, archivedIssue };
},
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/store-archive-errors.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
