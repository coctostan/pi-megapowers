---
id: 4
title: Add focused review fan-out gating and plan builder
status: approved
depends_on:
  - 1
  - 2
  - 3
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/plan-review/focused-review.ts
  - tests/focused-review.test.ts
---

### Task 4: Add focused review fan-out gating and plan builder [depends: 1, 2, 3]

**Files:**
- Create: `extensions/megapowers/plan-review/focused-review.ts`
- Test: `tests/focused-review.test.ts`

**Covers:** AC16, AC17, AC19, AC20, AC21, AC22

**Step 1 — Write the failing test**
Create `tests/focused-review.test.ts` with this complete content:

```ts
import { describe, it, expect } from "bun:test";
import {
  FOCUSED_REVIEW_AGENTS,
  FOCUSED_REVIEW_THRESHOLD,
  buildFocusedReviewFanoutPlan,
  shouldRunFocusedReviewFanout,
} from "../extensions/megapowers/plan-review/focused-review.js";

describe("focused review fan-out plan", () => {
  it("returns false and no plan when the task count is below the threshold", () => {
    expect(FOCUSED_REVIEW_THRESHOLD).toBe(5);
    expect(shouldRunFocusedReviewFanout(0)).toBe(false);
    expect(shouldRunFocusedReviewFanout(4)).toBe(false);
    expect(
      buildFocusedReviewFanoutPlan({
        issueSlug: "001-test",
        workflow: "feature",
        taskCount: 4,
      }),
    ).toBeNull();
  });

  it("returns a pi-subagents parallel plan with the exact three reviewer names at five tasks", () => {
    const plan = buildFocusedReviewFanoutPlan({
      issueSlug: "001-test",
      workflow: "feature",
      taskCount: 5,
    });

    expect(plan).not.toBeNull();
    expect(FOCUSED_REVIEW_AGENTS).toEqual([
      "coverage-reviewer",
      "dependency-reviewer",
      "task-quality-reviewer",
    ]);
    expect(plan?.runtime).toBe("pi-subagents");
    expect(plan?.mode).toBe("parallel");
    expect(plan?.tasks.map((task) => task.agent)).toEqual(FOCUSED_REVIEW_AGENTS);
    expect(plan?.artifacts).toEqual({
      "coverage-reviewer": ".megapowers/plans/001-test/coverage-review.md",
      "dependency-reviewer": ".megapowers/plans/001-test/dependency-review.md",
      "task-quality-reviewer": ".megapowers/plans/001-test/task-quality-review.md",
    });
    expect(plan?.tasks[0]?.task).toContain(".megapowers/plans/001-test/spec.md");
    expect(plan?.tasks[0]?.task).toContain(".megapowers/plans/001-test/tasks/");
    expect(plan?.tasks[1]?.task).toContain("dependency-review.md");
    expect(plan?.tasks[2]?.task).toContain("task-quality-review.md");
  });

  it("uses diagnosis.md instead of spec.md for bugfix workflows", () => {
    const plan = buildFocusedReviewFanoutPlan({
      issueSlug: "001-bug",
      workflow: "bugfix",
      taskCount: 6,
    });

    expect(plan).not.toBeNull();
    expect(plan?.tasks[0]?.task).toContain(".megapowers/plans/001-bug/diagnosis.md");
    expect(plan?.tasks[0]?.task).not.toContain(".megapowers/plans/001-bug/spec.md");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/focused-review.test.ts`
Expected: FAIL — `Cannot find module '../extensions/megapowers/plan-review/focused-review.js'`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/plan-review/focused-review.ts` with this complete content:

```ts
import type { WorkflowType } from "../state/state-machine.js";

export const FOCUSED_REVIEW_THRESHOLD = 5;
export const FOCUSED_REVIEW_AGENTS = [
  "coverage-reviewer",
  "dependency-reviewer",
  "task-quality-reviewer",
] as const;

export type FocusedReviewAgent = (typeof FOCUSED_REVIEW_AGENTS)[number];

export interface FocusedReviewFanoutTask {
  agent: FocusedReviewAgent;
  task: string;
}

export interface FocusedReviewFanoutPlan {
  runtime: "pi-subagents";
  mode: "parallel";
  tasks: FocusedReviewFanoutTask[];
  artifacts: Record<FocusedReviewAgent, string>;
}

export interface BuildFocusedReviewFanoutPlanParams {
  issueSlug: string;
  workflow: WorkflowType;
  taskCount: number;
}

export function shouldRunFocusedReviewFanout(taskCount: number): boolean {
  return taskCount >= FOCUSED_REVIEW_THRESHOLD;
}

export function buildFocusedReviewFanoutPlan(
  params: BuildFocusedReviewFanoutPlanParams,
): FocusedReviewFanoutPlan | null {
  if (!shouldRunFocusedReviewFanout(params.taskCount)) return null;

  const planDir = `.megapowers/plans/${params.issueSlug}`;
  const planningInput = `${planDir}/${params.workflow === "bugfix" ? "diagnosis.md" : "spec.md"}`;
  const tasksDir = `${planDir}/tasks/`;
  const artifacts: Record<FocusedReviewAgent, string> = {
    "coverage-reviewer": `${planDir}/coverage-review.md`,
    "dependency-reviewer": `${planDir}/dependency-review.md`,
    "task-quality-reviewer": `${planDir}/task-quality-review.md`,
  };

  return {
    runtime: "pi-subagents",
    mode: "parallel",
    artifacts,
    tasks: [
      {
        agent: "coverage-reviewer",
        task: [
          `Review issue ${params.issueSlug}.`,
          `Read ${planningInput} and every task file under ${tasksDir}.`,
          `Write your bounded advisory artifact to ${artifacts["coverage-reviewer"]}.`,
          "You are advisory only; the main session keeps final approve/revise authority.",
        ].join("\n"),
      },
      {
        agent: "dependency-reviewer",
        task: [
          `Review issue ${params.issueSlug}.`,
          `Read ${planningInput} and every task file under ${tasksDir}.`,
          `Write your bounded advisory artifact to ${artifacts["dependency-reviewer"]}.`,
          "Focus on ordering, forward references, hidden prerequisites, and sequencing hazards.",
        ].join("\n"),
      },
      {
        agent: "task-quality-reviewer",
        task: [
          `Review issue ${params.issueSlug}.`,
          `Read ${planningInput} and every task file under ${tasksDir}.`,
          `Write your bounded advisory artifact to ${artifacts["task-quality-reviewer"]}.`,
          "Focus on TDD completeness, realistic commands/errors, real file paths, correct APIs, and self-containment.",
        ].join("\n"),
      },
    ],
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/focused-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
