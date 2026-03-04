---
id: 3
title: Define ImplementResult type
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-results.ts
  - tests/pipeline-results.test.ts
files_to_create: []
---

### Task 3: Define ImplementResult type

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts`

**Step 1 — Write the failing test**

Append to `tests/pipeline-results.test.ts`:

```typescript
// Add this describe block at the end of tests/pipeline-results.test.ts
import { type ImplementResult } from "../extensions/megapowers/subagent/pipeline-results.js";

describe("ImplementResult", () => {
  it("satisfies the type contract with required and optional fields", () => {
    const result: ImplementResult = {
      filesChanged: ["src/a.ts", "tests/a.test.ts"],
      tddReport: {
        testWrittenFirst: true,
        testRanBeforeProduction: true,
        productionFilesBeforeTest: [],
        testRunCount: 2,
      },
    };
    expect(result.filesChanged).toEqual(["src/a.ts", "tests/a.test.ts"]);
    expect(result.tddReport.testWrittenFirst).toBe(true);
    expect(result.error).toBeUndefined();

    const withError: ImplementResult = {
      filesChanged: [],
      tddReport: {
        testWrittenFirst: false,
        testRanBeforeProduction: false,
        productionFilesBeforeTest: [],
        testRunCount: 0,
      },
      error: "Dispatch timed out",
    };
    expect(withError.error).toBe("Dispatch timed out");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`
Expected: FAIL — "ImplementResult" is not exported from "../extensions/megapowers/subagent/pipeline-results.js"

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-results.ts` after the existing imports:

```typescript
import type { TddComplianceReport } from "./tdd-auditor.js";

export interface ImplementResult {
  filesChanged: string[];
  tddReport: TddComplianceReport;
  error?: string;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
