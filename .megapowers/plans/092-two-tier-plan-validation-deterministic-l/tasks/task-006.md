---
id: 6
title: Create plan-lint-model module with completeFn injection and response parsing
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/validation/plan-lint-model.ts
  - tests/plan-lint-model.test.ts
---

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
