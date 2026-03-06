# Plan

### Task 1: Create LintResult type and lintTask pure function with title validation

**Covers:** AC1, AC3, AC7, AC8, AC9 (title check + files check + aggregation pattern)
**Files:**
- Create: `extensions/megapowers/validation/plan-task-linter.ts`
- Test: `tests/plan-task-linter.test.ts`
**Step 1 — Write the failing test**

```typescript
// tests/plan-task-linter.test.ts
import { describe, it, expect } from "bun:test";
import { lintTask, type LintResult, type LintTaskInput } from "../extensions/megapowers/validation/plan-task-linter.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";
function makeLintTask(overrides: Partial<LintTaskInput> = {}): LintTaskInput {
  return {
    id: 1,
    title: "Valid task title",
    status: "draft",
    depends_on: [],
    no_test: false,
    files_to_modify: ["extensions/megapowers/tools/tool-signal.ts"],
    files_to_create: [],
    description: "A".repeat(200),
    ...overrides,
  };
}
describe("lintTask — title validation", () => {
  it("passes for a valid task", () => {
    const result = lintTask(makeLintTask(), []);
    expect(result).toEqual({ pass: true });
  });
  it("fails when title is empty string", () => {
    const result = lintTask(makeLintTask({ title: "" }), []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.toLowerCase().includes("title"))).toBe(true);
    }
  });
  it("fails when title is whitespace only", () => {
    const result = lintTask(makeLintTask({ title: "   \t\n  " }), []);
    expect(result.pass).toBe(false);
  });
  it("returns all errors, not just the first", () => {
    const result = lintTask(makeLintTask({
      title: "",
      files_to_modify: [],
      files_to_create: [],
    }), []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: FAIL — `error: Cannot find module "../extensions/megapowers/validation/plan-task-linter.js"`
**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/validation/plan-task-linter.ts
import type { PlanTask } from "../state/plan-schemas.js";
export type LintTaskInput = PlanTask & { description: string };
export type LintResult = { pass: true } | { pass: false; errors: string[] };
export function lintTask(task: LintTaskInput, existingTasks: PlanTask[]): LintResult {
  const errors: string[] = [];
  if (!task.title || task.title.trim().length === 0) {
    errors.push("Title must not be empty or whitespace-only.");
  }
  // AC3: Must have at least one file target
  if (task.files_to_modify.length === 0 && task.files_to_create.length === 0) {
    errors.push("Task must specify at least one file in files_to_modify or files_to_create.");
  }
  // AC9: Return all errors
  if (errors.length > 0) {
    return { pass: false, errors };
  }
  return { pass: true };
}
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: PASS
Run: `bun test`
Expected: all passing

### Task 2: Add description minimum length check to lintTask [depends: 1]

**Covers:** AC2, AC8
**Files:**
- Modify: `extensions/megapowers/validation/plan-task-linter.ts`
- Modify: `tests/plan-task-linter.test.ts`
**Step 1 — Write the failing test**

Append to the existing `tests/plan-task-linter.test.ts` file (reuse the `makeLintTask` helper from Task 1):

```typescript
// tests/plan-task-linter.test.ts — add new describe block
describe("lintTask — description length", () => {
  it("fails when description is shorter than 200 characters", () => {
    const result = lintTask(makeLintTask({ description: "Short desc" }), []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("Description must be at least 200 characters (got 10).");
    }
  });
  it("passes when description is exactly 200 characters", () => {
    const result = lintTask(makeLintTask({ description: "A".repeat(200) }), []);
    expect(result).toEqual({ pass: true });
  });
  it("passes when description is longer than 200 characters", () => {
    const result = lintTask(makeLintTask({ description: "A".repeat(300) }), []);
    expect(result).toEqual({ pass: true });
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: FAIL — `Expected: false\nReceived: true` from `expect(result.pass).toBe(false)` in the short-description test.
**Step 3 — Write minimal implementation**

Add the description check to `lintTask` in `extensions/megapowers/validation/plan-task-linter.ts`, after the title check and before the files check:

```typescript
const MIN_DESCRIPTION_LENGTH = 200;
// Inside lintTask, after the title check:
  if (task.description.length < MIN_DESCRIPTION_LENGTH) {
    errors.push(`Description must be at least ${MIN_DESCRIPTION_LENGTH} characters (got ${task.description.length}).`);
  }
```

No type changes needed — `LintTaskInput` already includes `description: string` from Task 1.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Add depends_on validation to lintTask [depends: 1]

**Covers:** AC4, AC5

**Files:**
- Modify: `extensions/megapowers/validation/plan-task-linter.ts`
- Modify: `tests/plan-task-linter.test.ts`
**Step 1 — Write the failing test**

```typescript
// tests/plan-task-linter.test.ts — add to existing file
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";
import { lintTask, type LintTaskInput } from "../extensions/megapowers/validation/plan-task-linter.js";

function makeLintTask(overrides: Partial<LintTaskInput> = {}): LintTaskInput {
  return {
    id: 3,
    title: "Third",
    status: "draft",
    depends_on: [],
    no_test: false,
    files_to_modify: ["c.ts"],
    files_to_create: [],
    description: "A".repeat(200),
    ...overrides,
  };
}
describe("lintTask — depends_on validation", () => {
  const existingTasks: PlanTask[] = [
    { id: 1, title: "First", status: "draft", depends_on: [], no_test: false, files_to_modify: ["a.ts"], files_to_create: [] },
    { id: 2, title: "Second", status: "draft", depends_on: [1], no_test: false, files_to_modify: ["b.ts"], files_to_create: [] },
  ];
  it("fails when depends_on has a forward reference (depId >= current task id)", () => {
    const task = makeLintTask({ depends_on: [99] });
    const result = lintTask(task, existingTasks);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("depends_on contains forward reference to task 99 (current task is 3).");
    }
  });

  it("fails when depends_on references a non-existent earlier task ID", () => {
    // task.id=3, dep=1 which is < 3 but NOT in existingTasks (empty)
    const task = makeLintTask({ id: 3, depends_on: [1] });
    const result = lintTask(task, []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("depends_on references non-existent task 1.");
    }
  });

  it("fails on self-reference (depId === current task id)", () => {
    const task = makeLintTask({ depends_on: [3] });
    const result = lintTask(task, existingTasks);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("depends_on contains forward reference to task 3 (current task is 3).");
    }
  });
  it("passes when depends_on references only existing lower IDs", () => {
    const task = makeLintTask({ depends_on: [1, 2] });
    const result = lintTask(task, existingTasks);
    expect(result).toEqual({ pass: true });
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: FAIL — `Expected: false\nReceived: true` from `expect(result.pass).toBe(false)` in the forward-reference test (depId=99, task.id=3, implementation not yet added so lintTask returns pass:true for depends_on).

**Step 3 — Write minimal implementation**

Add this block inside `lintTask(...)` in `extensions/megapowers/validation/plan-task-linter.ts`:

```typescript
  // AC4: depends_on must reference existing task IDs
  // AC5: depends_on must not contain IDs >= current task ID
  if (task.depends_on.length > 0) {
    const existingIds = new Set(existingTasks.map((t) => t.id));
    for (const depId of task.depends_on) {
      if (depId >= task.id) {
        errors.push(`depends_on contains forward reference to task ${depId} (current task is ${task.id}).`);
      } else if (!existingIds.has(depId)) {
        errors.push(`depends_on references non-existent task ${depId}.`);
      }
    }
  }
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Add duplicate files_to_create cross-task check to lintTask [depends: 1]

**Covers:** AC6

**Files:**
- Modify: `extensions/megapowers/validation/plan-task-linter.ts`
- Modify: `tests/plan-task-linter.test.ts`
**Step 1 — Write the failing test**

```typescript
// tests/plan-task-linter.test.ts — add to existing file
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";
import { lintTask, type LintTaskInput } from "../extensions/megapowers/validation/plan-task-linter.js";

function makeLintTask(overrides: Partial<LintTaskInput> = {}): LintTaskInput {
  return {
    id: 2,
    title: "Second",
    status: "draft",
    depends_on: [1],
    no_test: false,
    files_to_modify: [],
    files_to_create: ["src/new-module.ts"],
    description: "A".repeat(200),
    ...overrides,
  };
}
describe("lintTask — duplicate files_to_create", () => {
  it("fails when files_to_create overlaps another task's files_to_create", () => {
    const existingTasks: PlanTask[] = [
      { id: 1, title: "First", status: "draft", depends_on: [], no_test: false, files_to_modify: [], files_to_create: ["src/new-module.ts"] },
    ];

    const result = lintTask(makeLintTask(), existingTasks);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain('files_to_create path "src/new-module.ts" is already claimed by another task.');
    }
  });

  it("passes when files_to_create has no overlap", () => {
    const existingTasks: PlanTask[] = [
      { id: 1, title: "First", status: "draft", depends_on: [], no_test: false, files_to_modify: [], files_to_create: ["src/a.ts"] },
    ];

    const result = lintTask(makeLintTask({ files_to_create: ["src/b.ts"] }), existingTasks);
    expect(result).toEqual({ pass: true });
  });

  it("allows update of the same task without self-conflict", () => {
    const existingTasks: PlanTask[] = [
      { id: 2, title: "Second", status: "draft", depends_on: [1], no_test: false, files_to_modify: [], files_to_create: ["src/new-module.ts"] },
    ];

    const result = lintTask(makeLintTask({ id: 2 }), existingTasks);
    expect(result).toEqual({ pass: true });
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: FAIL — `Expected: false\nReceived: true` from `expect(result.pass).toBe(false)` in the overlap test.

**Step 3 — Write minimal implementation**

Add this block inside `lintTask(...)` in `extensions/megapowers/validation/plan-task-linter.ts`:

```typescript
  // AC6: files_to_create must not duplicate another task's files_to_create
  if (task.files_to_create.length > 0) {
    const claimedPaths = new Set<string>();
    for (const existing of existingTasks) {
      // Skip self during updates
      if (existing.id === task.id) continue;
      for (const filePath of existing.files_to_create) {
        claimedPaths.add(filePath);
      }
    }
    for (const filePath of task.files_to_create) {
      if (claimedPaths.has(filePath)) {
        errors.push(`files_to_create path "${filePath}" is already claimed by another task.`);
      }
    }
  }
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: Integrate lintTask into handlePlanTask [depends: 1, 2, 3, 4]

**Covers:** AC1-9 (integration — T0 blocks saves on lint failure)

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-task.ts`
- Modify: `tests/tool-plan-task.test.ts`
**Step 1 — Write the failing test**

```typescript
// tests/tool-plan-task.test.ts — add new describe block
describe("handlePlanTask — T0 lint integration", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-task-lint-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("rejects create when description is shorter than 200 characters", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const result = handlePlanTask(tmp, {
      id: 1,
      title: "Valid title",
      description: "too short",
      files_to_modify: ["src/foo.ts"],
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Task 1 lint failed");
    expect(result.error).toContain("Description must be at least 200 characters");
    expect(readPlanTask(tmp, "001-test", 1)).toBeNull();
  });

  it("returns all lint errors in one aggregated response", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const result = handlePlanTask(tmp, {
      id: 1,
      title: "   ",
      description: "short",
      files_to_modify: [],
      files_to_create: [],
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Task 1 lint failed");
    expect(result.error).toContain("Title must not be empty");
    expect(result.error).toContain("Description must be at least 200 characters");
    expect(result.error).toContain("Task must specify at least one file");
  });

  it("rejects update when merged task fails lint", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const created = handlePlanTask(tmp, {
      id: 1,
      title: "Valid",
      description: "A".repeat(200),
      files_to_modify: ["src/a.ts"],
    });
    expect(created.error).toBeUndefined();

    const result = handlePlanTask(tmp, {
      id: 1,
      files_to_modify: [],
      files_to_create: [],
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Task 1 lint failed");
    expect(result.error).toContain("Task must specify at least one file");
  });
  it("allows valid task to be saved", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const result = handlePlanTask(tmp, {
      id: 1,
      title: "Valid task",
      description: "A".repeat(220),
      files_to_modify: ["src/foo.ts"],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("Task 1");
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: FAIL — `Expected value to be defined, received undefined` from `expect(result.error).toBeDefined()` in the short-description test.

**Step 3 — Write minimal implementation**
Update the existing import in `extensions/megapowers/tools/tool-plan-task.ts` (line 2) to add `listPlanTasks`:

```typescript
// BEFORE (line 2):
import { readPlanTask, writePlanTask } from "../state/plan-store.js";
// AFTER:
import { readPlanTask, writePlanTask, listPlanTasks } from "../state/plan-store.js";
```

Add a new import for the linter:
```typescript
import { lintTask } from "../validation/plan-task-linter.js";
```
Create path (`handlePlanTask`), after building `task` and before schema validation/write.
Note: after the early-return guard on missing `description`, TypeScript still can't narrow through the spread, so use a non-null assertion:
```typescript
  const lintInput = { ...task, description: params.description! };
  const existingTasks = listPlanTasks(cwd, slug).map((doc) => doc.data);
  const lintResult = lintTask(lintInput, existingTasks);
  if (!lintResult.pass) {
    return {
      error: `❌ Task ${params.id} lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
  }
```

Update path (`handleUpdate`), after `body` is computed (already typed as `string`) and before `writePlanTask(...)`:

```typescript
  const lintInput = { ...merged, description: body };
  const allTasks = listPlanTasks(cwd, slug).map((doc) => doc.data);
  const lintResult = lintTask(lintInput, allTasks);
  if (!lintResult.pass) {
    return {
      error: `❌ Task ${params.id} lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
  }
```
This preserves aggregated lint formatting so all lint findings are returned together.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: Create plan-lint-model module with completeFn injection and response parsing

**Covers:** AC12, AC13, AC17

**Files:**
- Create: `extensions/megapowers/validation/plan-lint-model.ts`
- Create: `tests/plan-lint-model.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/plan-lint-model.test.ts
import { describe, it, expect } from "bun:test";
import { lintPlanWithModel, type CompleteFn, type ModelLintResult } from "../extensions/megapowers/validation/plan-lint-model.js";

const VALID_PASS_RESPONSE = JSON.stringify({ verdict: "pass", findings: [] });
const VALID_FAIL_RESPONSE = JSON.stringify({
  verdict: "fail",
  findings: [
    "AC3 is not covered by any task",
    "Task 2 description is vague — says 'handle edge cases' without specifying which",
  ],
});

function mockCompleteFn(responseText: string): CompleteFn {
  return async (_prompt: string) => responseText;
}

describe("lintPlanWithModel", () => {
  const tasks = [
    { id: 1, title: "First task", description: "Detailed description...", files: ["a.ts"] },
  ];
  const specContent = "## Acceptance Criteria\n1. Feature works\n2. Tests pass";

  it("returns pass when model says pass", async () => {
    const result = await lintPlanWithModel(tasks, specContent, mockCompleteFn(VALID_PASS_RESPONSE));
    expect(result.pass).toBe(true);
  });

  it("returns fail with findings when model finds issues", async () => {
    const result = await lintPlanWithModel(tasks, specContent, mockCompleteFn(VALID_FAIL_RESPONSE));
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain("AC3");
    }
  });

  it("treats malformed response as pass with warning (fail-open)", async () => {
    const result = await lintPlanWithModel(tasks, specContent, mockCompleteFn("This is not JSON at all"));
    expect(result.pass).toBe(true);
    if (result.pass) {
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("malformed");
    }
  });

  it("treats API error as pass with warning (fail-open)", async () => {
    const errorFn: CompleteFn = async () => { throw new Error("API timeout"); };
    const result = await lintPlanWithModel(tasks, specContent, errorFn);
    expect(result.pass).toBe(true);
    if (result.pass) {
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("API");
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-lint-model.test.ts`
Expected: FAIL — `error: Cannot find module "../extensions/megapowers/validation/plan-lint-model.js"`

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/validation/plan-lint-model.ts
import type { LintResult } from "./plan-task-linter.js";

export type CompleteFn = (prompt: string) => Promise<string>;

export type ModelLintResult =
  | { pass: true; warning?: string }
  | { pass: false; errors: string[] };

interface TaskSummary {
  id: number;
  title: string;
  description: string;
  files: string[];
}

interface ModelResponse {
  verdict: "pass" | "fail";
  findings: string[];
}

export async function lintPlanWithModel(
  tasks: TaskSummary[],
  specContent: string,
  completeFn: CompleteFn,
): Promise<ModelLintResult> {
  const prompt = buildLintPrompt(tasks, specContent);

  let responseText: string;
  try {
    responseText = await completeFn(prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { pass: true, warning: `T1 lint skipped — API error: ${msg}` };
  }

  return parseModelResponse(responseText);
}

function buildLintPrompt(tasks: TaskSummary[], specContent: string): string {
  const taskList = tasks
    .map(t => `### Task ${t.id}: ${t.title}\n${t.description}\nFiles: ${t.files.join(", ")}`)
    .join("\n\n");

  return `## Spec\n${specContent}\n\n## Plan Tasks\n${taskList}`;
}

function parseModelResponse(text: string): ModelLintResult {
  try {
    // Try to extract JSON from the response (model might wrap it in markdown)
    const jsonMatch = text.includes("{") ? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1) : text;
    const parsed: ModelResponse = JSON.parse(jsonMatch);

    if (parsed.verdict === "pass") {
      return { pass: true };
    }

    if (parsed.verdict === "fail" && Array.isArray(parsed.findings) && parsed.findings.length > 0) {
      return { pass: false, errors: parsed.findings };
    }

    // Verdict is "fail" but no findings — treat as pass
    return { pass: true, warning: "T1 model returned fail with no findings — treating as pass." };
  } catch {
    return { pass: true, warning: "T1 lint response was malformed — treating as pass (fail-open)." };
  }
}

export { buildLintPrompt };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-lint-model.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Create lint-plan-prompt.md template [no-test]

**Covers:** AC18

**Justification:** Prompt/skill file change — no observable behavior beyond string content. The prompt is tested indirectly through Task 6's tests verifying prompt assembly contains the right sections.

**Files:**
- Create: `prompts/lint-plan-prompt.md`

**Step 1 — Make the change**

Create `prompts/lint-plan-prompt.md`:

```markdown
You are a plan quality checker. Your job is to quickly verify a plan meets basic quality standards before it goes to deep review.

## Spec (Acceptance Criteria)

{{spec_content}}

## Plan Tasks

{{tasks_content}}

## Checks

Evaluate the plan against these checks:

1. **Spec coverage** — Does every acceptance criterion have at least one task that explicitly addresses it? List any uncovered ACs.
2. **Dependency coherence** — Are task dependencies logically ordered? Does any task depend on work that comes after it?
3. **Description quality** — Are task descriptions substantive and actionable? Flag any that are vague hand-waves (e.g., "handle edge cases", "add proper validation", "implement the feature").
4. **File path plausibility** — Do the file paths look reasonable for this project? Flag any that look like placeholders (e.g., "src/foo.ts", "path/to/file.ts").

## Response Format

Respond with ONLY a JSON object (no markdown fences, no explanation):

If all checks pass:
{"verdict": "pass", "findings": []}

If any checks fail:
{"verdict": "fail", "findings": ["Finding 1: specific issue description", "Finding 2: specific issue description"]}

Each finding must be specific and actionable — reference task IDs and AC numbers.
```

**Step 2 — Verify**
Run: `bun run build` (or `bun typecheck` if available)
Expected: Build succeeds — prompt file doesn't affect compilation. Verify the file exists at `prompts/lint-plan-prompt.md` with `cat prompts/lint-plan-prompt.md`.

### Task 8: Verify T1 prompt assembly includes tasks and spec content [depends: 6, 7]

**Covers:** AC11

**Files:**
- Modify: `extensions/megapowers/validation/plan-lint-model.ts`
- Modify: `tests/plan-lint-model.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/plan-lint-model.test.ts — add to existing file
import { buildLintPrompt } from "../extensions/megapowers/validation/plan-lint-model.js";

describe("buildLintPrompt — content assembly", () => {
  it("includes spec content in the prompt", () => {
    const spec = "## Acceptance Criteria\n1. Widget renders correctly\n2. Error state shows message";
    const tasks = [
      { id: 1, title: "Add widget", description: "Implement the widget component", files: ["src/widget.ts"] },
    ];
    const prompt = buildLintPrompt(tasks, spec);
    expect(prompt.includes("Widget renders correctly")).toBe(true);
    expect(prompt.includes("Error state shows message")).toBe(true);
  });

  it("includes all task titles and descriptions in the prompt", () => {
    const tasks = [
      { id: 1, title: "Add parser", description: "Parse input data", files: ["src/parser.ts"] },
      { id: 2, title: "Add validator", description: "Validate parsed output", files: ["src/validator.ts"] },
    ];
    const prompt = buildLintPrompt(tasks, "spec");
    expect(prompt.includes("Add parser")).toBe(true);
    expect(prompt.includes("Parse input data")).toBe(true);
    expect(prompt.includes("Add validator")).toBe(true);
    expect(prompt.includes("Validate parsed output")).toBe(true);
  });

  it("includes task file paths in the prompt", () => {
    const tasks = [
      { id: 1, title: "Task", description: "Desc", files: ["src/foo.ts", "src/bar.ts"] },
    ];
    const prompt = buildLintPrompt(tasks, "spec");
    expect(prompt.includes("src/foo.ts")).toBe(true);
    expect(prompt.includes("src/bar.ts")).toBe(true);
  });

  it("includes the lint-plan-prompt.md template content", () => {
    const tasks = [{ id: 1, title: "T", description: "D", files: ["a.ts"] }];
    const prompt = buildLintPrompt(tasks, "spec");
    // The prompt should include the checks from lint-plan-prompt.md
    expect(prompt.includes("Spec coverage")).toBe(true);
    expect(prompt.includes("Dependency coherence")).toBe(true);
    expect(prompt.includes("Description quality")).toBe(true);
    expect(prompt.includes("verdict")).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-lint-model.test.ts`
Expected: FAIL — `expect(prompt.includes("Spec coverage")).toBe(true)` fails because `buildLintPrompt` currently constructs a simple prompt without loading `lint-plan-prompt.md`

**Step 3 — Write minimal implementation**

Update `buildLintPrompt` in `extensions/megapowers/validation/plan-lint-model.ts` to load and interpolate the template:

```typescript
import { loadPromptFile, interpolatePrompt } from "../prompts.js";

function buildLintPrompt(tasks: TaskSummary[], specContent: string): string {
  const taskList = tasks
    .map(t => `### Task ${t.id}: ${t.title}\n${t.description}\nFiles: ${t.files.join(", ")}`)
    .join("\n\n");

  const template = loadPromptFile("lint-plan-prompt.md");
  if (template) {
    return interpolatePrompt(template, {
      spec_content: specContent,
      tasks_content: taskList,
    });
  }

  // Fallback if template not found
  return `## Spec\n${specContent}\n\n## Plan Tasks\n${taskList}\n\nCheck: spec coverage, dependency coherence, description quality, file path plausibility. Respond with JSON: {"verdict": "pass"|"fail", "findings": [...]}`;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-lint-model.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 9: Make handlePlanDraftDone async with T1 lint integration [depends: 6, 8]

**Covers:** AC10, AC14, AC15, AC20

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/tool-signal.test.ts — add to existing file
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePlanDraftDone } from "../extensions/megapowers/tools/tool-signal.js";

describe("handlePlanDraftDone — async T1 lint integration", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-signal-plan-draft-done-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeTask(tmpDir: string, id: number, title = `Task ${id}`) {
    const tasksDir = join(tmpDir, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(
      join(tasksDir, `task-${String(id).padStart(3, "0")}.md`),
      `---\nid: ${id}\ntitle: ${title}\nstatus: draft\ndepends_on: []\nno_test: false\nfiles_to_modify: [src/foo.ts]\nfiles_to_create: []\n---\n${"A".repeat(220)}`,
    );
  }

  it("blocks transition when model lint returns fail findings", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "feature" });
    writeTask(tmp, 1);

    writeFileSync(
      join(tmp, ".megapowers", "plans", "001-test", "spec.md"),
      "## Acceptance Criteria\n1. AC1",
    );
    const failFn = async () => JSON.stringify({
      verdict: "fail",
      findings: ["AC1 is not covered by any task"],
    });
    const result = await handlePlanDraftDone(tmp, failFn);
    expect(result.error).toContain("T1 plan lint failed");
    expect(result.error).toContain("AC1 is not covered by any task");
    expect(readState(tmp).planMode).toBe("draft");
  });

  it("uses derived acceptance criteria for bugfix workflow (diagnosis/fixed-when)", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "bugfix" });
    writeTask(tmp, 1);

    writeFileSync(
      join(tmp, ".megapowers", "plans", "001-test", "diagnosis.md"),
      "## Fixed When\n1. Crash no longer occurs when input is empty",
    );

    let seenPrompt = "";
    const captureFn = async (prompt: string) => {
      seenPrompt = prompt;
      return JSON.stringify({ verdict: "pass", findings: [] });
    };

    const result = await handlePlanDraftDone(tmp, captureFn);
    expect(result.error).toBeUndefined();
    expect(seenPrompt).toContain("Crash no longer occurs when input is empty");
  });

  it("transitions planMode to review and sets triggerNewSession on pass", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "feature" });
    writeTask(tmp, 1);

    writeFileSync(
      join(tmp, ".megapowers", "plans", "001-test", "spec.md"),
      "## Acceptance Criteria\n1. AC1",
    );

    const passFn = async () => JSON.stringify({ verdict: "pass", findings: [] });

    const result = await handlePlanDraftDone(tmp, passFn);
    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
    expect(readState(tmp).planMode).toBe("review");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts`
Expected: FAIL — `handlePlanDraftDone` is not exported from `tool-signal.ts` (it exists as a private function), so the import statement will produce a module resolution error: `SyntaxError: The requested module '../extensions/megapowers/tools/tool-signal.js' does not provide an export named 'handlePlanDraftDone'`.

**Step 3 — Write minimal implementation**

Update `extensions/megapowers/tools/tool-signal.ts`:

**1. Add new imports** at the top of the file (after existing imports):

```typescript
import { deriveAcceptanceCriteria } from "../state/derived.js";
import { lintPlanWithModel, type CompleteFn } from "../validation/plan-lint-model.js";
```

Note: `listPlanTasks` is already imported on line 4.

**2. Remove `plan_draft_done` case from `handleSignal`'s switch** — remove these lines:

```typescript
    case "plan_draft_done":
      return handlePlanDraftDone(cwd);
```

Keep `"plan_draft_done"` in the action type union so TypeScript still accepts it as input (the default case will return the appropriate error for any direct callers).

**3. Export standalone async function** (replace the existing private `handlePlanDraftDone` function):

```typescript
export async function handlePlanDraftDone(cwd: string, completeFn?: CompleteFn): Promise<SignalResult> {
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
  let lintWarning = "";
  if (completeFn) {
    const criteria = deriveAcceptanceCriteria(cwd, state.activeIssue!, state.workflow!);
    const criteriaText = criteria.map((c) => `${c.id}. ${c.text}`).join("\n");
    const taskSummaries = tasks.map((t) => ({
      id: t.data.id,
      title: t.data.title,
      description: t.content,
      files: [...t.data.files_to_modify, ...t.data.files_to_create],
    }));
    const lintResult = await lintPlanWithModel(taskSummaries, criteriaText, completeFn);
    if (!lintResult.pass) {
      return { error: `❌ T1 plan lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}` };
    }
    if (lintResult.warning) {
      lintWarning = `\n  ⚠️ ${lintResult.warning}`;
    }
  }
  writeState(cwd, { ...state, planMode: "review" });
  return {
    message:
      `📝 Draft complete: ${tasks.length} task${tasks.length === 1 ? "" : "s"} saved\n` +
      `  → Transitioning to review mode.${lintWarning}`,
    triggerNewSession: true,
  };
}
```

**4. Migrate existing `plan_draft_done` tests in `tests/tool-signal.test.ts`**

There are 8 calls to `handleSignal(tmp, "plan_draft_done")` across two locations. All must be migrated.

First, update the import line to add `handlePlanDraftDone`:

```typescript
// BEFORE:
import { handleSignal } from "../extensions/megapowers/tools/tool-signal.js";

// AFTER:
import { handleSignal, handlePlanDraftDone } from "../extensions/megapowers/tools/tool-signal.js";
```

Then migrate the `describe("plan_draft_done signal", ...)` block (lines 266–334). Each test becomes `async` and replaces `handleSignal(tmp, "plan_draft_done")` with `await handlePlanDraftDone(tmp)`:

```typescript
describe("plan_draft_done signal", () => {
  it("transitions planMode from draft to review", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("review mode");

    const state = readState(tmp);
    expect(state.planMode).toBe("review");
  });

  it("transitions planMode from revise to review", async () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeUndefined();

    const state = readState(tmp);
    expect(state.planMode).toBe("review");
  });

  it("returns error when not in plan phase", async () => {
    setState(tmp, { phase: "implement", planMode: null });
    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan phase");
  });

  it("returns error when planMode is review", async () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeDefined();
  });

  it("returns error when no task files exist", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("task");
  });

  it("reports task count in success message", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T1\nstatus: draft\n---\nB1.");
    writeFileSync(join(tasksDir, "task-002.md"), "---\nid: 2\ntitle: T2\nstatus: draft\n---\nB2.");

    const result = await handlePlanDraftDone(tmp);
    expect(result.message).toContain("2 tasks");
  });

  it("sets triggerNewSession flag", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nB.");

    const result = await handlePlanDraftDone(tmp);
    expect(result.triggerNewSession).toBe(true);
  });
});
```

Also migrate the `triggerNewSession` test at line ~824:

```typescript
it("does NOT return triggerNewSession when plan_draft_done fails", async () => {
  setState(tmp, { phase: "implement", planMode: null });
  const result = await handlePlanDraftDone(tmp);
  expect(result.error).toBeDefined();
  expect(result.triggerNewSession).toBeUndefined();
});
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 10: Add graceful degradation when T1 API key is unavailable [depends: 9]

**Covers:** AC16

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`
**Step 1 — Write the failing test**

```typescript
// tests/tool-signal.test.ts — add to existing file
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePlanDraftDone } from "../extensions/megapowers/tools/tool-signal.js";

describe("handlePlanDraftDone — graceful degradation", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-signal-t1-graceful-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeValidTask() {
    const dir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "task-001.md"),
      "---\nid: 1\ntitle: T1\nstatus: draft\ndepends_on: []\nno_test: false\nfiles_to_modify: [src/a.ts]\nfiles_to_create: []\n---\n" + "A".repeat(220),
    );
  }

  it("adds warning when completeFn is unavailable (no API key)", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "feature" });
    writeValidTask();

    const result = await handlePlanDraftDone(tmp, undefined);

    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
    expect(result.message).toContain("⚠️");
    expect(result.message).toContain("skipped");
    expect(readState(tmp).planMode).toBe("review");
  });

  it("adds warning when model response is malformed (fail-open)", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "feature" });
    writeValidTask();

    const malformedFn = async () => "not-json";
    const result = await handlePlanDraftDone(tmp, malformedFn);
    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
    expect(result.message).toContain("⚠️");
    expect(result.message).toContain("malformed");
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts`
Expected: FAIL — `Expected substring: "⚠️"\nReceived string: "📝 Draft complete: 1 task saved\n  → Transitioning to review mode."`.

**Step 3 — Write minimal implementation**
Update `handlePlanDraftDone` in `extensions/megapowers/tools/tool-signal.ts` with the full if/else body (showing where `criteria` and `taskSummaries` live):
```typescript
export async function handlePlanDraftDone(cwd: string, completeFn?: CompleteFn): Promise<SignalResult> {
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
  let lintWarning = "";
  if (!completeFn) {
    // T1 skipped — no API key available
    lintWarning = "\n  ⚠️ T1 lint skipped: no model API key available.";
  } else {
    // T1 lint: criteria and taskSummaries are inside the else block
    const criteria = deriveAcceptanceCriteria(cwd, state.activeIssue!, state.workflow!);
    const criteriaText = criteria.map((c) => `${c.id}. ${c.text}`).join("\n");
    const taskSummaries = tasks.map((t) => ({
      id: t.data.id,
      title: t.data.title,
      description: t.content,
      files: [...t.data.files_to_modify, ...t.data.files_to_create],
    }));
    const lintResult = await lintPlanWithModel(taskSummaries, criteriaText, completeFn);
    if (!lintResult.pass) {
      return { error: `❌ T1 plan lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}` };
    }
    if (lintResult.warning) {
      lintWarning = `\n  ⚠️ ${lintResult.warning}`;
    }
  }

  writeState(cwd, { ...state, planMode: "review" });
  return {
    message:
      `📝 Draft complete: ${tasks.length} task${tasks.length === 1 ? "" : "s"} saved\n` +
      `  → Transitioning to review mode.${lintWarning}`,
    triggerNewSession: true,
  };
}
```
This satisfies both warning paths:
- `completeFn` unavailable (API key missing) — sets warning in the `if (!completeFn)` branch
- malformed model response (warning surfaced from `lintPlanWithModel`) — sets warning in the `else` branch
**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 11: Wire async handlePlanDraftDone with real completeFn in register-tools.ts [no-test] [depends: 9, 10]

**Covers:** AC12, AC21

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`

**[no-test] justification:** This is thin integration wiring — it passes `completeFn` (built from `modelRegistry` + `complete()`) through to `handlePlanDraftDone`. The behavioral correctness of `handlePlanDraftDone` with a `completeFn` is already thoroughly tested in Tasks 9 and 10. TypeScript's type system verifies the wiring at compile time. A source-code string assertion test would be brittle; an integration test would require mocking the full extension context for minimal added value.

**Step 1 — Implementation**

Update imports in `extensions/megapowers/register-tools.ts`. The existing `handleSignal` import (line 7) needs updating, and new imports are added:

```typescript
// Update existing import (line 7) to also export handlePlanDraftDone and SignalResult:
import { handleSignal, handlePlanDraftDone, type SignalResult } from "./tools/tool-signal.js";

// Add new imports:
import { complete } from "@mariozechner/pi-ai/dist/stream.js";
import type { CompleteFn } from "./validation/plan-lint-model.js";
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";
```

Add helper function in `register-tools.ts` outside `registerTools(...)`:

```typescript
async function buildLintCompleteFn(
  ctx: { modelRegistry: ModelRegistry },
): Promise<CompleteFn | undefined> {
  const model =
    ctx.modelRegistry.find("anthropic", "claude-haiku-4-5") ??
    ctx.modelRegistry.find("anthropic", "claude-3-5-haiku-latest");
  if (!model) return undefined;
  const apiKey = await ctx.modelRegistry.getApiKey(model);
  if (!apiKey) return undefined;
  return async (prompt: string) => {
    const response = await complete(
      model,
      {
        messages: [{
          role: "user",
          content: [{ type: "text", text: prompt }],
          timestamp: Date.now(),
        }],
      },
      { apiKey },
    );
    return response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  };
}
```

Update the `megapowers_signal` execute handler to intercept `plan_draft_done` before delegating to `handleSignal`:

```typescript
async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const { store, ui } = ensureDeps(runtimeDeps, pi, ctx.cwd);
  let result: SignalResult;
  if (params.action === "plan_draft_done") {
    const completeFn = await buildLintCompleteFn(ctx);
    result = await handlePlanDraftDone(ctx.cwd, completeFn);
  } else {
    result = await handleSignal(ctx.cwd, params.action, params.target);
  }
  if (result.error) {
    return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
  }
  if (result.triggerNewSession) {
    (ctx.sessionManager as any)?.newSession?.();
  }
  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
  return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
},
```

**Step 2 — Verify**
Run: `bun typecheck` (or `npx tsc --noEmit`)
Expected: No type errors

Run: `bun test`
Expected: All tests passing (Tasks 9/10 tests verify the async handlePlanDraftDone behavior)

### Task 12: Update review-plan.md to remove mechanical checks covered by T0 and T1 [no-test]

**Covers:** AC19

**Justification:** Prompt file change — no observable code behavior. The prompt content is editorial, directing the deep reviewer to focus on architecture/approach/correctness instead of mechanical checks.

**Files:**
- Modify: `prompts/review-plan.md`

**Step 1 — Make the change**

Update `prompts/review-plan.md`. The key change is in the "Evaluate against these criteria" section, specifically the intro paragraph and the criteria descriptions.

Replace the paragraph at line 19 (beginning "The drafter has a pre-submit checklist..."):
```markdown
The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1). Mechanical issues — empty descriptions, missing file targets, placeholder text, spec coverage gaps, dependency ordering — have been caught and fixed. **Focus your review entirely on higher-order concerns:** code correctness, architectural soundness, and implementation feasibility.
```

Update section "3. TDD Completeness" to focus on code quality rather than structural presence:
```markdown
### 3. TDD Completeness
Each task must have all 5 steps with **correct, working code**:
- **Step 1** — Test code tests the right behavior (not just structural presence)
- **Step 2** — Expected failure message is accurate for the actual error that will occur
- **Step 3** — Implementation uses correct APIs from the actual codebase
- **Step 4** — Same run command, expected PASS
- **Step 5** — Full test suite command, expected all passing

Flag any task where the code won't actually work — wrong function signatures, incorrect import paths, missing error handling.
```

Update section "4. Granularity" — keep as-is (this is a judgment call, not mechanical).

Remove or simplify section "6. Self-Containment" since T0 catches the most obvious issues:
```markdown
### 6. Self-Containment
Can a developer execute each task from the plan alone? Focus on: Are the APIs and function signatures correct? Do the imports exist? Is the error handling complete? (Structural completeness — file paths, non-empty descriptions — is already verified by T0 lint.)
```

**Step 2 — Verify**
Run: `cat prompts/review-plan.md` to verify the changes look correct.
Run: `bun test` to verify no tests depend on exact prompt content.
Expected: All tests still pass — prompt content is not tested directly.
