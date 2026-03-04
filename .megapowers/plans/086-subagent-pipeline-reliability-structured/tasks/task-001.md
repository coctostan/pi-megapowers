---
id: 1
title: Create pipeline-schemas.ts with ReviewFrontmatterSchema
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/subagent/pipeline-schemas.ts
  - tests/pipeline-schemas-review.test.ts
---

### Task 1: Create pipeline-schemas.ts with ReviewFrontmatterSchema

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-schemas.ts`
- Test: `tests/pipeline-schemas-review.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/pipeline-schemas-review.test.ts
import { describe, it, expect } from "bun:test";
import { ReviewFrontmatterSchema } from "../extensions/megapowers/subagent/pipeline-schemas.js";

describe("ReviewFrontmatterSchema", () => {
  it("validates approve and reject verdicts and rejects invalid values", () => {
    const approve = ReviewFrontmatterSchema.safeParse({ verdict: "approve" });
    expect(approve.success).toBe(true);
    if (approve.success) expect(approve.data.verdict).toBe("approve");

    const reject = ReviewFrontmatterSchema.safeParse({ verdict: "reject" });
    expect(reject.success).toBe(true);
    if (reject.success) expect(reject.data.verdict).toBe("reject");

    const invalid = ReviewFrontmatterSchema.safeParse({ verdict: "maybe" });
    expect(invalid.success).toBe(false);

    const missing = ReviewFrontmatterSchema.safeParse({});
    expect(missing.success).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-schemas-review.test.ts`
Expected: FAIL — Cannot find module "../extensions/megapowers/subagent/pipeline-schemas.js"

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/subagent/pipeline-schemas.ts
import { z } from "zod";

export const ReviewVerdictEnum = z.enum(["approve", "reject"]);
export type ReviewVerdictValue = z.infer<typeof ReviewVerdictEnum>;

export const ReviewFrontmatterSchema = z.object({
  verdict: ReviewVerdictEnum,
});
export type ReviewFrontmatter = z.infer<typeof ReviewFrontmatterSchema>;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-schemas-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
