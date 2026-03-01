# Plan: Entity Parser + Plan Schemas

## Overview

Build three new modules under `extensions/megapowers/`: `entity-parser.ts` (generic frontmatter parser using gray-matter + zod), `plan-schemas.ts` (zod schemas for plan tasks, summaries, reviews), and `plan-store.ts` (file I/O for reading/writing plan entities to disk). All standalone — no existing code modified.

**Test runner:** `bun test`
**Test location:** `tests/` (e.g., `tests/entity-parser.test.ts`)
**Source location:** `extensions/megapowers/` (e.g., `extensions/megapowers/entity-parser.ts`)

## AC Coverage Map

| AC | Task(s) |
|----|---------|
| 1 (parse valid frontmatter) | 2 |
| 2 (malformed YAML error) | 3 |
| 3 (missing frontmatter error) | 4 |
| 4 (validation error with field/message) | 5 |
| 5 (serializeEntity roundtrip) | 6 |
| 6 (serializeEntity throws on invalid) | 7 |
| 7 (PlanTaskSchema valid) | 8, 9 |
| 8 (PlanTaskSchema rejects bad status) | 9 |
| 9 (PlanSummarySchema valid) | 10 |
| 10 (PlanReviewSchema valid) | 11 |
| 11 (writePlanTask) | 12 |
| 12 (readPlanTask) | 13 |
| 13 (listPlanTasks sorted) | 14 |
| 14 (listPlanTasks duplicate ID error) | 15 |
| 15 (writePlanSummary) | 16 |
| 16 (readPlanSummary) | 16 |
| 17 (writePlanReview) | 17 |
| 18 (readPlanReview) | 17 |
| 19 (writePlanTask doesn't modify others) | 12 |
| 20 (task ID gaps allowed) | 14 |
| 21 (reads return null/empty, writes create dirs) | 12, 13, 14, 16, 17 |
| 22 (ParseError type structure) | 3, 4, 5 |

---

### Task 1: Add gray-matter and zod dependencies [no-test]

**Justification:** Dependency installation only — no behavioral code to test.

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
**Step 1 — Make the change**
Run:
```bash
bun add gray-matter zod
```
**Step 2 — Verify**
Run: `bun test`
Expected: All existing tests pass. `gray-matter` and `zod` appear in `package.json`, and `bun.lock` is updated.

---

### Task 2: parseFrontmatterEntity — valid parse [depends: 1]

> Covers AC 1

**Files:**
- Create: `extensions/megapowers/entity-parser.ts`
- Create: `tests/entity-parser.test.ts`
- Test: `tests/entity-parser.test.ts`

**Step 1 — Write the failing test**
```typescript
// tests/entity-parser.test.ts
import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { parseFrontmatterEntity } from "../extensions/megapowers/entity-parser.js";

const TestSchema = z.object({
  title: z.string(),
  count: z.number(),
});

describe("parseFrontmatterEntity", () => {
  it("parses valid frontmatter and returns success with data and content", () => {
    const markdown = `---
title: Hello
count: 42
---
## Body

Some content here.`;

    const result = parseFrontmatterEntity(markdown, TestSchema);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data).toEqual({ title: "Hello", count: 42 });
    expect(result.content).toContain("## Body");
    expect(result.content).toContain("Some content here.");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/entity-parser.test.ts`
Expected: FAIL — Cannot find module `../extensions/megapowers/entity-parser.js`

**Step 3 — Write minimal implementation**
```typescript
// extensions/megapowers/entity-parser.ts
import matter from "gray-matter";
import { z } from "zod";
export interface ParseError {
  type: "yaml" | "missing_frontmatter" | "validation";
  field?: string;
  message?: string;
}
export type ParseResult<T> =
  | { success: true; data: T; content: string }
  | { success: false; errors: ParseError[] };
export function parseFrontmatterEntity<T>(
  markdown: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  const parsed = matter(markdown);
  const validation = schema.safeParse(parsed.data);
  if (!validation.success) {
    // Detailed zod issue mapping is added in Task 5.
    return { success: false, errors: [{ type: "validation" }] };
  }

  return { success: true, data: validation.data, content: parsed.content };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/entity-parser.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 3: parseFrontmatterEntity — malformed YAML error [depends: 2]

> Covers AC 2, AC 22 (type: "yaml")

**Files:**
- Modify: `tests/entity-parser.test.ts`
- Test: `tests/entity-parser.test.ts`

**Step 1 — Write the failing test**
Add to the `parseFrontmatterEntity` describe block in `tests/entity-parser.test.ts`:
```typescript
  it("returns yaml error for malformed YAML frontmatter", () => {
    const markdown = `---
title: "unterminated
count: 1
---
Body text`;
    const result = parseFrontmatterEntity(markdown, TestSchema);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.errors[0].type).toBe("yaml");
  });
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/entity-parser.test.ts -t "malformed YAML"`
Expected: FAIL — the test crashes with an uncaught exception from `gray-matter` while parsing YAML (no `{ success: false }` result is returned yet).
**Step 3 — Write minimal implementation**
Update `parseFrontmatterEntity` to catch YAML/frontmatter parse exceptions from `gray-matter` and return a structured yaml error:
```typescript
export function parseFrontmatterEntity<T>(
  markdown: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  let parsed: any;
  try {
    parsed = matter(markdown);
  } catch (err: any) {
    return { success: false, errors: [{ type: "yaml", message: err?.message }] };
  }

  const validation = schema.safeParse(parsed.data);
  if (!validation.success) {
    return { success: false, errors: [{ type: "validation" }] };
  }

  return { success: true, data: validation.data, content: parsed.content };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/entity-parser.test.ts -t "malformed YAML"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 4: parseFrontmatterEntity — missing frontmatter error [depends: 3]

> Covers AC 3, AC 22 (type: "missing_frontmatter")

**Files:**
- Modify: `tests/entity-parser.test.ts`
- Test: `tests/entity-parser.test.ts`

**Step 1 — Write the failing test**
Add to the `parseFrontmatterEntity` describe block:
```typescript
  it("returns missing_frontmatter error when no frontmatter delimiters", () => {
    const markdown = `# Just a heading

No frontmatter here.`;

    const result = parseFrontmatterEntity(markdown, TestSchema);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].type).toBe("missing_frontmatter");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/entity-parser.test.ts -t "missing_frontmatter"`
Expected: FAIL — `parseFrontmatterEntity` currently returns a `validation` error (because `gray-matter` treats the whole input as body with empty `data`) rather than `missing_frontmatter`.
**Step 3 — Write minimal implementation**
Update `parseFrontmatterEntity` in `extensions/megapowers/entity-parser.ts` to add the delimiter check at the top:
```typescript
export function parseFrontmatterEntity<T>(
  markdown: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  if (!markdown.trimStart().startsWith("---")) {
    return { success: false, errors: [{ type: "missing_frontmatter" }] };
  }

  let parsed: any;
  try {
    parsed = matter(markdown);
  } catch (err: any) {
    return { success: false, errors: [{ type: "yaml", message: err?.message }] };
  }

  const validation = schema.safeParse(parsed.data);
  if (!validation.success) {
    return { success: false, errors: [{ type: "validation" }] };
  }

  return { success: true, data: validation.data, content: parsed.content };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/entity-parser.test.ts -t "missing_frontmatter"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 5: parseFrontmatterEntity — validation error with field path [depends: 4]

> Covers AC 4, AC 22 (type: "validation" with field + message)

**Files:**
- Modify: `tests/entity-parser.test.ts`
- Test: `tests/entity-parser.test.ts`

**Step 1 — Write the failing test**
Add to the `parseFrontmatterEntity` describe block:
```typescript
  it("returns validation errors with field and message for schema failures", () => {
    const markdown = `---
title: 123
---
Body`;

    const result = parseFrontmatterEntity(markdown, TestSchema);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.errors.length).toBeGreaterThanOrEqual(1);

    const titleError = result.errors.find((e) => e.field === "title");
    const countError = result.errors.find((e) => e.field === "count");
    expect(titleError).toBeDefined();
    expect(titleError!.type).toBe("validation");
    expect(typeof titleError!.message).toBe("string");
    expect(countError).toBeDefined();
    expect(countError!.type).toBe("validation");
    expect(typeof countError!.message).toBe("string");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/entity-parser.test.ts -t "validation errors"`
Expected: FAIL — the function currently returns only `{ type: "validation" }` without per-field `field`/`message`, so `countError` is `undefined`.
**Step 3 — Write minimal implementation**
Update `parseFrontmatterEntity` in `extensions/megapowers/entity-parser.ts` to map zod issues to per-field errors:
```typescript
export function parseFrontmatterEntity<T>(
  markdown: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  if (!markdown.trimStart().startsWith("---")) {
    return { success: false, errors: [{ type: "missing_frontmatter" }] };
  }

  let parsed: any;
  try {
    parsed = matter(markdown);
  } catch (err: any) {
    return { success: false, errors: [{ type: "yaml", message: err?.message }] };
  }

  const validation = schema.safeParse(parsed.data);
  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.issues.map((issue) => ({
        type: "validation" as const,
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  return { success: true, data: validation.data, content: parsed.content };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/entity-parser.test.ts -t "validation errors"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 6: serializeEntity — roundtrip [depends: 5]

> Covers AC 5

**Files:**
- Modify: `extensions/megapowers/entity-parser.ts`
- Modify: `tests/entity-parser.test.ts`
- Test: `tests/entity-parser.test.ts`

**Step 1 — Write the failing test**
Add to `tests/entity-parser.test.ts`:
```typescript
// Update the existing import to also include `serializeEntity`:
import { parseFrontmatterEntity, serializeEntity } from "../extensions/megapowers/entity-parser.js";

describe("serializeEntity", () => {
  it("produces markdown that roundtrips through parseFrontmatterEntity", () => {
    const data = { title: "Hello", count: 42 };
    const content = "## Body\n\nSome content here.\n";

    const serialized = serializeEntity(data, content, TestSchema);
    expect(typeof serialized).toBe("string");
    expect(serialized).toContain("---");

    const parsed = parseFrontmatterEntity(serialized, TestSchema);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("unreachable");
    expect(parsed.data).toEqual(data);
    expect(parsed.content.trimStart()).toBe(content);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/entity-parser.test.ts -t "roundtrips"`
Expected: FAIL — import error (the module does not provide an export named `serializeEntity`)

**Step 3 — Write minimal implementation**
Add to `extensions/megapowers/entity-parser.ts`:
```typescript
export function serializeEntity<T>(
  data: T,
  content: string,
  _schema: z.ZodType<T>,
): string {
  // Data validation is added in Task 7.
  return matter.stringify(content, data as Record<string, unknown>);
}
```

Note: `matter.stringify(content, data)` produces `---\nYAML\n---\ncontent`. Import `matter` default to access `stringify`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/entity-parser.test.ts -t "roundtrips"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 7: serializeEntity — throws on invalid data [depends: 6]

> Covers AC 6

**Files:**
- Modify: `extensions/megapowers/entity-parser.ts`
- Modify: `tests/entity-parser.test.ts`
- Test: `tests/entity-parser.test.ts`

**Step 1 — Write the failing test**
Add to the `serializeEntity` describe block:
```typescript
  it("throws when data fails schema validation", () => {
    const invalidData = { title: 123 } as any; // missing count, wrong type
    expect(() => serializeEntity(invalidData, "body", TestSchema)).toThrow(
      /Invalid entity data/,
    );
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/entity-parser.test.ts -t "throws when data fails"`
Expected: FAIL — assertion error: expected function to throw
**Step 3 — Write minimal implementation**
Update `serializeEntity` to validate `data` against the provided zod schema and throw on invalid input:
```typescript
export function serializeEntity<T>(
  data: T,
  content: string,
  schema: z.ZodType<T>,
): string {
  const validation = schema.safeParse(data);
  if (!validation.success) {
    throw new Error(
      `Invalid entity data: ${validation.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`,
    );
  }
  return matter.stringify(content, validation.data as Record<string, unknown>);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/entity-parser.test.ts -t "throws when data fails"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 8: PlanTaskSchema — validates valid task [depends: 1]

> Covers AC 7 (schema shape + defaults; status enum enforcement is added in Task 9)
**Bundling rationale:** This task covers one schema contract (AC 7) with two it blocks — one for full-field input and one for optional-field defaults — because both validate the same schema definition change.

**Files:**
- Create: `extensions/megapowers/plan-schemas.ts`
- Create: `tests/plan-schemas.test.ts`
- Test: `tests/plan-schemas.test.ts`

**Step 1 — Write the failing test**
```typescript
// tests/plan-schemas.test.ts
import { describe, it, expect } from "bun:test";
import { PlanTaskSchema } from "../extensions/megapowers/plan-schemas.js";

describe("PlanTaskSchema", () => {
  it("validates a complete task with all fields", () => {
    const result = PlanTaskSchema.safeParse({
      id: 1,
      title: "Build entity parser",
      status: "draft",
      depends_on: [2, 3],
      no_test: true,
      files_to_modify: ["src/foo.ts"],
      files_to_create: ["src/bar.ts"],
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.id).toBe(1);
    expect(result.data.status).toBe("draft");
  });

  it("applies defaults for optional fields", () => {
    const result = PlanTaskSchema.safeParse({
      id: 1,
      title: "Minimal task",
      status: "approved",
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.depends_on).toEqual([]);
    expect(result.data.no_test).toBe(false);
    expect(result.data.files_to_modify).toEqual([]);
    expect(result.data.files_to_create).toEqual([]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-schemas.test.ts`
Expected: FAIL — Cannot find module `../extensions/megapowers/plan-schemas.js`

**Step 3 — Write minimal implementation**
```typescript
// extensions/megapowers/plan-schemas.ts
import { z } from "zod";

export const PlanTaskStatusEnum = z.string(); // tightened to enum in Task 9
export type PlanTaskStatus = z.infer<typeof PlanTaskStatusEnum>;

export const PlanTaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: PlanTaskStatusEnum,
  depends_on: z.array(z.number()).default([]),
  no_test: z.boolean().default(false),
  files_to_modify: z.array(z.string()).default([]),
  files_to_create: z.array(z.string()).default([]),
});
export type PlanTask = z.infer<typeof PlanTaskSchema>;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-schemas.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 9: PlanTaskSchema — rejects invalid status [depends: 8]

> Covers AC 8

**Files:**
- Modify: `tests/plan-schemas.test.ts`
- Test: `tests/plan-schemas.test.ts`

**Step 1 — Write the failing test**
Add to the `PlanTaskSchema` describe block:
```typescript
  it("rejects invalid status values", () => {
    const result = PlanTaskSchema.safeParse({
      id: 1,
      title: "Bad status",
      status: "completed",
    });
    expect(result.success).toBe(false);
  });

```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-schemas.test.ts -t "rejects invalid status"`
Expected: FAIL — the schema currently accepts any string for `status`, so `result.success` is `true` for `status: "completed"`.
**Step 3 — Write minimal implementation**
Tighten `PlanTaskStatusEnum` to the required enum values in `extensions/megapowers/plan-schemas.ts`:
```typescript
export const PlanTaskStatusEnum = z.enum(["draft", "approved", "needs_revision"]);
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-schemas.test.ts -t "rejects invalid status"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 10: PlanSummarySchema [depends: 8]

> Covers AC 9
**Bundling rationale:** This task covers one schema unit (`PlanSummarySchema`) with one happy-path and focused invalid-case checks for required constraints.

**Files:**
- Modify: `extensions/megapowers/plan-schemas.ts`
- Modify: `tests/plan-schemas.test.ts`
- Test: `tests/plan-schemas.test.ts`

**Step 1 — Write the failing test**
Add to `tests/plan-schemas.test.ts`:
```typescript
// Update the existing import to also include `PlanSummarySchema`:
import { PlanTaskSchema, PlanSummarySchema } from "../extensions/megapowers/plan-schemas.js";

describe("PlanSummarySchema", () => {
  it("validates a complete plan summary", () => {
    const result = PlanSummarySchema.safeParse({
      type: "plan",
      issue: "066-plan-review-iterative-loop",
      status: "draft",
      iteration: 1,
      task_count: 5,
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.type).toBe("plan");
    expect(result.data.iteration).toBe(1);
  });

  it("rejects non-positive iteration", () => {
    const result = PlanSummarySchema.safeParse({
      type: "plan",
      issue: "test",
      status: "draft",
      iteration: 0,
      task_count: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative task_count", () => {
    const result = PlanSummarySchema.safeParse({
      type: "plan",
      issue: "test",
      status: "in_review",
      iteration: 1,
      task_count: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = PlanSummarySchema.safeParse({
      type: "plan",
      issue: "test",
      status: "rejected",
      iteration: 1,
      task_count: 0,
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-schemas.test.ts -t "PlanSummarySchema"`
Expected: FAIL — `PlanSummarySchema` not exported

**Step 3 — Write minimal implementation**
Add to `extensions/megapowers/plan-schemas.ts`:
```typescript
export const PlanSummaryStatusEnum = z.enum(["draft", "in_review", "approved"]);
export type PlanSummaryStatus = z.infer<typeof PlanSummaryStatusEnum>;

export const PlanSummarySchema = z.object({
  type: z.literal("plan"),
  issue: z.string(),
  status: PlanSummaryStatusEnum,
  iteration: z.number().int().positive(),
  task_count: z.number().int().nonnegative(),
});
export type PlanSummary = z.infer<typeof PlanSummarySchema>;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-schemas.test.ts -t "PlanSummarySchema"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 11: PlanReviewSchema [depends: 10]

> Covers AC 10
**Bundling rationale:** This task keeps all `PlanReviewSchema` contract checks together because they share one schema implementation change.

**Files:**
- Modify: `extensions/megapowers/plan-schemas.ts`
- Modify: `tests/plan-schemas.test.ts`
- Test: `tests/plan-schemas.test.ts`

**Step 1 — Write the failing test**
Add to `tests/plan-schemas.test.ts`:
```typescript
// Update the existing import to also include `PlanReviewSchema`:
import { PlanTaskSchema, PlanSummarySchema, PlanReviewSchema } from "../extensions/megapowers/plan-schemas.js";

describe("PlanReviewSchema", () => {
  it("validates a complete plan review", () => {
    const result = PlanReviewSchema.safeParse({
      type: "plan-review",
      iteration: 1,
      verdict: "revise",
      reviewed_tasks: [1, 2, 3],
      approved_tasks: [1, 3],
      needs_revision_tasks: [2],
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.verdict).toBe("revise");
    expect(result.data.approved_tasks).toEqual([1, 3]);
  });

  it("rejects invalid verdict", () => {
    const result = PlanReviewSchema.safeParse({
      type: "plan-review",
      iteration: 1,
      verdict: "reject",
      reviewed_tasks: [],
      approved_tasks: [],
      needs_revision_tasks: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects wrong type literal", () => {
    const result = PlanReviewSchema.safeParse({
      type: "review",
      iteration: 1,
      verdict: "approve",
      reviewed_tasks: [],
      approved_tasks: [],
      needs_revision_tasks: [],
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-schemas.test.ts -t "PlanReviewSchema"`
Expected: FAIL — `PlanReviewSchema` not exported

**Step 3 — Write minimal implementation**
Add to `extensions/megapowers/plan-schemas.ts`:
```typescript
export const PlanReviewVerdictEnum = z.enum(["approve", "revise"]);
export type PlanReviewVerdict = z.infer<typeof PlanReviewVerdictEnum>;

export const PlanReviewSchema = z.object({
  type: z.literal("plan-review"),
  iteration: z.number().int().positive(),
  verdict: PlanReviewVerdictEnum,
  reviewed_tasks: z.array(z.number()),
  approved_tasks: z.array(z.number()),
  needs_revision_tasks: z.array(z.number()),
});
export type PlanReview = z.infer<typeof PlanReviewSchema>;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-schemas.test.ts -t "PlanReviewSchema"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 12: writePlanTask + file path convention [depends: 7, 9]

> Covers AC 11, AC 19
**Bundling rationale:** All assertions in this task validate the single `writePlanTask` behavior contract (path format, directory creation, and non-modification of other task files).

**Files:**
- Create: `extensions/megapowers/plan-store.ts`
- Create: `tests/plan-store.test.ts`
- Test: `tests/plan-store.test.ts`

**Step 1 — Write the failing test**
```typescript
// tests/plan-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writePlanTask } from "../extensions/megapowers/plan-store.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "plan-store-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("writePlanTask", () => {
  it("writes a task file to the correct path with zero-padded ID", () => {
    const task = {
      data: { id: 3, title: "Test task", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "## Description\n\nTask body here.",
    };
    writePlanTask(tmp, "my-issue", task);

    const expectedPath = join(tmp, ".megapowers", "plans", "my-issue", "tasks", "task-03.md");
    expect(existsSync(expectedPath)).toBe(true);

    const written = readFileSync(expectedPath, "utf-8");
    expect(written).toContain("id: 3");
    expect(written).toContain("title: Test task");
    expect(written).toContain("## Description");
  });

  it("creates directories if they don't exist", () => {
    const task = {
      data: { id: 1, title: "First", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "Body",
    };
    // tmp has no .megapowers dir yet
    writePlanTask(tmp, "new-slug", task);
    const expectedPath = join(tmp, ".megapowers", "plans", "new-slug", "tasks", "task-01.md");
    expect(existsSync(expectedPath)).toBe(true);
  });


  it("does not modify other existing task files", () => {
    const task1 = {
      data: { id: 1, title: "First", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "First task body",
    };
    const task2 = {
      data: { id: 2, title: "Second", status: "approved" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "Second task body",
    };

    writePlanTask(tmp, "iso-slug", task1);
    const task1Path = join(tmp, ".megapowers", "plans", "iso-slug", "tasks", "task-01.md");
    const beforeContent = readFileSync(task1Path, "utf-8");

    writePlanTask(tmp, "iso-slug", task2);

    const afterContent = readFileSync(task1Path, "utf-8");
    expect(afterContent).toBe(beforeContent);
  });

});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-store.test.ts`
Expected: FAIL — Cannot find module `../extensions/megapowers/plan-store.js`

**Step 3 — Write minimal implementation**
```typescript
// extensions/megapowers/plan-store.ts
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatterEntity, serializeEntity } from "./entity-parser.js";
import { PlanTaskSchema, type PlanTask } from "./plan-schemas.js";

function zeroPad(id: number): string {
  return String(id).padStart(2, "0");
}

function tasksDir(cwd: string, slug: string): string {
  return join(cwd, ".megapowers", "plans", slug, "tasks");
}

function planDir(cwd: string, slug: string): string {
  return join(cwd, ".megapowers", "plans", slug);
}

export interface EntityDoc<T> {
  data: T;
  content: string;
}

export function writePlanTask(cwd: string, slug: string, task: EntityDoc<PlanTask>): void {
  const dir = tasksDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  const filename = `task-${zeroPad(task.data.id)}.md`;
  const serialized = serializeEntity(task.data, task.content, PlanTaskSchema);
  writeFileSync(join(dir, filename), serialized, "utf-8");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-store.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 13: readPlanTask [depends: 12]

> Covers AC 12, AC 21 (null on missing)

**Bundling rationale:** readPlanTask has exactly two observable outcomes (found vs. not-found), both requiring a single implementation change. Separating them would split one implementation across two tasks.

**Files:**
- Modify: `extensions/megapowers/plan-store.ts`
- Modify: `tests/plan-store.test.ts`
- Test: `tests/plan-store.test.ts`

**Step 1 — Write the failing test**
Add to `tests/plan-store.test.ts`:
```typescript
// Update the existing import to also include `readPlanTask`:
import { writePlanTask, readPlanTask } from "../extensions/megapowers/plan-store.js";

describe("readPlanTask", () => {
  it("reads back a written task", () => {
    const task = {
      data: { id: 2, title: "Read test", status: "approved" as const, depends_on: [1], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "## Details\n\nSome details.",
    };
    writePlanTask(tmp, "read-slug", task);

    const result = readPlanTask(tmp, "read-slug", 2);
    expect(result).not.toBeNull();
    expect(result!.data.id).toBe(2);
    expect(result!.data.title).toBe("Read test");
    expect(result!.data.status).toBe("approved");
    expect(result!.data.depends_on).toEqual([1]);
    expect(result!.content).toContain("## Details");
  });

  it("returns null when file does not exist", () => {
    const result = readPlanTask(tmp, "nonexistent", 99);
    expect(result).toBeNull();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-store.test.ts -t "readPlanTask"`
Expected: FAIL — `readPlanTask` not exported

**Step 3 — Write minimal implementation**
Add to `extensions/megapowers/plan-store.ts`:
```typescript
export function readPlanTask(cwd: string, slug: string, id: number): EntityDoc<PlanTask> | null {
  const filepath = join(tasksDir(cwd, slug), `task-${zeroPad(id)}.md`);
  if (!existsSync(filepath)) return null;

  const raw = readFileSync(filepath, "utf-8");
  const result = parseFrontmatterEntity(raw, PlanTaskSchema);
  if (!result.success) return null;

  return { data: result.data, content: result.content };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-store.test.ts -t "readPlanTask"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 14: listPlanTasks — sorted, gaps allowed [depends: 12]

> Covers AC 13, AC 20, AC 21 (empty array on missing dir)
**Bundling rationale:** This task validates one `listPlanTasks` contract (successful listing behavior), including sort order and allowed ID gaps.

**Files:**
- Modify: `extensions/megapowers/plan-store.ts`
- Modify: `tests/plan-store.test.ts`
- Test: `tests/plan-store.test.ts`

**Step 1 — Write the failing test**
Add to `tests/plan-store.test.ts`:
```typescript
// Update the existing import to also include `listPlanTasks`:
import { writePlanTask, readPlanTask, listPlanTasks } from "../extensions/megapowers/plan-store.js";

describe("listPlanTasks", () => {
  it("returns all tasks sorted by id", () => {
    // Write out of order
    writePlanTask(tmp, "list-slug", {
      data: { id: 3, title: "Third", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "Third task",
    });
    writePlanTask(tmp, "list-slug", {
      data: { id: 1, title: "First", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "First task",
    });

    const tasks = listPlanTasks(tmp, "list-slug");
    expect(Array.isArray(tasks)).toBe(true);
    if ("error" in tasks) throw new Error("unreachable");
    expect(tasks.length).toBe(2);
    expect(tasks[0].data.id).toBe(1);
    expect(tasks[1].data.id).toBe(3);
  });

  it("returns empty array when directory does not exist", () => {
    const tasks = listPlanTasks(tmp, "no-such-slug");
    expect(Array.isArray(tasks)).toBe(true);
    if (!Array.isArray(tasks)) throw new Error("unreachable");
    expect(tasks.length).toBe(0);
  });

  it("handles ID gaps without error", () => {
    // task-01 and task-03 but no task-02
    writePlanTask(tmp, "gap-slug", {
      data: { id: 1, title: "One", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "One",
    });
    writePlanTask(tmp, "gap-slug", {
      data: { id: 3, title: "Three", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "Three",
    });

    const tasks = listPlanTasks(tmp, "gap-slug");
    expect(Array.isArray(tasks)).toBe(true);
    if (!Array.isArray(tasks)) throw new Error("unreachable");
    expect(tasks.length).toBe(2);
    expect(tasks[0].data.id).toBe(1);
    expect(tasks[1].data.id).toBe(3);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-store.test.ts -t "listPlanTasks"`
Expected: FAIL — `listPlanTasks` not exported

**Step 3 — Write minimal implementation**
Add to `extensions/megapowers/plan-store.ts`:
```typescript
export function listPlanTasks(cwd: string, slug: string): EntityDoc<PlanTask>[] | { error: string } {
  const dir = tasksDir(cwd, slug);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("task-") && f.endsWith(".md"))
    .sort();

  const tasks: EntityDoc<PlanTask>[] = [];
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf-8");
    const result = parseFrontmatterEntity(raw, PlanTaskSchema);
    if (!result.success) continue;


    tasks.push({ data: result.data, content: result.content });
  }
  tasks.sort((a, b) => a.data.id - b.data.id);
  return tasks;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-store.test.ts -t "listPlanTasks"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 15: listPlanTasks — duplicate ID error [depends: 14]

> Covers AC 14

**Files:**
- Modify: `tests/plan-store.test.ts`
- Test: `tests/plan-store.test.ts`

**Step 1 — Write the failing test**
Add to the `listPlanTasks` describe block:
```typescript
  it("returns error when two files have the same task ID", () => {
    writePlanTask(tmp, "dup-slug", {
      data: { id: 1, title: "First", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "First",
    });
    // Write a second file with a different filename but same ID in frontmatter
    // We need to write task-02.md but with id: 1 in frontmatter
    const dir = join(tmp, ".megapowers", "plans", "dup-slug", "tasks");
    writeFileSync(
      join(dir, "task-02.md"),
      "---\nid: 1\ntitle: Duplicate\nstatus: draft\n---\nBody",
      "utf-8",
    );

    const result = listPlanTasks(tmp, "dup-slug");
    expect(Array.isArray(result)).toBe(false);
    expect((result as any).error).toContain("Duplicate task ID");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-store.test.ts -t "same task ID"`
Expected: FAIL — `listPlanTasks(...)` returns an array (no error), so `expect(Array.isArray(result)).toBe(false)` fails.
**Step 3 — Write minimal implementation**
Replace the `listPlanTasks` implementation in `extensions/megapowers/plan-store.ts` with the full function including duplicate ID detection:
```typescript
export function listPlanTasks(cwd: string, slug: string): EntityDoc<PlanTask>[] | { error: string } {
  const dir = tasksDir(cwd, slug);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("task-") && f.endsWith(".md"))
    .sort();
  const tasks: EntityDoc<PlanTask>[] = [];
  const seenIds = new Set<number>();
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf-8");
    const result = parseFrontmatterEntity(raw, PlanTaskSchema);
    if (!result.success) continue;
    if (seenIds.has(result.data.id)) {
      return { error: `Duplicate task ID ${result.data.id} found in ${file}` };
    }
    seenIds.add(result.data.id);
    tasks.push({ data: result.data, content: result.content });
  }
  tasks.sort((a, b) => a.data.id - b.data.id);
  return tasks;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-store.test.ts -t "same task ID"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 16: writePlanSummary + readPlanSummary [depends: 12, 10]

> Covers AC 15, AC 16, AC 21
**Bundling rationale:** `writePlanSummary` and `readPlanSummary` are a paired API over the same artifact (`plan.md`) and are validated together in one task.

**Files:**
- Modify: `extensions/megapowers/plan-store.ts`
- Modify: `tests/plan-store.test.ts`
- Test: `tests/plan-store.test.ts`

**Step 1 — Write the failing test**
Add to `tests/plan-store.test.ts`:
```typescript
// Update the existing import to also include `writePlanSummary` and `readPlanSummary`:
import { writePlanTask, readPlanTask, listPlanTasks, writePlanSummary, readPlanSummary } from "../extensions/megapowers/plan-store.js";

describe("writePlanSummary / readPlanSummary", () => {
  it("writes and reads back a plan summary", () => {
    const summary = {
      data: {
        type: "plan" as const,
        issue: "066-plan-review",
        status: "draft" as const,
        iteration: 1,
        task_count: 5,
      },
      content: "## Approach\n\nBuild the thing.",
    };
    writePlanSummary(tmp, "summary-slug", summary);
    const result = readPlanSummary(tmp, "summary-slug");

    expect(result).not.toBeNull();
    expect(result!.data.type).toBe("plan");
    expect(result!.data.issue).toBe("066-plan-review");
    expect(result!.data.iteration).toBe(1);
    expect(result!.content).toContain("## Approach");
  });

  it("returns null when plan.md does not exist", () => {
    const result = readPlanSummary(tmp, "no-summary");
    expect(result).toBeNull();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-store.test.ts -t "PlanSummary"`
Expected: FAIL — `writePlanSummary` / `readPlanSummary` not exported

**Step 3 — Write minimal implementation**
Update imports and add to `extensions/megapowers/plan-store.ts`:
```typescript
// Replace the existing import from ./plan-schemas.js with this expanded version:
import {
  PlanTaskSchema,
  PlanSummarySchema,
  type PlanTask,
  type PlanSummary,
} from "./plan-schemas.js";

export function writePlanSummary(cwd: string, slug: string, summary: EntityDoc<PlanSummary>): void {
  const dir = planDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  const serialized = serializeEntity(summary.data, summary.content, PlanSummarySchema);
  writeFileSync(join(dir, "plan.md"), serialized, "utf-8");
}

export function readPlanSummary(cwd: string, slug: string): EntityDoc<PlanSummary> | null {
  const filepath = join(planDir(cwd, slug), "plan.md");
  if (!existsSync(filepath)) return null;

  const raw = readFileSync(filepath, "utf-8");
  const result = parseFrontmatterEntity(raw, PlanSummarySchema);
  if (!result.success) return null;

  return { data: result.data, content: result.content };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-store.test.ts -t "PlanSummary"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 17: writePlanReview + readPlanReview [depends: 12, 11]

> Covers AC 17, AC 18, AC 21
**Bundling rationale:** `writePlanReview` and `readPlanReview` are a paired API over the same artifact (`review.md`) and are validated together in one task.

**Files:**
- Modify: `extensions/megapowers/plan-store.ts`
- Modify: `tests/plan-store.test.ts`
- Test: `tests/plan-store.test.ts`

**Step 1 — Write the failing test**
Add to `tests/plan-store.test.ts`:
```typescript
// Update the existing import to also include `writePlanReview` and `readPlanReview`:
import { writePlanTask, readPlanTask, listPlanTasks, writePlanSummary, readPlanSummary, writePlanReview, readPlanReview } from "../extensions/megapowers/plan-store.js";

describe("writePlanReview / readPlanReview", () => {
  it("writes and reads back a plan review", () => {
    const review = {
      data: {
        type: "plan-review" as const,
        iteration: 2,
        verdict: "revise" as const,
        reviewed_tasks: [1, 2, 3],
        approved_tasks: [1],
        needs_revision_tasks: [2, 3],
      },
      content: "## Summary\n\nNeeds work on tasks 2 and 3.",
    };
    writePlanReview(tmp, "review-slug", review);
    const result = readPlanReview(tmp, "review-slug");

    expect(result).not.toBeNull();
    expect(result!.data.type).toBe("plan-review");
    expect(result!.data.verdict).toBe("revise");
    expect(result!.data.approved_tasks).toEqual([1]);
    expect(result!.data.needs_revision_tasks).toEqual([2, 3]);
    expect(result!.content).toContain("## Summary");
  });

  it("returns null when review.md does not exist", () => {
    const result = readPlanReview(tmp, "no-review");
    expect(result).toBeNull();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-store.test.ts -t "PlanReview"`
Expected: FAIL — `writePlanReview` / `readPlanReview` not exported

**Step 3 — Write minimal implementation**
Update imports and add to `extensions/megapowers/plan-store.ts`:
```typescript
// Replace the existing import from ./plan-schemas.js with this expanded version:
import {
  PlanTaskSchema,
  PlanSummarySchema,
  PlanReviewSchema,
  type PlanTask,
  type PlanSummary,
  type PlanReview,
} from "./plan-schemas.js";

export function writePlanReview(cwd: string, slug: string, review: EntityDoc<PlanReview>): void {
  const dir = planDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  const serialized = serializeEntity(review.data, review.content, PlanReviewSchema);
  writeFileSync(join(dir, "review.md"), serialized, "utf-8");
}

export function readPlanReview(cwd: string, slug: string): EntityDoc<PlanReview> | null {
  const filepath = join(planDir(cwd, slug), "review.md");
  if (!existsSync(filepath)) return null;

  const raw = readFileSync(filepath, "utf-8");
  const result = parseFrontmatterEntity(raw, PlanReviewSchema);
  if (!result.success) return null;

  return { data: result.data, content: result.content };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-store.test.ts -t "PlanReview"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing
