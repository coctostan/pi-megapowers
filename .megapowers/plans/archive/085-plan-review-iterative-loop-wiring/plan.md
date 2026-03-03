# Plan: Plan-Review Iterative Loop Wiring

## Overview

This plan wires the #066 data layer (entity-parser, plan-schemas, plan-store) into production and replaces the split `plan` + `review` phases with a single `plan` phase containing an internal draft/review/revise loop. Two new tools (`megapowers_plan_task` and `megapowers_plan_review`) handle structured data flow. On approval, a backward-compatible `plan.md` is generated so downstream consumers continue working.

---

### Task 1: Entity parser — parseFrontmatterEntity and serializeEntity

**Files:**
- Create: `extensions/megapowers/state/entity-parser.ts`
- Test: `tests/entity-parser.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/entity-parser.test.ts
import { describe, it, expect } from "bun:test";
import { parseFrontmatterEntity, serializeEntity, type EntityDoc } from "../extensions/megapowers/state/entity-parser.js";
import { z } from "zod";

const TestSchema = z.object({
  id: z.number(),
  title: z.string(),
  active: z.boolean().default(false),
});
type TestData = z.infer<typeof TestSchema>;

describe("parseFrontmatterEntity", () => {
  it("parses valid frontmatter markdown into EntityDoc", () => {
    const md = `---
id: 1
title: Hello
active: true
---
Body content here.`;
    const result = parseFrontmatterEntity(md, TestSchema);
    expect(result).not.toBeNull();
    expect("error" in (result as any)).toBe(false);
    const doc = result as EntityDoc<TestData>;
    expect(doc.data.id).toBe(1);
    expect(doc.data.title).toBe("Hello");
    expect(doc.data.active).toBe(true);
    expect(doc.content).toBe("Body content here.");
  });

  it("applies schema defaults for missing optional fields", () => {
    const md = `---
id: 2
title: Test
---
Some body.`;
    const doc = parseFrontmatterEntity(md, TestSchema) as EntityDoc<TestData>;
    expect(doc.data.active).toBe(false);
  });

  it("returns { error } for invalid data that fails schema validation", () => {
    const md = `---
id: not-a-number
title: Test
---
Body.`;
    const result = parseFrontmatterEntity(md, TestSchema);
    expect(result).not.toBeNull();
    expect("error" in (result as any)).toBe(true);
    expect((result as { error: string }).error).toContain("id");
  });

  it("returns { error } for malformed YAML frontmatter", () => {
    const md = `---
id: [unclosed
---
Body.`;
    const result = parseFrontmatterEntity(md, TestSchema);
    expect(result).not.toBeNull();
    expect("error" in (result as any)).toBe(true);
  });

  it("returns { error } for markdown with no frontmatter", () => {
    const result = parseFrontmatterEntity("Just plain text", TestSchema);
    expect(result).not.toBeNull();
    expect("error" in (result as any)).toBe(true);
  });

  it("trims body content whitespace", () => {
    const md = `---
id: 1
title: Trim
---

  Some body with leading space.

`;
    const doc = parseFrontmatterEntity(md, TestSchema) as EntityDoc<TestData>;
    expect(doc.content).toBe("Some body with leading space.");
  });
});

describe("serializeEntity", () => {
  it("serializes data and content into frontmatter markdown", () => {
    const data = { id: 1, title: "Hello", active: true };
    const result = serializeEntity(data, "Body content.");
    expect(result).toContain("---");
    expect(result).toContain("id: 1");
    expect(result).toContain("title: Hello");
    expect(result).toContain("active: true");
    expect(result).toContain("Body content.");
  });

  it("roundtrips through parse and serialize", () => {
    const original = { id: 5, title: "Roundtrip", active: false };
    const body = "Markdown body\n\nWith paragraphs.";
    const serialized = serializeEntity(original, body);
    const parsed = parseFrontmatterEntity(serialized, TestSchema) as EntityDoc<TestData>;
    expect(parsed.data.id).toBe(5);
    expect(parsed.data.title).toBe("Roundtrip");
    expect(parsed.data.active).toBe(false);
    expect(parsed.content).toBe(body);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/entity-parser.test.ts`
Expected: FAIL — Cannot find module `../extensions/megapowers/state/entity-parser.js`

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/state/entity-parser.ts
import matter from "gray-matter";
import { stringify as yamlStringify } from "yaml";
import type { ZodSchema } from "zod";

export interface EntityDoc<T> {
  data: T;
  content: string;
}

/**
 * Parse frontmatter markdown into a typed entity document.
 * Returns EntityDoc<T> on success, { error } on parse/validation failure, null is unused here
 * (callers check file existence separately and pass null for not-found).
 */
export function parseFrontmatterEntity<T>(
  markdown: string,
  schema: ZodSchema<T>,
): EntityDoc<T> | { error: string } {
  let parsed: { data: Record<string, unknown>; content: string };
  try {
    parsed = matter(markdown);
  } catch (e) {
    return { error: `Failed to parse frontmatter: ${e instanceof Error ? e.message : String(e)}` };
  }

  // gray-matter returns empty data when there's no frontmatter delimiter
  if (!markdown.trimStart().startsWith("---")) {
    return { error: "No frontmatter found (missing --- delimiters)" };
  }

  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { error: `Schema validation failed: ${issues}` };
  }

  return {
    data: result.data,
    content: parsed.content.trim(),
  };
}

/**
 * Serialize data and markdown body into frontmatter markdown.
 */
export function serializeEntity<T extends Record<string, unknown>>(data: T, content: string): string {
  const yaml = yamlStringify(data).trim();
  return `---\n${yaml}\n---\n\n${content}\n`;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/entity-parser.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 36 (correct return types — EntityDoc<T> | { error: string } from the start).

---

### Task 2: Plan schemas — PlanTaskSchema, PlanReviewSchema [depends: 1]

**Files:**
- Create: `extensions/megapowers/state/plan-schemas.ts`
- Test: `tests/plan-schemas.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/plan-schemas.test.ts
import { describe, it, expect } from "bun:test";
import {
  PlanTaskSchema,
  PlanReviewSchema,
  type PlanTask,
  type PlanReview,
} from "../extensions/megapowers/state/plan-schemas.js";

describe("PlanTaskSchema", () => {
  it("validates a complete task", () => {
    const result = PlanTaskSchema.safeParse({
      id: 1,
      title: "Build feature",
      status: "draft",
      depends_on: [2, 3],
      no_test: false,
      files_to_modify: ["src/foo.ts"],
      files_to_create: ["src/bar.ts"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(1);
      expect(result.data.title).toBe("Build feature");
      expect(result.data.status).toBe("draft");
    }
  });

  it("applies defaults for optional fields", () => {
    const result = PlanTaskSchema.safeParse({
      id: 1,
      title: "Minimal task",
      status: "draft",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.depends_on).toEqual([]);
      expect(result.data.no_test).toBe(false);
      expect(result.data.files_to_modify).toEqual([]);
      expect(result.data.files_to_create).toEqual([]);
    }
  });

  it("rejects invalid status enum", () => {
    const result = PlanTaskSchema.safeParse({
      id: 1,
      title: "Bad",
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = PlanTaskSchema.safeParse({ id: 1 });
    expect(result.success).toBe(false);
  });

  it("accepts all valid status values", () => {
    for (const status of ["draft", "approved", "needs_revision"]) {
      const result = PlanTaskSchema.safeParse({ id: 1, title: "T", status });
      expect(result.success).toBe(true);
    }
  });
});

describe("PlanReviewSchema", () => {
  it("validates a complete review", () => {
    const result = PlanReviewSchema.safeParse({
      type: "plan-review",
      iteration: 1,
      verdict: "approve",
      reviewed_tasks: [1, 2, 3],
      approved_tasks: [1, 2, 3],
      needs_revision_tasks: [],
    });
    expect(result.success).toBe(true);
  });

  it("validates a revise verdict", () => {
    const result = PlanReviewSchema.safeParse({
      type: "plan-review",
      iteration: 2,
      verdict: "revise",
      reviewed_tasks: [1, 2],
      approved_tasks: [1],
      needs_revision_tasks: [2],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verdict).toBe("revise");
      expect(result.data.needs_revision_tasks).toEqual([2]);
    }
  });

  it("rejects invalid verdict", () => {
    const result = PlanReviewSchema.safeParse({
      type: "plan-review",
      iteration: 1,
      verdict: "maybe",
      reviewed_tasks: [],
      approved_tasks: [],
      needs_revision_tasks: [],
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-schemas.test.ts`
Expected: FAIL — Cannot find module `../extensions/megapowers/state/plan-schemas.js`

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/state/plan-schemas.ts
import { z } from "zod";

export const PlanTaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(["draft", "approved", "needs_revision"]),
  depends_on: z.array(z.number()).default([]),
  no_test: z.boolean().default(false),
  files_to_modify: z.array(z.string()).default([]),
  files_to_create: z.array(z.string()).default([]),
});

export type PlanTask = z.infer<typeof PlanTaskSchema>;

export const PlanReviewSchema = z.object({
  type: z.literal("plan-review"),
  iteration: z.number(),
  verdict: z.enum(["approve", "revise"]),
  reviewed_tasks: z.array(z.number()),
  approved_tasks: z.array(z.number()),
  needs_revision_tasks: z.array(z.number()),
});

export type PlanReview = z.infer<typeof PlanReviewSchema>;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-schemas.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 3: Plan store — write, read, list operations [depends: 1, 2]

**Files:**
- Create: `extensions/megapowers/state/plan-store.ts`
- Test: `tests/plan-store.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/plan-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writePlanTask,
  readPlanTask,
  listPlanTasks,
  writePlanReview,
  readPlanReview,
  zeroPad,
} from "../extensions/megapowers/state/plan-store.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";
import type { EntityDoc } from "../extensions/megapowers/state/entity-parser.js";

describe("zeroPad", () => {
  it("pads single digit to 3 chars", () => {
    expect(zeroPad(1)).toBe("001");
    expect(zeroPad(9)).toBe("009");
  });

  it("pads double digit to 3 chars", () => {
    expect(zeroPad(42)).toBe("042");
  });

  it("handles triple digit without padding", () => {
    expect(zeroPad(100)).toBe("100");
    expect(zeroPad(999)).toBe("999");
  });
});

describe("plan-store", () => {
  let tmp: string;
  const slug = "001-test-issue";

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "plan-store-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("writePlanTask + readPlanTask", () => {
    it("writes and reads a task roundtrip", () => {
      const task: PlanTask = {
        id: 1,
        title: "First task",
        status: "draft",
        depends_on: [2],
        no_test: false,
        files_to_modify: ["src/foo.ts"],
        files_to_create: [],
      };
      writePlanTask(tmp, slug, task, "Task body content.");
      const result = readPlanTask(tmp, slug, 1);
      expect(result).not.toBeNull();
      expect("error" in (result as any)).toBe(false);
      const doc = result as EntityDoc<PlanTask>;
      expect(doc.data.id).toBe(1);
      expect(doc.data.title).toBe("First task");
      expect(doc.data.depends_on).toEqual([2]);
      expect(doc.content).toBe("Task body content.");
    });

    it("creates file at correct path with 3-digit zero padding", () => {
      const task: PlanTask = {
        id: 5,
        title: "Padded",
        status: "draft",
        depends_on: [],
        no_test: false,
        files_to_modify: [],
        files_to_create: [],
      };
      writePlanTask(tmp, slug, task, "Body.");
      const expectedPath = join(tmp, ".megapowers", "plans", slug, "tasks", "task-005.md");
      expect(existsSync(expectedPath)).toBe(true);
    });

    it("returns null for nonexistent task", () => {
      expect(readPlanTask(tmp, slug, 99)).toBeNull();
    });
  });

  describe("listPlanTasks", () => {
    it("returns empty array when no tasks directory", () => {
      expect(listPlanTasks(tmp, slug)).toEqual([]);
    });

    it("returns tasks sorted by ID", () => {
      const makeTask = (id: number): PlanTask => ({
        id,
        title: `Task ${id}`,
        status: "draft",
        depends_on: [],
        no_test: false,
        files_to_modify: [],
        files_to_create: [],
      });
      writePlanTask(tmp, slug, makeTask(3), "Body 3.");
      writePlanTask(tmp, slug, makeTask(1), "Body 1.");
      writePlanTask(tmp, slug, makeTask(2), "Body 2.");

      const tasks = listPlanTasks(tmp, slug);
      expect(tasks.length).toBe(3);
      expect(tasks[0].data.id).toBe(1);
      expect(tasks[1].data.id).toBe(2);
      expect(tasks[2].data.id).toBe(3);
    });

    it("writing one task does not modify others", () => {
      const task1: PlanTask = {
        id: 1, title: "First", status: "draft",
        depends_on: [], no_test: false, files_to_modify: [], files_to_create: [],
      };
      const task2: PlanTask = {
        id: 2, title: "Second", status: "draft",
        depends_on: [], no_test: false, files_to_modify: [], files_to_create: [],
      };
      writePlanTask(tmp, slug, task1, "Body 1.");
      writePlanTask(tmp, slug, task2, "Body 2.");

      const doc1 = readPlanTask(tmp, slug, 1) as EntityDoc<PlanTask>;
      expect(doc1.data.title).toBe("First");
      expect(doc1.content).toBe("Body 1.");
    });
  });

  describe("writePlanReview + readPlanReview", () => {
    it("writes and reads a review roundtrip", () => {
      writePlanReview(tmp, slug, {
        type: "plan-review",
        iteration: 1,
        verdict: "approve",
        reviewed_tasks: [1, 2],
        approved_tasks: [1, 2],
        needs_revision_tasks: [],
      }, "Looks good overall.");

      const result = readPlanReview(tmp, slug, 1);
      expect(result).not.toBeNull();
      expect("error" in (result as any)).toBe(false);
      const doc = result as EntityDoc<any>;
      expect(doc.data.verdict).toBe("approve");
      expect(doc.content).toBe("Looks good overall.");
    });

    it("returns null for nonexistent review", () => {
      expect(readPlanReview(tmp, slug, 1)).toBeNull();
    });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-store.test.ts`
Expected: FAIL — Cannot find module `../extensions/megapowers/state/plan-store.js`

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/state/plan-store.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatterEntity, serializeEntity, type EntityDoc } from "./entity-parser.js";
import { PlanTaskSchema, PlanReviewSchema, type PlanTask, type PlanReview } from "./plan-schemas.js";

export function zeroPad(n: number): string {
  return String(n).padStart(3, "0");
}

function tasksDir(cwd: string, slug: string): string {
  return join(cwd, ".megapowers", "plans", slug, "tasks");
}

function taskFilePath(cwd: string, slug: string, id: number): string {
  return join(tasksDir(cwd, slug), `task-${zeroPad(id)}.md`);
}

function reviewFilePath(cwd: string, slug: string, iteration: number): string {
  return join(cwd, ".megapowers", "plans", slug, `review-${zeroPad(iteration)}.md`);
}

export function writePlanTask(cwd: string, slug: string, task: PlanTask, body: string): void {
  const dir = tasksDir(cwd, slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const md = serializeEntity(task as unknown as Record<string, unknown>, body);
  writeFileSync(taskFilePath(cwd, slug, task.id), md);
}

export function readPlanTask(cwd: string, slug: string, id: number): EntityDoc<PlanTask> | { error: string } | null {
  const filePath = taskFilePath(cwd, slug, id);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  return parseFrontmatterEntity(content, PlanTaskSchema);
}

export function listPlanTasks(cwd: string, slug: string): EntityDoc<PlanTask>[] {
  const dir = tasksDir(cwd, slug);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.startsWith("task-") && f.endsWith(".md")).sort();
  const results: EntityDoc<PlanTask>[] = [];
  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf-8");
    const parsed = parseFrontmatterEntity(content, PlanTaskSchema);
    if (parsed && !("error" in parsed)) {
      results.push(parsed);
    }
  }
  return results;
}

export function writePlanReview(
  cwd: string,
  slug: string,
  review: PlanReview,
  feedback: string,
): void {
  const dir = join(cwd, ".megapowers", "plans", slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const md = serializeEntity(review as unknown as Record<string, unknown>, feedback);
  writeFileSync(reviewFilePath(cwd, slug, review.iteration), md);
}

export function readPlanReview(
  cwd: string,
  slug: string,
  iteration: number,
): EntityDoc<PlanReview> | { error: string } | null {
  const filePath = reviewFilePath(cwd, slug, iteration);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  return parseFrontmatterEntity(content, PlanReviewSchema);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-store.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 36 (return types), AC 37 (zeroPad 3 digits).

---

### Task 4: State machine — planMode and planIteration fields [depends: 1]

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Modify: `extensions/megapowers/state/state-io.ts`
- Test: `tests/state-machine.test.ts`

**Step 1 — Write the failing test**

Add to `tests/state-machine.test.ts`:

```typescript
// Add these tests to the existing describe blocks:

describe("createInitialState — planMode and planIteration", () => {
  it("returns planMode: null", () => {
    const state = createInitialState();
    expect(state.planMode).toBeNull();
  });

  it("returns planIteration: 0", () => {
    const state = createInitialState();
    expect(state.planIteration).toBe(0);
  });
});

describe("MAX_PLAN_ITERATIONS", () => {
  it("is exported and equals 4", () => {
    // Import MAX_PLAN_ITERATIONS at top of file
    expect(MAX_PLAN_ITERATIONS).toBe(4);
  });
});
```

Also add a test to `tests/state-io.test.ts` to verify KNOWN_KEYS includes the new fields:

```typescript
describe("KNOWN_KEYS roundtrip", () => {
  it("preserves planMode and planIteration through write/read", () => {
    const state = createInitialState();
    state.planMode = "draft";
    state.planIteration = 2;
    writeState(tmp, state);
    const read = readState(tmp);
    expect(read.planMode).toBe("draft");
    expect(read.planIteration).toBe(2);
  });

  it("strips unknown keys on read", () => {
    const state = { ...createInitialState(), unknownField: "garbage" };
    writeState(tmp, state as any);
    const read = readState(tmp);
    expect((read as any).unknownField).toBeUndefined();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-machine.test.ts tests/state-io.test.ts`
Expected: FAIL — `planMode` property does not exist on `MegapowersState`; `MAX_PLAN_ITERATIONS` is not exported

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/state-machine.ts`:
1. Add `PlanMode` type: `export type PlanMode = "draft" | "review" | "revise" | null;`
2. Add `MAX_PLAN_ITERATIONS = 4` constant export.
3. Add to `MegapowersState` interface: `planMode: PlanMode;` and `planIteration: number;`
4. In `createInitialState()`: add `planMode: null` and `planIteration: 0`.

In `extensions/megapowers/state/state-io.ts`:
1. Add `"planMode"` and `"planIteration"` to `KNOWN_KEYS`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-machine.test.ts tests/state-io.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 1 (planMode type), AC 2 (KNOWN_KEYS), AC 3 (createInitialState defaults), AC 38 (MAX_PLAN_ITERATIONS = 4).

---

### Task 5: Transition hooks — planMode set on enter/leave plan phase [depends: 4]

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Test: `tests/state-machine.test.ts`

**Step 1 — Write the failing test**

Add to `tests/state-machine.test.ts`:

```typescript
describe("transition — planMode hooks", () => {
  it("sets planMode to 'draft' and planIteration to 1 when entering plan phase", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
      planMode: null,
      planIteration: 0,
    };
    const next = transition(state, "plan" as Phase);
    expect(next.planMode).toBe("draft");
    expect(next.planIteration).toBe(1);
  });

  it("resets planMode to null when leaving plan phase (plan → implement)", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "plan",
      planMode: "review",
      planIteration: 2,
    };
    const next = transition(state, "implement" as Phase);
    expect(next.planMode).toBeNull();
  });

  it("preserves planMode when transitioning within non-plan phases", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      planMode: null,
      planIteration: 0,
    };
    const next = transition(state, "verify" as Phase);
    expect(next.planMode).toBeNull();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-machine.test.ts`
Expected: FAIL — `next.planMode` is `null` (not `"draft"`) because the enter-plan hook doesn't exist yet

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/state-machine.ts`, in the `transition()` function:

After the existing `if (to === "plan")` block, add:
```typescript
if (to === "plan") {
  next.reviewApproved = false;
  next.planMode = "draft";
  next.planIteration = 1;
}
```

And add a general rule for leaving plan:
```typescript
if (state.phase === "plan" && to !== "plan") {
  next.planMode = null;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-machine.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 4 (entering plan sets draft/1), AC 5 (leaving plan resets planMode).

---

### Task 6: Workflow configs — remove review phase [depends: 5]

**Files:**
- Modify: `extensions/megapowers/workflows/feature.ts`
- Modify: `extensions/megapowers/workflows/bugfix.ts`
- Modify: `tests/workflow-configs.test.ts`
- Modify: `tests/state-machine.test.ts`
- Test: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**

Replace the existing workflow config tests that reference `review`:

```typescript
// In tests/workflow-configs.test.ts — update existing tests:

describe("feature workflow config — no review phase", () => {
  it("has 7 phases in correct order (no review)", () => {
    const phaseNames = featureWorkflow.phases.map(p => p.name);
    expect(phaseNames).toEqual(["brainstorm", "spec", "plan", "implement", "verify", "code-review", "done"]);
  });

  it("has plan → implement as direct transition", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "plan.md" }]);
  });

  it("has no transitions referencing review phase", () => {
    const reviewTransitions = featureWorkflow.transitions.filter(
      t => t.from === "review" || t.to === "review"
    );
    expect(reviewTransitions).toEqual([]);
  });

  it("has no review entry in phases array", () => {
    const hasReview = featureWorkflow.phases.some(p => p.name === "review");
    expect(hasReview).toBe(false);
  });
});

describe("bugfix workflow config — no review phase", () => {
  it("has 6 phases in correct order (no review)", () => {
    const phaseNames = bugfixWorkflow.phases.map(p => p.name);
    expect(phaseNames).toEqual(["reproduce", "diagnose", "plan", "implement", "verify", "done"]);
  });

  it("has no transitions referencing review phase", () => {
    const reviewTransitions = bugfixWorkflow.transitions.filter(
      t => t.from === "review" || t.to === "review"
    );
    expect(reviewTransitions).toEqual([]);
  });
});
```

Also add to `tests/state-machine.test.ts`:

```typescript
describe("Phase type — backward compat", () => {
  it("'review' is still a valid Phase value for backward compat", () => {
    // Type-level check: this compiles without error
    const phase: Phase = "review";
    expect(phase).toBe("review");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/workflow-configs.test.ts tests/state-machine.test.ts`
Expected: FAIL — feature workflow has 8 phases including `review`; transitions still reference `review`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/workflows/feature.ts`:
- Remove `{ name: "review", ... }` from phases array
- Remove `{ from: "plan", to: "review", ... }` transition
- Remove `{ from: "review", to: "implement", ... }` transition
- Remove `{ from: "review", to: "plan", backward: true }` transition
- Keep `{ from: "plan", to: "implement", ... }` transition

In `extensions/megapowers/workflows/bugfix.ts`:
- Same removal of review phase and transitions

In `extensions/megapowers/state/state-machine.ts`:
- Keep `"review"` in the `FeaturePhase` and `BugfixPhase` type unions for backward compatibility

Also update the existing tests in `tests/workflow-configs.test.ts` and `tests/state-machine.test.ts` that reference `review` transitions (remove those tests, update phase count assertions, update transition assertions).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/workflow-configs.test.ts tests/state-machine.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing (some existing tests that reference review transitions will need updating)

Covers AC 23 (feature phases), AC 24 (bugfix phases), AC 25 (no review transitions), AC 26 (Phase type retains "review").

---

### Task 7: tool-plan-task — create new tasks [depends: 3, 5]

**Files:**
- Create: `extensions/megapowers/tools/tool-plan-task.ts`
- Test: `tests/tool-plan-task.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/tool-plan-task.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePlanTask } from "../extensions/megapowers/tools/tool-plan-task.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { readPlanTask } from "../extensions/megapowers/state/plan-store.js";
import type { EntityDoc } from "../extensions/megapowers/state/entity-parser.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

describe("handlePlanTask — create", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-task-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns error when not in plan phase", () => {
    setState(tmp, { phase: "implement", planMode: null });
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "Body" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan phase");
  });

  it("returns error when planMode is review", () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "Body" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("review");
  });

  it("creates a task file in draft mode with all defaults", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, title: "First task", description: "Task body content." });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("Task 1");
    expect(result.message).toContain("First task");

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.id).toBe(1);
    expect(doc.data.title).toBe("First task");
    expect(doc.data.status).toBe("draft");
    expect(doc.data.depends_on).toEqual([]);
    expect(doc.data.no_test).toBe(false);
    expect(doc.data.files_to_modify).toEqual([]);
    expect(doc.data.files_to_create).toEqual([]);
    expect(doc.content).toBe("Task body content.");
  });

  it("returns validation error when title is missing on create", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, description: "Body" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("title");
  });

  it("returns validation error when description is missing on create", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, title: "T" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("description");
  });

  it("creates a task with explicit optional fields", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, {
      id: 2,
      title: "Second",
      description: "Body.",
      depends_on: [1],
      no_test: true,
      files_to_modify: ["src/foo.ts"],
      files_to_create: ["src/bar.ts"],
    });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 2) as EntityDoc<PlanTask>;
    expect(doc.data.depends_on).toEqual([1]);
    expect(doc.data.no_test).toBe(true);
    expect(doc.data.files_to_modify).toEqual(["src/foo.ts"]);
    expect(doc.data.files_to_create).toEqual(["src/bar.ts"]);
  });

  it("response includes file path", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "B" });
    expect(result.message).toContain("task-001.md");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: FAIL — Cannot find module `../extensions/megapowers/tools/tool-plan-task.js`

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/tools/tool-plan-task.ts
import { readState } from "../state/state-io.js";
import { readPlanTask, writePlanTask } from "../state/plan-store.js";
import { PlanTaskSchema, type PlanTask } from "../state/plan-schemas.js";
import type { EntityDoc } from "../state/entity-parser.js";

export interface PlanTaskParams {
  id: number;
  title?: string;
  description?: string;
  depends_on?: number[];
  no_test?: boolean;
  files_to_modify?: string[];
  files_to_create?: string[];
}

export interface PlanTaskResult {
  message?: string;
  error?: string;
}

export function handlePlanTask(cwd: string, params: PlanTaskParams): PlanTaskResult {
  const state = readState(cwd);

  if (state.phase !== "plan") {
    return { error: "megapowers_plan_task can only be called during the plan phase." };
  }
  if (state.planMode === "review") {
    return { error: "megapowers_plan_task is blocked during review mode. Use megapowers_plan_review to submit your verdict." };
  }
  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return { error: `megapowers_plan_task requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
  }

  const slug = state.activeIssue!;
  const existing = readPlanTask(cwd, slug, params.id);

  // Existing task updates are implemented in Task 8
  if (existing && !("error" in existing)) {
    return { error: `❌ Task ${params.id} already exists. Updates are implemented in Task 8.` };
  }

  // Create new task — require title and description
  if (!params.title) {
    return { error: `❌ Task ${params.id} invalid: title is required when creating a new task.` };
  }
  if (!params.description) {
    return { error: `❌ Task ${params.id} invalid: description is required when creating a new task.` };
  }

  const task: PlanTask = {
    id: params.id,
    title: params.title,
    status: "draft",
    depends_on: params.depends_on ?? [],
    no_test: params.no_test ?? false,
    files_to_modify: params.files_to_modify ?? [],
    files_to_create: params.files_to_create ?? [],
  };

  const validation = PlanTaskSchema.safeParse(task);
  if (!validation.success) {
    const issues = validation.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { error: `❌ Task ${params.id} invalid: ${issues}` };
  }

  writePlanTask(cwd, slug, task, params.description);

  const depsStr = task.depends_on.length > 0 ? task.depends_on.join(", ") : "none";
  const filesCount = task.files_to_modify.length + task.files_to_create.length;
  return {
    message: `✅ Task ${task.id} saved: "${task.title}"\n  → .megapowers/plans/${slug}/tasks/task-${String(task.id).padStart(3, "0")}.md\n  depends_on: [${depsStr}] | files: ${filesCount}`,
  };
}

```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 6 (error outside plan), AC 7 (error in review mode), AC 8 (creates file at correct path), AC 9 (requires id/title/description), AC 10 (defaults), AC 13 (response format).

---

### Task 8: tool-plan-task — update existing tasks (partial merge) [depends: 7]

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-task.ts`
- Test: `tests/tool-plan-task.test.ts`

**Step 1 — Write the failing test**

Add to `tests/tool-plan-task.test.ts`:

```typescript
describe("handlePlanTask — update (partial merge)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-task-update-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("merges only provided fields, preserving existing values", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "Original", description: "Original body.", depends_on: [2] });

    // Update only depends_on
    const result = handlePlanTask(tmp, { id: 1, depends_on: [2, 3] });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.title).toBe("Original"); // preserved
    expect(doc.data.depends_on).toEqual([2, 3]); // updated
    expect(doc.content).toBe("Original body."); // preserved
  });

  it("replaces body when description is provided in update", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "Old body." });

    const result = handlePlanTask(tmp, { id: 1, description: "New body." });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.content).toBe("New body.");
  });

  it("preserves body when description is omitted in update", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "Keep this body." });

    const result = handlePlanTask(tmp, { id: 1, title: "Updated title" });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.title).toBe("Updated title");
    expect(doc.content).toBe("Keep this body.");
  });

  it("response includes changed field list", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "B." });

    const result = handlePlanTask(tmp, { id: 1, depends_on: [1, 2] });
    expect(result.message).toContain("depends_on");
  });

  it("works in revise mode (updates existing task)", () => {
    // Create in draft mode
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "B." });
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2 });
    const result = handlePlanTask(tmp, { id: 1, no_test: true });
    expect(result.error).toBeUndefined();
    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.no_test).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: FAIL — update attempts return an error like `❌ Task 1 already exists. Updates are implemented in Task 8.`

**Step 3 — Write minimal implementation**

Update `extensions/megapowers/tools/tool-plan-task.ts` to support partial updates when a task already exists (merge only provided fields; preserve existing body unless `description` provided):

```typescript
// extensions/megapowers/tools/tool-plan-task.ts
import { readState } from "../state/state-io.js";
import { readPlanTask, writePlanTask } from "../state/plan-store.js";
import { PlanTaskSchema, type PlanTask } from "../state/plan-schemas.js";
import type { EntityDoc } from "../state/entity-parser.js";

export interface PlanTaskParams {
  id: number;
  title?: string;
  description?: string;
  depends_on?: number[];
  no_test?: boolean;
  files_to_modify?: string[];
  files_to_create?: string[];
}

export interface PlanTaskResult {
  message?: string;
  error?: string;
}

export function handlePlanTask(cwd: string, params: PlanTaskParams): PlanTaskResult {
  const state = readState(cwd);

  if (state.phase !== "plan") {
    return { error: "megapowers_plan_task can only be called during the plan phase." };
  }
  if (state.planMode === "review") {
    return { error: "megapowers_plan_task is blocked during review mode. Use megapowers_plan_review to submit your verdict." };
  }
  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return { error: `megapowers_plan_task requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
  }

  const slug = state.activeIssue!;
  const existing = readPlanTask(cwd, slug, params.id);

  // Update existing task
  if (existing && !("error" in existing)) {
    return handleUpdate(cwd, slug, existing, params);
  }

  // Create new task — require title and description
  if (!params.title) {
    return { error: `❌ Task ${params.id} invalid: title is required when creating a new task.` };
  }
  if (!params.description) {
    return { error: `❌ Task ${params.id} invalid: description is required when creating a new task.` };
  }

  const task: PlanTask = {
    id: params.id,
    title: params.title,
    status: "draft",
    depends_on: params.depends_on ?? [],
    no_test: params.no_test ?? false,
    files_to_modify: params.files_to_modify ?? [],
    files_to_create: params.files_to_create ?? [],
  };

  const validation = PlanTaskSchema.safeParse(task);
  if (!validation.success) {
    const issues = validation.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { error: `❌ Task ${params.id} invalid: ${issues}` };
  }

  writePlanTask(cwd, slug, task, params.description);

  const depsStr = task.depends_on.length > 0 ? task.depends_on.join(", ") : "none";
  const filesCount = task.files_to_modify.length + task.files_to_create.length;
  return {
    message: `✅ Task ${task.id} saved: "${task.title}"\n  → .megapowers/plans/${slug}/tasks/task-${String(task.id).padStart(3, "0")}.md\n  depends_on: [${depsStr}] | files: ${filesCount}`,
  };
}

function handleUpdate(
  cwd: string,
  slug: string,
  existing: EntityDoc<PlanTask>,
  params: PlanTaskParams,
): PlanTaskResult {
  const changed: string[] = [];
  const merged = { ...existing.data };

  if (params.title !== undefined && params.title !== existing.data.title) {
    merged.title = params.title;
    changed.push("title");
  }
  if (params.depends_on !== undefined) {
    merged.depends_on = params.depends_on;
    changed.push("depends_on");
  }
  if (params.no_test !== undefined) {
    merged.no_test = params.no_test;
    changed.push("no_test");
  }
  if (params.files_to_modify !== undefined) {
    merged.files_to_modify = params.files_to_modify;
    changed.push("files_to_modify");
  }
  if (params.files_to_create !== undefined) {
    merged.files_to_create = params.files_to_create;
    changed.push("files_to_create");
  }

  const body = params.description ?? existing.content;

  if (params.description !== undefined) {
    changed.push("description");
  }

  writePlanTask(cwd, slug, merged, body);

  return {
    message: `✅ Task ${merged.id} updated: "${merged.title}"\n  Changed: ${changed.length > 0 ? changed.join(", ") : "no changes"}`,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 11 (partial merge), AC 12 (description handling in update).

---

### Task 9: plan_draft_done signal [depends: 3, 5]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

Add to `tests/tool-signal.test.ts`:

```typescript
describe("plan_draft_done signal", () => {
  it("transitions planMode from draft to review", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    // Create a task file so validation passes
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

    const result = handleSignal(tmp, "plan_draft_done");
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("review mode");

    const state = readState(tmp);
    expect(state.planMode).toBe("review");
  });

  it("transitions planMode from revise to review", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

    const result = handleSignal(tmp, "plan_draft_done");
    expect(result.error).toBeUndefined();

    const state = readState(tmp);
    expect(state.planMode).toBe("review");
  });

  it("returns error when not in plan phase", () => {
    setState(tmp, { phase: "implement", planMode: null });
    const result = handleSignal(tmp, "plan_draft_done");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan phase");
  });

  it("returns error when planMode is review", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    const result = handleSignal(tmp, "plan_draft_done");
    expect(result.error).toBeDefined();
  });

  it("returns error when no task files exist", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handleSignal(tmp, "plan_draft_done");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("task");
  });

  it("reports task count in success message", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T1\nstatus: draft\n---\nB1.");
    writeFileSync(join(tasksDir, "task-002.md"), "---\nid: 2\ntitle: T2\nstatus: draft\n---\nB2.");

    const result = handleSignal(tmp, "plan_draft_done");
    expect(result.message).toContain("2 tasks");
  });

  it("sets triggerNewSession flag", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nB.");

    const result = handleSignal(tmp, "plan_draft_done");
    expect(result.triggerNewSession).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts`
Expected: FAIL — `Unknown signal action: plan_draft_done`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`:

1. Add `triggerNewSession?: boolean` to `SignalResult` interface.
2. Add `"plan_draft_done"` to the `action` parameter union type.
3. Add case in switch: `case "plan_draft_done": return handlePlanDraftDone(cwd);`
4. Implement `handlePlanDraftDone()`:

```typescript
import { listPlanTasks } from "../state/plan-store.js";

function handlePlanDraftDone(cwd: string): SignalResult {
  const state = readState(cwd);

  if (state.phase !== "plan") {
    return { error: "plan_draft_done can only be called during the plan phase." };
  }
  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return { error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
  }

  const tasks = listPlanTasks(cwd, state.activeIssue!);
  if (tasks.length === 0) {
    return { error: "No task files found. Use megapowers_plan_task to create tasks before signaling draft done." };
  }

  writeState(cwd, { ...state, planMode: "review" });

  return {
    message: `📝 Draft complete: ${tasks.length} task${tasks.length === 1 ? "" : "s"} saved\n  → Transitioning to review mode. newSession() should be called (see Task 18 wiring).`,
    triggerNewSession: true,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 19 (plan_draft_done transitions to review), AC 20 (error on zero tasks), AC 21 (newSession flag), AC 35 (draft→review triggers newSession).

---

### Task 10: review_approve deprecation signal [depends: 6]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

Add to `tests/tool-signal.test.ts`:

```typescript
describe("review_approve deprecation", () => {
  it("returns deprecation error message", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    const result = handleSignal(tmp, "review_approve");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("deprecated");
    expect(result.error).toContain("megapowers_plan_review");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts`
Expected: FAIL — The current `handleReviewApprove` sets `reviewApproved: true` instead of returning a deprecation error.

**Step 3 — Write minimal implementation**

Replace the `handleReviewApprove` function in `extensions/megapowers/tools/tool-signal.ts`:

```typescript
function handleReviewApprove(_cwd: string): SignalResult {
  return {
    error: "❌ review_approve is deprecated. Plan review is now handled by the megapowers_plan_review tool within the plan phase. The reviewer calls megapowers_plan_review({ verdict: \"approve\", ... }) to approve.",
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing (update any existing tests that expect `review_approve` to succeed)

Covers AC 22 (deprecation error for review_approve).

---

### Task 11: generateLegacyPlanMd bridge [depends: 3]

**Files:**
- Create: `extensions/megapowers/state/legacy-plan-bridge.ts`
- Test: `tests/legacy-plan-bridge.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/legacy-plan-bridge.test.ts
import { describe, it, expect } from "bun:test";
import { generateLegacyPlanMd } from "../extensions/megapowers/state/legacy-plan-bridge.js";
import { extractPlanTasks } from "../extensions/megapowers/plan-parser.js";
import type { EntityDoc } from "../extensions/megapowers/state/entity-parser.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";

function makeTask(id: number, title: string, opts?: Partial<PlanTask>): EntityDoc<PlanTask> {
  return {
    data: {
      id,
      title,
      status: "approved",
      depends_on: opts?.depends_on ?? [],
      no_test: opts?.no_test ?? false,
      files_to_modify: opts?.files_to_modify ?? [],
      files_to_create: opts?.files_to_create ?? [],
    },
    content: `Implementation details for task ${id}.`,
  };
}

describe("generateLegacyPlanMd", () => {
  it("generates plan.md with ### Task N: Title headers", () => {
    const tasks = [makeTask(1, "First"), makeTask(2, "Second")];
    const md = generateLegacyPlanMd(tasks);
    expect(md).toContain("### Task 1: First");
    expect(md).toContain("### Task 2: Second");
    expect(md).toContain("Implementation details for task 1.");
    expect(md).toContain("Implementation details for task 2.");
  });

  it("includes [no-test] annotation", () => {
    const tasks = [makeTask(1, "Config change", { no_test: true })];
    const md = generateLegacyPlanMd(tasks);
    expect(md).toContain("[no-test]");
  });

  it("includes [depends: N, M] annotation", () => {
    const tasks = [makeTask(1, "Base"), makeTask(2, "Depends", { depends_on: [1] })];
    const md = generateLegacyPlanMd(tasks);
    expect(md).toContain("[depends: 1]");
  });

  it("is parseable by extractPlanTasks (backward compat)", () => {
    const tasks = [
      makeTask(1, "First task"),
      makeTask(2, "Second task", { depends_on: [1] }),
      makeTask(3, "Config only", { no_test: true }),
    ];
    const md = generateLegacyPlanMd(tasks);
    const parsed = extractPlanTasks(md);

    expect(parsed.length).toBe(3);
    expect(parsed[0].index).toBe(1);
    expect(parsed[0].description).toBe("First task");
    expect(parsed[1].dependsOn).toEqual([1]);
    expect(parsed[2].noTest).toBe(true);
  });

  it("handles empty task list", () => {
    const md = generateLegacyPlanMd([]);
    expect(md).toContain("# Plan");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/legacy-plan-bridge.test.ts`
Expected: FAIL — Cannot find module `../extensions/megapowers/state/legacy-plan-bridge.js`

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/state/legacy-plan-bridge.ts
import type { EntityDoc } from "./entity-parser.js";
import type { PlanTask } from "./plan-schemas.js";

/**
 * Generate a backward-compatible plan.md from approved task files.
 * Output is parseable by extractPlanTasks() in plan-parser.ts.
 */
export function generateLegacyPlanMd(tasks: EntityDoc<PlanTask>[]): string {
  const lines: string[] = ["# Plan\n"];

  for (const task of tasks) {
    const tags: string[] = [];
    if (task.data.no_test) tags.push("[no-test]");
    if (task.data.depends_on.length > 0) {
      tags.push(`[depends: ${task.data.depends_on.join(", ")}]`);
    }
    const tagStr = tags.length > 0 ? ` ${tags.join(" ")}` : "";
    lines.push(`### Task ${task.data.id}: ${task.data.title}${tagStr}\n`);
    lines.push(task.content.trim());
    lines.push("");
  }

  return lines.join("\n");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/legacy-plan-bridge.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 30 (plan.md generation), AC 31 (backward compat with extractPlanTasks).

---

### Task 12: tool-plan-review — revise verdict [depends: 3, 5, 9]

**Files:**
- Create: `extensions/megapowers/tools/tool-plan-review.ts`
- Test: `tests/tool-plan-review.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/tool-plan-review.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePlanReview } from "../extensions/megapowers/tools/tool-plan-review.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { readPlanTask } from "../extensions/megapowers/state/plan-store.js";
import type { EntityDoc } from "../extensions/megapowers/state/entity-parser.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

function createTaskFile(tmp: string, id: number, title: string) {
  const dir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `task-${String(id).padStart(3, "0")}.md`),
    `---\nid: ${id}\ntitle: ${title}\nstatus: draft\n---\nBody for task ${id}.`);
}

describe("handlePlanReview — phase validation", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-review-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns error when not in plan phase", () => {
    setState(tmp, { phase: "implement", planMode: null });
    const result = handlePlanReview(tmp, { verdict: "approve", feedback: "OK" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan phase");
  });

  it("returns error when planMode is not review", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanReview(tmp, { verdict: "approve", feedback: "OK" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("review");
  });
});

describe("handlePlanReview — revise verdict", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-review-revise-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("sets planMode to revise and bumps iteration", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    const result = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Task 2 needs work.",
      approved_tasks: [1],
      needs_revision_tasks: [2],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("REVISE");

    const state = readState(tmp);
    expect(state.planMode).toBe("revise");
    expect(state.planIteration).toBe(2);
  });

  it("updates task statuses per verdict arrays", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Revise task 2.",
      approved_tasks: [1],
      needs_revision_tasks: [2],
    });

    const t1 = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    const t2 = readPlanTask(tmp, "001-test", 2) as EntityDoc<PlanTask>;
    expect(t1.data.status).toBe("approved");
    expect(t2.data.status).toBe("needs_revision");
  });

  it("returns error at iteration cap (MAX_PLAN_ITERATIONS = 4)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 4 });
    createTaskFile(tmp, 1, "T1");

    const result = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Still needs work.",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("4 iterations");
    expect(result.error).toContain("intervention");
  });

  it("sets triggerNewSession flag on revise", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");

    const result = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Fix it.",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(result.triggerNewSession).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-review.test.ts`
Expected: FAIL — Cannot find module `../extensions/megapowers/tools/tool-plan-review.js`

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/tools/tool-plan-review.ts
import { readState, writeState } from "../state/state-io.js";
import { readPlanTask, writePlanTask, listPlanTasks, writePlanReview } from "../state/plan-store.js";
import { generateLegacyPlanMd } from "../state/legacy-plan-bridge.js";
import { MAX_PLAN_ITERATIONS } from "../state/state-machine.js";
import type { EntityDoc } from "../state/entity-parser.js";
import type { PlanTask, PlanReview } from "../state/plan-schemas.js";

export interface PlanReviewParams {
  verdict: "approve" | "revise";
  feedback: string;
  approved_tasks?: number[];
  needs_revision_tasks?: number[];
}

export interface PlanReviewResult {
  message?: string;
  error?: string;
  triggerNewSession?: boolean;
}

export function handlePlanReview(cwd: string, params: PlanReviewParams): PlanReviewResult {
  const state = readState(cwd);

  if (state.phase !== "plan") {
    return { error: "megapowers_plan_review can only be called during the plan phase." };
  }
  if (state.planMode !== "review") {
    return { error: `megapowers_plan_review requires planMode 'review', got '${state.planMode}'.` };
  }

  const slug = state.activeIssue!;
  const approvedIds = params.approved_tasks ?? [];
  const needsRevisionIds = params.needs_revision_tasks ?? [];

  // Write review artifact
  const review: PlanReview = {
    type: "plan-review",
    iteration: state.planIteration,
    verdict: params.verdict,
    reviewed_tasks: [...approvedIds, ...needsRevisionIds],
    approved_tasks: approvedIds,
    needs_revision_tasks: needsRevisionIds,
  };
  writePlanReview(cwd, slug, review, params.feedback);

  // Update task file statuses
  updateTaskStatuses(cwd, slug, approvedIds, "approved");
  updateTaskStatuses(cwd, slug, needsRevisionIds, "needs_revision");

  if (params.verdict === "revise") {
    return handleReviseVerdict(cwd, state, approvedIds, needsRevisionIds);
  }

  // Approve path is handled by Task 13
  return handleApproveVerdict(cwd, state, slug);
}

function handleReviseVerdict(
  cwd: string,
  state: ReturnType<typeof readState>,
  approvedIds: number[],
  needsRevisionIds: number[],
): PlanReviewResult {
  if (state.planIteration >= MAX_PLAN_ITERATIONS) {
    return {
      error: `⚠️ Plan review reached ${MAX_PLAN_ITERATIONS} iterations without approval. Human intervention needed.\n  Use /mega off to disable enforcement and manually advance, or revise the spec.`,
    };
  }

  writeState(cwd, {
    ...state,
    planMode: "revise",
    planIteration: state.planIteration + 1,
  });

  return {
    message: `📋 Plan review: REVISE (iteration ${state.planIteration + 1} of ${MAX_PLAN_ITERATIONS})\n  ✅ Tasks ${approvedIds.join(", ") || "none"} approved\n  ⚠️ Tasks ${needsRevisionIds.join(", ") || "none"} need revision\n  → Transitioning to revise mode. newSession() should be called (see Task 18 wiring).`,
    triggerNewSession: true,
  };
}

function handleApproveVerdict(
  cwd: string,
  state: ReturnType<typeof readState>,
  slug: string,
): PlanReviewResult {
  // Placeholder — full implementation in Task 13
  return { error: "approve verdict not yet implemented" };
}

function updateTaskStatuses(
  cwd: string,
  slug: string,
  taskIds: number[],
  status: "approved" | "needs_revision",
): void {
  for (const id of taskIds) {
    const existing = readPlanTask(cwd, slug, id);
    if (existing && !("error" in existing)) {
      writePlanTask(cwd, slug, { ...existing.data, status }, existing.content);
    }
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 14 (error outside plan/review), AC 16 (revise verdict), AC 17 (iteration cap), AC 18 (task status updates), AC 35 (review→revise triggers newSession).

---

### Task 13: tool-plan-review — approve verdict [depends: 11, 12]

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Test: `tests/tool-plan-review.test.ts`

**Step 1 — Write the failing test**

Add to `tests/tool-plan-review.test.ts`:

```typescript
describe("handlePlanReview — approve verdict", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-review-approve-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("sets all task statuses to approved", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "Looks great.",
      approved_tasks: [1, 2],
      needs_revision_tasks: [],
    });

    const t1 = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    const t2 = readPlanTask(tmp, "001-test", 2) as EntityDoc<PlanTask>;
    expect(t1.data.status).toBe("approved");
    expect(t2.data.status).toBe("approved");
  });

  it("generates plan.md file", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "First task");
    createTaskFile(tmp, 2, "Second task");

    handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "Approved.",
      approved_tasks: [1, 2],
    });

    const planPath = join(tmp, ".megapowers", "plans", "001-test", "plan.md");
    expect(existsSync(planPath)).toBe(true);
    const content = readFileSync(planPath, "utf-8");
    expect(content).toContain("### Task 1: First task");
    expect(content).toContain("### Task 2: Second task");
  });

  it("advances to implement phase", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");

    handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "Good.",
      approved_tasks: [1],
    });

    const state = readState(tmp);
    expect(state.phase).toBe("implement");
    expect(state.planMode).toBeNull();
  });

  it("returns success message with task count", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    const result = handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "All good.",
      approved_tasks: [1, 2],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("approved");
    expect(result.message).toContain("2");
    expect(result.message).toContain("implement");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-review.test.ts`
Expected: FAIL — `handleApproveVerdict` returns "not yet implemented" error

**Step 3 — Write minimal implementation**

Replace the `handleApproveVerdict` placeholder in `extensions/megapowers/tools/tool-plan-review.ts`:

```typescript
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { transition, type Phase } from "../state/state-machine.js";
import { deriveTasks } from "../state/derived.js";

function handleApproveVerdict(
  cwd: string,
  state: ReturnType<typeof readState>,
  slug: string,
): PlanReviewResult {
  const tasks = listPlanTasks(cwd, slug);

  // Set all task statuses to approved
  updateTaskStatuses(cwd, slug, tasks.map(t => t.data.id), "approved");

  // Generate backward-compatible plan.md
  const planMd = generateLegacyPlanMd(tasks);
  const planDir = join(cwd, ".megapowers", "plans", slug);
  writeFileSync(join(planDir, "plan.md"), planMd);

  // Advance to implement phase. Note: transition() internally resets planMode to null
  // when leaving the plan phase (Task 5 hook), so the explicit null set below is defensive.
  const updatedState = { ...readState(cwd), planMode: null as any };
  const derivedTasks = deriveTasks(cwd, slug);
  const newState = transition(updatedState, "implement" as Phase, derivedTasks);
  writeState(cwd, newState);

  return {
    message: `📋 Plan approved (iteration ${state.planIteration})\n  ✅ All ${tasks.length} tasks approved\n  → Generated plan.md for downstream consumers\n  → Advancing to implement phase`,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 15 (approve writes review, sets statuses, generates plan.md, advances to implement).

---

### Task 14: Write policy — plan mode awareness [depends: 4]

**Files:**
- Modify: `extensions/megapowers/policy/write-policy.ts`
- Modify: `extensions/megapowers/tools/tool-overrides.ts`
- Modify: `extensions/megapowers/hooks.ts`

- Test: `tests/write-policy-plan-mode.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/write-policy-plan-mode.test.ts
import { describe, it, expect } from "bun:test";
import { canWrite, type WriteDecision } from "../extensions/megapowers/policy/write-policy.js";
import type { PlanMode } from "../extensions/megapowers/state/state-machine.js";

describe("canWrite — plan mode awareness", () => {
  const taskFilePath = ".megapowers/plans/001-test/tasks/task-001.md";
  const nonTaskMegaPath = ".megapowers/plans/001-test/spec.md";
  const sourceFilePath = "src/foo.ts";

  it("blocks write/edit to task files in draft mode", () => {
    const result = canWrite("plan", taskFilePath, true, false, null, "draft");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("task");
  });

  it("blocks write/edit to task files in review mode", () => {
    const result = canWrite("plan", taskFilePath, true, false, null, "review");
    expect(result.allowed).toBe(false);
  });

  it("allows edit to task files in revise mode", () => {
    const result = canWrite("plan", taskFilePath, true, false, null, "revise", "edit");
    expect(result.allowed).toBe(true);
  });

  it("blocks write (not edit) to task files in revise mode", () => {
    const result = canWrite("plan", taskFilePath, true, false, null, "revise", "write");
    expect(result.allowed).toBe(false);
  });

  it("allows non-task .megapowers/ paths in all plan modes", () => {
    for (const mode of ["draft", "review", "revise"] as PlanMode[]) {
      const result = canWrite("plan", nonTaskMegaPath, true, false, null, mode);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks source code writes in plan phase (blocking phase)", () => {
    const result = canWrite("plan", sourceFilePath, true, false, null, "draft");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blocked");
  });

  it("ignores planMode for non-plan phases", () => {
    const result = canWrite("implement", taskFilePath, true, false, null, null);
    // implement is a TDD phase, task file is in .megapowers/ — allowed
    expect(result.allowed).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/write-policy-plan-mode.test.ts`
Expected: FAIL — `canWrite` doesn't accept `planMode` parameter yet

**Step 3 — Write minimal implementation**

In `extensions/megapowers/policy/write-policy.ts`, update `canWrite` signature:

```typescript
import type { Phase, TddTaskState, PlanMode } from "../state/state-machine.js";

const TASK_FILE_PATTERN = /\.megapowers\/plans\/[^/]+\/tasks\//;

function isTaskFile(filePath: string): boolean {
  return TASK_FILE_PATTERN.test(filePath);
}

export function canWrite(
  phase: Phase | null,
  filePath: string,
  megaEnabled: boolean,
  taskIsNoTest: boolean,
  tddState: TddTaskState | null,
  planMode?: PlanMode,
  toolName?: "write" | "edit",
): WriteDecision {
  if (!megaEnabled) return { allowed: true };
  if (!phase) return { allowed: true };

  // .megapowers/ paths — check plan mode task file restrictions first
  if (filePath.startsWith(".megapowers/") || filePath.includes("/.megapowers/")) {
    if (phase === "plan" && isTaskFile(filePath) && planMode) {
      if (planMode === "draft" || planMode === "review") {
        return {
          allowed: false,
          reason: `Task file writes are blocked in ${planMode} mode. Use megapowers_plan_task tool to create/update tasks.`,
        };
      }
      if (planMode === "revise" && toolName === "write") {
        return {
          allowed: false,
          reason: "Use edit (not write) for task file body changes in revise mode, or megapowers_plan_task for frontmatter updates.",
        };
      }
      // revise + edit = allowed
    }
    return { allowed: true };
  }

  // ... rest of existing canWrite logic unchanged
```

In `extensions/megapowers/tools/tool-overrides.ts`, pass planMode and toolName:

```typescript
export function evaluateWriteOverride(
  cwd: string,
  filePath: string,
  toolName?: "write" | "edit",
): WriteOverrideResult {
  const state = readState(cwd);

  let taskIsNoTest = false;
  if (state.activeIssue && (state.phase === "implement" || state.phase === "code-review")) {
    const tasks = deriveTasks(cwd, state.activeIssue);
    const currentTask = tasks[state.currentTaskIndex];
    taskIsNoTest = currentTask?.noTest ?? false;
  }

  const decision = canWrite(
    state.phase, filePath, state.megaEnabled, taskIsNoTest, state.tddTaskState,
    state.planMode ?? undefined,
    toolName,
  );
  // ... rest unchanged
```

Update the hook in `extensions/megapowers/hooks.ts` to pass toolName:

```typescript
export async function onToolCall(event: any, ctx: any, _deps: Deps): Promise<any> {
  const toolName = event.toolName;
  if (toolName !== "write" && toolName !== "edit") return;
  const filePath: string | undefined = (event.input as any)?.path;
  if (!filePath) return;
  const decision = evaluateWriteOverride(ctx.cwd, filePath, toolName as "write" | "edit");
  // ... rest unchanged
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/write-policy-plan-mode.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 27 (draft blocks task file writes), AC 28 (review blocks modifications), AC 29 (revise allows edit, blocks write).

---

### Task 15: Prompt routing — planMode-aware template selection [depends: 4, 16]

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to `tests/prompt-inject.test.ts`:

```typescript
describe("buildInjectedPrompt — plan mode routing", () => {
  it("loads write-plan.md when planMode is draft", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    // write-plan.md contains "megapowers_plan_task" instruction
    expect(result).toContain("megapowers_plan_task");
  });

  it("loads review-plan.md when planMode is review", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_plan_review");
  });

  it("loads revise-plan.md when planMode is revise", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("revise");
  });
});

> **Note for implementer:** The existing `tests/prompt-inject.test.ts` likely has tests that set `phase: "review"` for the old separate review phase. When implementing Task 15, update or remove those tests — the `"review"` planMode is now handled by the `planMode: "review"` path inside the `plan` phase, not by `phase: "review"`. Replace any `phase: "review"` prompt-inject test with a `{ phase: "plan", planMode: "review" }` equivalent, or delete it if superseded by the new tests above.
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts`
Expected: FAIL — plan phase always loads `write-plan.md` regardless of planMode

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, add plan mode routing before the standard template selection:

```typescript
// After building vars, before the existing phase prompt template section:

// Plan mode routing — load different templates based on planMode
if (state.phase === "plan" && state.planMode) {
  const PLAN_MODE_TEMPLATES: Record<string, string> = {
    draft: "write-plan.md",
    review: "review-plan.md",
    revise: "revise-plan.md",
  };
  const templateName = PLAN_MODE_TEMPLATES[state.planMode];
  if (templateName) {
    const template = loadPromptFile(templateName);
    if (template) {
      const phasePrompt = interpolatePrompt(template, vars);
      if (phasePrompt) parts.push(phasePrompt);
    }
  }
} else if (state.phase !== "done") {
  // Existing phase prompt template logic (unchanged)
  const template = getPhasePromptTemplate(state.phase);
  if (template) {
    const phasePrompt = interpolatePrompt(template, vars);
    if (phasePrompt) parts.push(phasePrompt);
  }
} else if (state.doneActions.length > 0) {
  // Existing done phase logic (unchanged)
  // ...
}
```

This replaces the existing `if (state.phase !== "done")` block with a conditional that checks for plan mode first.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 32 (draft → write-plan.md), AC 33 (review → review-plan.md), AC 34 (revise → revise-plan.md).

---

### Task 16: Prompt templates — update write-plan.md, review-plan.md, megapowers-protocol.md, create revise-plan.md, update workflow diagrams [no-test]

**Justification:** Prompt template files are markdown content — no behavioral code to test. The prompt routing (Task 15) is what gets tested. Template content changes are verified by the routing tests loading the correct files.
**Files:**
- Modify: `prompts/megapowers-protocol.md`
- Modify: `prompts/write-plan.md`
- Modify: `prompts/review-plan.md`
- Create: `prompts/revise-plan.md`
- Modify: `prompts/brainstorm.md`
- Modify: `prompts/write-spec.md`
- Modify: `prompts/code-review.md`
- Modify: `prompts/verify.md`
- Modify: `prompts/implement-task.md`
- Modify: `prompts/diagnose-bug.md`
- Modify: `prompts/reproduce-bug.md`

**Step 1 — Make the changes**

**`prompts/megapowers-protocol.md`** — two targeted edits:

1. Line 8 (`8:b1`): Update `phase_back` backward-transitions parenthetical — remove `review→plan` (review phase no longer exists):
   ```
   - `{ action: "phase_back" }` — Go back one phase using workflow-defined backward transitions (verify→implement, code-review→implement)
   ```

2. Line 10 (`10:68`): Replace `review_approve` as a normal action with a deprecation note:
   ```
   - `{ action: "review_approve" }` — ⚠️ **Deprecated.** Plan review is now handled by the `megapowers_plan_review` tool within the plan phase.
   ```

**`prompts/write-plan.md`** — three targeted edits:

1. Line 3 (`3:9c`): Update workflow diagram — remove the `review` phase:
   ```
   > **Workflow:** brainstorm → spec → **plan** → implement → verify → code-review → done
   ```

2. Lines 97–102 (`97:da`–`102:49`): Replace the entire "Saving" section to reflect the new tool-based flow:
   ```markdown
## Saving Tasks
   For each task, call the `megapowers_plan_task` tool with structured parameters:

   ```
   megapowers_plan_task({
     id: 1,
     title: "Task title",
     description: "Full task body — TDD steps, code blocks, implementation details (markdown)",
     depends_on: [2, 3],
     no_test: false,
     files_to_modify: ["path/to/existing.ts"],
     files_to_create: ["path/to/new.ts"]
   })
   ```
After all tasks are saved, call `megapowers_signal({ action: "plan_draft_done" })` to submit for review.
   ```

**`prompts/review-plan.md`** — three targeted edits:

1. Line 3 (`3:98`): Update workflow diagram — remove `review` phase, bold `plan`:
   ```
   > **Workflow:** brainstorm → spec → **plan (review)** → implement → verify → code-review → done
   ```

2. Lines 81–85 (`80:fc`–`85:95`): Replace the entire "After Review" section with the new tool-based approval flow:
   ```markdown
   ## After Review

   Submit your verdict via the `megapowers_plan_review` tool:
**To approve:**
   ```
   megapowers_plan_review({
     verdict: "approve",
     feedback: "Your overall assessment...",
     approved_tasks: [1, 2, 3, ...],
   })
   ```
**To request revisions:**
   ```
   megapowers_plan_review({
     verdict: "revise",
     feedback: "Per-task assessment, issues found, suggestions...",
     approved_tasks: [1, 3],
     needs_revision_tasks: [2, 4],
   })
   ```

   Do not approve a plan that has unresolved issues.
   ```
**`prompts/revise-plan.md`** — New file:
```markdown
You are revising a plan based on reviewer feedback.
> **Workflow:** brainstorm → spec → **plan (revise)** → implement → verify → code-review → done
## Context
Issue: {{issue_slug}}
Read the latest review artifact in `.megapowers/plans/{{issue_slug}}/` for detailed per-task feedback.
## Instructions
1. Read the review feedback from the review artifact file
2. Read task files in `.megapowers/plans/{{issue_slug}}/tasks/`
3. Tasks marked `needs_revision` need updates. Tasks marked `approved` should generally be left alone.
```
megapowers_plan_task({ id: N, depends_on: [1, 2], files_to_modify: [...] })
```
**For body changes** (implementation details, test code):
Use `read` + `edit` to make surgical changes to existing task files.
```

**Workflow diagram updates — 7 remaining prompts** (all remove `review` from the diagram):

- `prompts/brainstorm.md` line 3 (`3:69`):
  ```
  > **Workflow:** **brainstorm** → spec → plan → implement → verify → code-review → done
  ```
- `prompts/write-spec.md` line 3 (`3:73`):
  ```
  > **Workflow:** brainstorm → **spec** → plan → implement → verify → code-review → done
  ```
- `prompts/code-review.md` line 3 (`3:7c`):
  ```
  > **Workflow:** brainstorm → spec → plan → implement → verify → **code-review** → done
  ```
- `prompts/verify.md` line 3 (`3:20`):
  ```
  > **Workflow:** brainstorm → spec → plan → implement → **verify** → code-review → done
  ```
- `prompts/implement-task.md` line 3 (`3:04`):
  ```
  > **Workflow:** brainstorm → spec → plan → **implement** → verify → code-review → done
  ```
- `prompts/diagnose-bug.md` line 3 (`3:b2`):
  ```
  > **Workflow:** reproduce → **diagnose** → plan → implement → verify → done
  ```
- `prompts/reproduce-bug.md` line 3 (`3:0f`):
  ```
  > **Workflow:** **reproduce** → diagnose → plan → implement → verify → done
  ```
**Step 2 — Verify**
Run: `bun test`
Expected: all passing (prompt content changes don't break tests)
Covers AC 32, 33, 34 (prompt templates for each mode). Also fixes prompt-review-notes.md issues 1–6 (protocol deprecation, phase_back parenthetical, workflow diagrams, saving section, review-plan approval flow).

---

### Task 17: Tool registration — wire new tools into pi [depends: 7, 9, 12, 13]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/register-tools.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/register-tools.test.ts
import { describe, it, expect } from "bun:test";
import { registerTools } from "../extensions/megapowers/register-tools.js";

describe("registerTools — plan loop tools", () => {
  it("registers plan loop tools and extends megapowers_signal actions", () => {
    const tools: Record<string, any> = {};

    const pi = {
      registerTool: (tool: any) => {
        tools[tool.name] = tool;
      },
    } as any;

    registerTools(pi, {} as any);

    expect(Object.keys(tools)).toContain("megapowers_signal");
    expect(Object.keys(tools)).toContain("megapowers_plan_task");
    expect(Object.keys(tools)).toContain("megapowers_plan_review");
    expect(Object.keys(tools)).not.toContain("megapowers_save_artifact");

    const signalParams = JSON.stringify(tools.megapowers_signal.parameters);
    expect(signalParams).toContain("plan_draft_done");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts`
Expected: FAIL — `registerTools()` does not yet register `megapowers_plan_task` / `megapowers_plan_review` and `megapowers_signal` does not include `plan_draft_done`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/register-tools.ts`, add the two new tool registrations:

```typescript
import { handlePlanTask } from "./tools/tool-plan-task.js";
import { handlePlanReview } from "./tools/tool-plan-review.js";

// --- Tools: megapowers_plan_task ---
pi.registerTool({
  name: "megapowers_plan_task",
  label: "Plan Task",
  description: "Save or update a plan task. During draft mode, creates new tasks. During revise mode, updates existing tasks (partial — only provided fields are merged).",
  parameters: Type.Object({
    id: Type.Number({ description: "Task ID (1-based, sequential)" }),
    title: Type.Optional(Type.String({ description: "Short task title" })),
    description: Type.Optional(Type.String({ description: "Full task body — TDD steps, code blocks, implementation details (markdown)" })),
    depends_on: Type.Optional(Type.Array(Type.Number(), { description: "IDs of tasks this depends on" })),
    no_test: Type.Optional(Type.Boolean({ description: "true if this task doesn't need TDD" })),
    files_to_modify: Type.Optional(Type.Array(Type.String(), { description: "Existing files this task changes" })),
    files_to_create: Type.Optional(Type.Array(Type.String(), { description: "New files this task creates" })),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const result = handlePlanTask(ctx.cwd, params);
    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
    }
    return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
  },
});

// --- Tools: megapowers_plan_review ---
pi.registerTool({
  name: "megapowers_plan_review",
  label: "Plan Review",
  description: "Submit plan review verdict. Approves the plan or requests revisions with per-task feedback.",
  parameters: Type.Object({
    verdict: StringEnum(["approve", "revise"] as const),
    feedback: Type.String({ description: "Review feedback — per-task assessment, issues found, suggestions (markdown)" }),
    approved_tasks: Type.Optional(Type.Array(Type.Number(), { description: "Task IDs that pass review" })),
    needs_revision_tasks: Type.Optional(Type.Array(Type.Number(), { description: "Task IDs that need revision" })),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const result = handlePlanReview(ctx.cwd, params);
    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
    }
    return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
  },
});
```

Also update the `megapowers_signal` tool definition to include `plan_draft_done` in its action union:

```typescript
action: Type.Union([
  Type.Literal("task_done"),
  Type.Literal("review_approve"),
  Type.Literal("phase_next"),
  Type.Literal("phase_back"),
  Type.Literal("tests_failed"),
  Type.Literal("tests_passed"),
  Type.Literal("plan_draft_done"),
]),
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers end-to-end wiring of the full plan loop.

---

### Task 18: newSession wiring — reset context on plan mode transitions [depends: 9, 12, 17]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Modify: `extensions/megapowers/hooks.ts`
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/new-session-wiring.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/new-session-wiring.test.ts
import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { onContext } from "../extensions/megapowers/hooks.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", megaEnabled: true, ...overrides });
}

function makeSessionManager() {
  const sm: any = {
    _messages: [{ role: "user", content: [{ type: "text", text: "old" }], timestamp: 0 }],
    getSessionFile: () => "session.jsonl",
    newSessionCalls: 0,
    newSession: (_opts?: any) => {
      sm.newSessionCalls++;
      sm._messages = [];
      return "new-session-id";
    },
    buildSessionContext: () => ({ messages: sm._messages, thinkingLevel: "off", model: null }),
  };
  return sm;
}

describe("newSession wiring", () => {
  it("megapowers_signal(plan_draft_done) starts a new session and context hook uses the new session messages", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "new-session-signal-"));
    try {
      setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

      // at least 1 task file required
      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => {
          tools[tool.name] = tool;
        },
        exec: async () => ({ code: 1, stdout: "", stderr: "" }),
      } as any;

      registerTools(pi, {} as any);

      const sessionManager = makeSessionManager();
      const ctx = { cwd: tmp, hasUI: false, sessionManager } as any;

      await tools.megapowers_signal.execute("1", { action: "plan_draft_done" }, undefined, undefined, ctx);

      expect(sessionManager.newSessionCalls).toBe(1);

      const contextResult = await onContext({ type: "context", messages: [] }, ctx, {} as any);
      expect(contextResult.messages).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("megapowers_plan_review(revise) starts a new session", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "new-session-review-"));
    try {
      setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });

      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => {
          tools[tool.name] = tool;
        },
        exec: async () => ({ code: 1, stdout: "", stderr: "" }),
      } as any;

      registerTools(pi, {} as any);

      const sessionManager = makeSessionManager();
      const ctx = { cwd: tmp, hasUI: false, sessionManager } as any;

      await tools.megapowers_plan_review.execute(
        "1",
        { verdict: "revise", feedback: "Fix task 1.", approved_tasks: [], needs_revision_tasks: [1] },
        undefined,
        undefined,
        ctx,
      );

      expect(sessionManager.newSessionCalls).toBe(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/new-session-wiring.test.ts`
Expected: FAIL — `newSessionCalls` is `0` (session not restarted) and/or `onContext` is not exported.

**Step 3 — Write minimal implementation**

1. In `extensions/megapowers/hooks.ts`, export `onContext`:

```typescript
import { readState } from "./state/state-io.js";

export async function onContext(_event: any, ctx: any, _deps: Deps): Promise<any> {
  const state = readState(ctx.cwd);
  if (!state.megaEnabled) return;
  const sessionContext = ctx.sessionManager.buildSessionContext();
  return { messages: sessionContext.messages };
}
```

2. In `extensions/megapowers/index.ts`, register the hook:

```typescript
pi.on("context", async (event, ctx) => onContext(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
```

3. In `extensions/megapowers/register-tools.ts`, when a tool handler returns `{ triggerNewSession: true }`, start a new session:

```typescript
if ((result as any).triggerNewSession) {
  const parent = ctx.sessionManager.getSessionFile?.();
  ctx.sessionManager.newSession({ parentSession: parent ?? undefined });
}
```

Apply this to `megapowers_signal` and `megapowers_plan_review` tool execute wrappers.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/new-session-wiring.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Covers AC 21 (newSession on plan_draft_done), AC 35 (newSession on mode transitions).

---


## AC Coverage Map

| AC | Task(s) | Description |
|----|---------|-------------|
| 1 | 4 | planMode type in MegapowersState |
| 2 | 4 | KNOWN_KEYS includes planMode, planIteration |
| 3 | 4 | createInitialState defaults |
| 4 | 5 | Entering plan sets draft/1 |
| 5 | 5 | Leaving plan resets planMode |
| 6 | 7 | Error outside plan phase |
| 7 | 7 | Error in review mode |
| 8 | 7 | Creates task file at correct path |
| 9 | 7 | Requires id, title, description |
| 10 | 7 | Default values |
| 11 | 8 | Partial merge on update |
| 12 | 8 | Description handling in update |
| 13 | 7 | Response format |
| 14 | 12 | Error outside plan/review |
| 15 | 13 | Approve verdict full flow |
| 16 | 12 | Revise verdict |
| 17 | 12 | Iteration cap |
| 18 | 12 | Task status updates |
| 19 | 9 | plan_draft_done transitions to review |
| 20 | 9 | Error on zero tasks |
| 21 | 9, 18 | plan_draft_done triggers newSession |
| 22 | 10 | review_approve deprecation |
| 23 | 6 | Feature phases (no review) |
| 24 | 6 | Bugfix phases (no review) |
| 25 | 6 | No review transitions |
| 26 | 6 | Phase type retains "review" |
| 27 | 14 | Draft blocks task file writes |
| 28 | 14 | Review blocks modifications |
| 29 | 14 | Revise allows edit, blocks write |
| 30 | 11 | plan.md generation |
| 31 | 11 | Backward compat with extractPlanTasks |
| 32 | 15, 16 | Draft → write-plan.md |
| 33 | 15, 16 | Review → review-plan.md |
| 34 | 15, 16 | Revise → revise-plan.md |
| 35 | 9, 12, 18 | newSession on mode transitions |
| 36 | 1, 3 | Correct return types |
| 37 | 3 | zeroPad 3 digits |
| 38 | 4 | MAX_PLAN_ITERATIONS = 4 |
