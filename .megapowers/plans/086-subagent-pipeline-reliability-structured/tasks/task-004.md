---
id: 4
title: Define ReviewResult type and parseReviewOutput with frontmatter Zod validation
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-results.ts
  - tests/pipeline-results.test.ts
files_to_create: []
---

### Task 4: Define ReviewResult type and parseReviewOutput with frontmatter Zod validation [depends: 1]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts`

**Step 1 — Write the failing test**

Append to `tests/pipeline-results.test.ts`:

```typescript
import { parseReviewOutput, type ReviewResult } from "../extensions/megapowers/subagent/pipeline-results.js";

describe("parseReviewOutput", () => {
  it("parses valid frontmatter with approve verdict and extracts findings from body", () => {
    const text = `---
verdict: approve
---

Good implementation.

- Clean code structure
- Tests cover edge cases`;

    const result = parseReviewOutput(text);
    expect(result.verdict).toBe("approve");
    expect(result.findings).toEqual(["Clean code structure", "Tests cover edge cases"]);
    expect(result.raw).toBe(text);
  });

  it("parses valid frontmatter with reject verdict", () => {
    const text = `---
verdict: reject
---

Issues found:

- Missing error handling in parser
- No edge case coverage`;

    const result = parseReviewOutput(text);
    expect(result.verdict).toBe("reject");
    expect(result.findings).toEqual(["Missing error handling in parser", "No edge case coverage"]);
    expect(result.raw).toBe(text);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`
Expected: FAIL — "parseReviewOutput" is not exported from "../extensions/megapowers/subagent/pipeline-results.js"

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-results.ts`:

```typescript
import matter from "gray-matter";
import { ReviewFrontmatterSchema } from "./pipeline-schemas.js";

export interface ReviewResult {
  verdict: "approve" | "reject";
  findings: string[];
  raw: string;
}

export function parseReviewOutput(text: string): ReviewResult {
  const findings: string[] = [];

  try {
    const parsed = matter(text);
    const validation = ReviewFrontmatterSchema.safeParse(parsed.data);

    if (validation.success) {
      // Extract bullet findings from the markdown body
      for (const line of parsed.content.split("\n")) {
        const m = line.match(/^[-*]\s+(.+)/);
        if (m) findings.push(m[1].trim());
      }
      return {
        verdict: validation.data.verdict,
        findings,
        raw: text,
      };
    }

    // Invalid frontmatter data — fall through to fallback
    const errors = validation.error.issues.map((i) => i.message).join("; ");
    return {
      verdict: "reject",
      findings: [`Review parse error: invalid frontmatter — ${errors}`],
      raw: text,
    };
  } catch (err: any) {
    return {
      verdict: "reject",
      findings: [`Review parse error: ${err?.message ?? "unknown"}`],
      raw: text,
    };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
