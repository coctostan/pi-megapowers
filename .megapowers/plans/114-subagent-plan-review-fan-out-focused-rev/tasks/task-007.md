---
id: 7
title: Inject focused review artifacts and authority notes into the review prompt
status: approved
depends_on:
  - 4
  - 5
  - 6
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
  - prompts/review-plan.md
  - tests/prompt-inject.test.ts
files_to_create: []
---

### Task 7: Inject focused review artifacts and authority notes into the review prompt [depends: 4, 5, 6]

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `prompts/review-plan.md`
- Test: `tests/prompt-inject.test.ts`

**Covers:** AC23, AC24, AC25, AC26, AC27, AC28, AC29, AC30

**Step 1 — Write the failing test**
Append this new test block to `tests/prompt-inject.test.ts`:

```ts
describe("buildInjectedPrompt — focused review artifacts", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-focused-review-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function createTaskFiles(count: number) {
    const dir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(dir, { recursive: true });
    for (let i = 1; i <= count; i++) {
      writeFileSync(
        join(dir, `task-${String(i).padStart(3, "0")}.md`),
        `---\nid: ${i}\ntitle: Task ${i}\nstatus: draft\nfiles_to_modify:\n  - tests/fake-${i}.ts\nfiles_to_create: []\n---\nTask body ${i}.`,
      );
    }
  }

  it("keeps existing review behavior when focused review fan-out is not triggered", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    createTaskFiles(4);

    const result = buildInjectedPrompt(tmp);

    expect(result).not.toContain("Focused Review Advisory Artifacts");
    expect(result).not.toContain("coverage-review.md");
    expect(result).not.toContain("dependency-review.md");
    expect(result).not.toContain("task-quality-review.md");
  });

  it("includes all available focused review artifacts before the final review verdict is generated", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    createTaskFiles(5);
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "coverage-review.md"), "## Coverage Summary\n- Overall: covered");
    writeFileSync(join(planDir, "dependency-review.md"), "## Dependency Summary\n- Overall ordering: sound");
    writeFileSync(join(planDir, "task-quality-review.md"), "## Task Quality Summary\n- Overall: strong");

    const result = buildInjectedPrompt(tmp);

    expect(result).toContain("## Focused Review Advisory Artifacts");
    expect(result).toContain("## Coverage Summary");
    expect(result).toContain("## Dependency Summary");
    expect(result).toContain("## Task Quality Summary");
    expect(result).toContain("The main plan-review session still owns the final approve/revise decision and the only allowed `megapowers_plan_review` call.");
  });

  it("names missing artifacts when fan-out partially fails and emits a full failure note when none are available", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    createTaskFiles(5);
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "coverage-review.md"), "## Coverage Summary\n- Overall: partial");

    const partial = buildInjectedPrompt(tmp);
    expect(partial).toContain("Unavailable focused review artifacts: dependency-review.md, task-quality-review.md");

    rmSync(planDir, { recursive: true, force: true });
    mkdirSync(planDir, { recursive: true });
    const none = buildInjectedPrompt(tmp);
    expect(none).toContain("Focused review fan-out failed and the review proceeded without advisory artifacts.");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts`
Expected: FAIL — `expect(received).toContain(expected)` for the missing focused-review prompt text, because `buildInjectedPrompt()` does not yet include advisory artifact sections or missing-artifact warnings.

**Step 3 — Write minimal implementation**
Make these exact changes.

1. In `extensions/megapowers/prompt-inject.ts`, add these imports near the top:
```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { shouldRunFocusedReviewFanout } from "./plan-review/focused-review.js";
```

2. In the same file, insert this helper above `buildInjectedPrompt`:
```ts
function buildFocusedReviewArtifactsSection(cwd: string, issueSlug: string, taskCount: number): string {
  if (!shouldRunFocusedReviewFanout(taskCount)) return "";

  const planDir = join(cwd, ".megapowers", "plans", issueSlug);
  const artifactFiles = [
    "coverage-review.md",
    "dependency-review.md",
    "task-quality-review.md",
  ] as const;

  const available = artifactFiles.filter((file) => existsSync(join(planDir, file)));
  const missing = artifactFiles.filter((file) => !existsSync(join(planDir, file)));

  const sections = [
    "## Focused Review Advisory Artifacts",
    "Focused reviewers are advisory only. Artifact availability does not change which session may call `megapowers_plan_review`.",
    "The main plan-review session still owns the final approve/revise decision and the only allowed `megapowers_plan_review` call.",
    "",
  ];

  if (available.length === 0) {
    sections.push("Focused review fan-out failed and the review proceeded without advisory artifacts.");
    return sections.join("\n");
  }

  if (missing.length > 0) {
    sections.push(`Unavailable focused review artifacts: ${missing.join(", ")}`);
    sections.push("");
  }

  for (const file of available) {
    sections.push(`### ${file}`);
    sections.push(readFileSync(join(planDir, file), "utf-8").trim());
    sections.push("");
  }

  return sections.join("\n").trim();
}
```

3. Still in `buildInjectedPrompt`, replace the current implement-phase block:
```ts
  if (state.phase === "implement") {
    const tasks = deriveTasks(cwd, state.activeIssue);
    if (tasks.length > 0) {
      const completedSet = new Set(state.completedTasks);
      const tasksWithCompletion = tasks.map(t => ({ ...t, completed: completedSet.has(t.index) }));
      Object.assign(vars, buildImplementTaskVars(tasksWithCompletion, state.currentTaskIndex));
    }
  }
```
with this version so the same derived task list can also power plan-review artifact gating:
```ts
  const derivedTasks = deriveTasks(cwd, state.activeIssue);

  if (state.phase === "implement") {
    if (derivedTasks.length > 0) {
      const completedSet = new Set(state.completedTasks);
      const tasksWithCompletion = derivedTasks.map(t => ({ ...t, completed: completedSet.has(t.index) }));
      Object.assign(vars, buildImplementTaskVars(tasksWithCompletion, state.currentTaskIndex));
    }
  }
```

4. Immediately after the existing plan-phase `plan_iteration` / `revise_instructions` block, add:
```ts
    if (state.planMode === "review") {
      vars.focused_review_artifacts = buildFocusedReviewArtifactsSection(
        cwd,
        state.activeIssue,
        derivedTasks.length,
      );
    } else {
      vars.focused_review_artifacts = "";
    }
```

5. In `prompts/review-plan.md`, insert this line right after the current `## Plan` section instructions about reading task files:
```md
{{focused_review_artifacts}}
```

Do not change the rest of the verdict instructions.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
