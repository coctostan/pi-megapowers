## Task 5: End-to-end: headless onAgentEnd processes close-issue and resets state

### Issue 1: TDD flow is invalid — test passes immediately on write

Task 5 depends on Tasks 2 and 4. By the time Task 5 executes, both are already implemented. The test validates *their combined behavior* — there is no new production code in Step 3 ("No new production code needed"). This means:

- Step 1: Write test
- Step 2: Run test → **PASSES immediately** (not fails)
- Step 3: Nothing to implement

This breaks the TDD RED→GREEN cycle. The task should be marked `no_test: true`.

**Fix:** Set `no_test: true` in the frontmatter. Update the justification to:
> `[no-test]` Justification: Integration/regression test that validates the combined behavior of Tasks 2 and 4. No new production code — test passes on write since dependencies are already implemented.

Remove Step 2's incorrect failure expectation. Restructure as:
- Step 1: Write the test (same code, keep it)
- Verification: Run `bun test tests/hooks.test.ts -t "end-to-end headless"` → Expected: PASS
- Full suite: `bun test` → Expected: all passing

### Issue 2: `setupIssue` helper uses `require("node:fs")`

The helper code provided for `setupIssue` uses:
```typescript
const { writeFileSync } = require("node:fs");
```

The codebase uses ES imports exclusively. The `hooks.test.ts` file already imports from `"node:fs"` at line 2:
```typescript
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
```

**Fix:** Add `writeFileSync` to the existing import at the top of `hooks.test.ts`:
```typescript
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
```

Then the local `setupIssue` helper should be:
```typescript
function setupIssue(cwd: string) {
  const issuesDir = join(cwd, ".megapowers", "issues");
  mkdirSync(issuesDir, { recursive: true });
  writeFileSync(
    join(issuesDir, "001-test.md"),
    "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2025-01-01T00:00:00Z\n---\n# Test Issue\nDescription",
  );
}
```

No `require()` call needed.
