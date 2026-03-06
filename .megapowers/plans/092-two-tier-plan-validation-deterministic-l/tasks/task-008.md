---
id: 8
title: Verify T1 prompt assembly includes tasks and spec content
status: approved
depends_on:
  - 6
  - 7
no_test: false
files_to_modify:
  - extensions/megapowers/validation/plan-lint-model.ts
  - tests/plan-lint-model.test.ts
files_to_create: []
---

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
