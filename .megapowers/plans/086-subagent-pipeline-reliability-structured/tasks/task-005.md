---
id: 5
title: parseReviewOutput empty-output fallback
status: approved
depends_on:
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-results.ts
  - tests/pipeline-results.test.ts
files_to_create: []
---

### Task 5: parseReviewOutput empty-output fallback [depends: 4]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts`

**Step 1 — Write the failing test**

Append to `tests/pipeline-results.test.ts`:

```typescript
describe("parseReviewOutput empty output", () => {
  it("returns reject with a stable empty-output parse error finding", () => {
    const result = parseReviewOutput("\n\n");
    expect(result.verdict).toBe("reject");
    expect(result.findings).toEqual(["Review parse error: empty output"]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`
Expected: FAIL — `expect(received).toEqual(expected)` — Received `["Review parse error: invalid frontmatter — Required"]` because gray-matter parses `"\n\n"` as `data: {}`, Zod validation fails on the missing `verdict` field, producing the generic invalid-frontmatter message instead of the specific "empty output" message.

**Step 3 — Write minimal implementation**

Add an empty-output guard at the top of `parseReviewOutput` in `extensions/megapowers/subagent/pipeline-results.ts`. Only this guard is new; the rest of the function body from Task 4 is unchanged:

```typescript
export function parseReviewOutput(text: string): ReviewResult {
  if (!text.trim()) {
    return {
      verdict: "reject",
      findings: ["Review parse error: empty output"],
      raw: text,
    };
  }

  const findings: string[] = [];

  try {
    const parsed = matter(text);
    const validation = ReviewFrontmatterSchema.safeParse(parsed.data);

    if (validation.success) {
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
