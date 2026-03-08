# Plan

### Task 1: Add project coverage-reviewer agent definition [no-test]

### Task 1: Add project coverage-reviewer agent definition [no-test]

**Justification:** prompt-only change — this task creates a new project-scoped advisory agent definition in markdown. The behavior is the bounded prompt contract itself, so verification should check the file contents directly rather than add product code tests.

**Covers:** AC1, AC2, AC3, AC4, AC5

**Files:**
- Create: `.pi/agents/coverage-reviewer.md`

**Step 1 — Make the change**
Create `.pi/agents/coverage-reviewer.md` with this complete content:

```md
---
name: coverage-reviewer
description: Focused plan-review advisor for acceptance-criteria coverage
model: anthropic/claude-sonnet-4-5
tools: read, write, bash, grep, find, ls
thinking: medium
---

You are a focused coverage reviewer for Megapowers plan review. Your only job is to analyze whether the current plan tasks cover the current acceptance criteria or fixed-when criteria.

## Required input
- For feature workflows, read the active `.megapowers/plans/<issue-slug>/spec.md` first.
- For bugfix workflows, read the active `.megapowers/plans/<issue-slug>/diagnosis.md` first.
- Then read every current task file under `.megapowers/plans/<issue-slug>/tasks/`.
- If the planning artifact or task directory is missing, stop and report the missing input instead of inventing coverage conclusions.

## Scope
Analyze only:
1. Which acceptance criteria / fixed-when items are covered by which tasks.
2. Which criteria are missing, weakly covered, or duplicated.
3. Whether task references are concrete enough for the main reviewer to verify coverage quickly.

## Authority boundaries
You are advisory only.
- Do not call `megapowers_plan_task`.
- Do not call `megapowers_plan_review`.
- Do not call `megapowers_signal`.
- Do not edit `.megapowers/state.json`.
- Do not approve or reject the plan.
- Final approve/revise authority remains with the main plan-review session.

## Output
Write your artifact to:
`.megapowers/plans/<issue-slug>/coverage-review.md`

Use this bounded format:

```md
## Coverage Summary
- Overall: covered | partial | missing
- Planning input: spec.md | diagnosis.md

## AC-by-AC Findings
- AC 1 — covered | weak | missing
  - Tasks: 1, 3
  - Finding: [one concrete sentence]
- AC 2 — covered | weak | missing
  - Tasks: none
  - Finding: [one concrete sentence]

## Missing Coverage
- [criterion IDs or `None`]

## Weak Coverage / Ambiguities
- [short bullet list or `None`]

## Notes for the Main Reviewer
- [up to 3 short bullets]
```

## Output rules
- Keep the artifact bounded and scannable.
- Tie every finding to specific AC IDs and task numbers.
- Prefer exact task references over generic prose.
- Stay coverage-focused; do not drift into dependency or task-quality review.
```

**Step 2 — Verify**
Run:
```bash
bash -lc 'test -f .pi/agents/coverage-reviewer.md && grep -q "^name: coverage-reviewer$" .pi/agents/coverage-reviewer.md && grep -q "read the active `.megapowers/plans/<issue-slug>/spec.md` first" .pi/agents/coverage-reviewer.md && grep -q "read the active `.megapowers/plans/<issue-slug>/diagnosis.md` first" .pi/agents/coverage-reviewer.md && grep -q ".megapowers/plans/<issue-slug>/coverage-review.md" .pi/agents/coverage-reviewer.md && grep -q "## AC-by-AC Findings" .pi/agents/coverage-reviewer.md && grep -q "Final approve/revise authority remains with the main plan-review session." .pi/agents/coverage-reviewer.md'
```
Expected: command exits 0 and confirms the agent file exists, reads spec/diagnosis + task files, writes `coverage-review.md`, uses a bounded AC-by-AC format, and states that it is advisory only.

### Task 2: Add project dependency-reviewer agent definition [no-test]

### Task 2: Add project dependency-reviewer agent definition [no-test]

**Justification:** prompt-only change — this task adds a new advisory reviewer prompt file. The observable requirement is the exact bounded prompt contract, so direct file verification is the right test surface.

**Covers:** AC6, AC7, AC8, AC9, AC10

**Files:**
- Create: `.pi/agents/dependency-reviewer.md`

**Step 1 — Make the change**
Create `.pi/agents/dependency-reviewer.md` with this complete content:

```md
---
name: dependency-reviewer
description: Focused plan-review advisor for ordering and dependency hazards
model: anthropic/claude-sonnet-4-5
tools: read, write, bash, grep, find, ls
thinking: medium
---

You are a focused dependency reviewer for Megapowers plan review. Your only job is to inspect the current task graph for ordering mistakes and hidden prerequisites.

## Required input
- Read the active `.megapowers/plans/<issue-slug>/tasks/` directory first.
- Read the current `.megapowers/plans/<issue-slug>/spec.md` for feature workflows or `.megapowers/plans/<issue-slug>/diagnosis.md` for bugfix workflows.
- Read only the repo files needed to verify ordering assumptions or prerequisites mentioned by the tasks.
- If the task files are missing, stop and report that instead of inventing dependencies.

## Scope
Analyze only:
1. Task ordering and forward references.
2. Hidden prerequisites and sequencing hazards.
3. Unnecessary dependencies or over-coupled task chains.
4. Task-to-task risks that could break TDD or self-containment.

## Authority boundaries
You are advisory only.
- Do not call `megapowers_plan_task`.
- Do not call `megapowers_plan_review`.
- Do not call `megapowers_signal`.
- Do not edit `.megapowers/state.json`.
- Do not approve or reject the plan.
- Final approve/revise authority remains with the main plan-review session.

## Output
Write your artifact to:
`.megapowers/plans/<issue-slug>/dependency-review.md`

Use this bounded format:

```md
## Dependency Summary
- Overall ordering: sound | risky | blocked

## Task-to-Task Findings
- Task 2 → Task 4
  - Type: forward-reference | hidden-prereq | unnecessary-dependency | sequencing-hazard
  - Finding: [one concrete sentence]
  - Suggested fix: [one concrete sentence]

## Missing Prerequisites
- [short bullets or `None`]

## Unnecessary Dependencies
- [short bullets or `None`]

## Notes for the Main Reviewer
- [up to 3 short bullets]
```

## Output rules
- Keep the artifact bounded.
- Reference exact task numbers in every finding.
- Focus on ordering and dependency correctness, not overall verdict ownership.
- Prefer concrete sequencing hazards over general architecture commentary.
```

**Step 2 — Verify**
Run:
```bash
bash -lc 'test -f .pi/agents/dependency-reviewer.md && grep -q "^name: dependency-reviewer$" .pi/agents/dependency-reviewer.md && grep -q "ordering mistakes and hidden prerequisites" .pi/agents/dependency-reviewer.md && grep -q "forward references" .pi/agents/dependency-reviewer.md && grep -q "hidden prerequisites" .pi/agents/dependency-reviewer.md && grep -q ".megapowers/plans/<issue-slug>/dependency-review.md" .pi/agents/dependency-reviewer.md && grep -q "## Task-to-Task Findings" .pi/agents/dependency-reviewer.md && grep -q "Final approve/revise authority remains with the main plan-review session." .pi/agents/dependency-reviewer.md'
```
Expected: command exits 0 and confirms the agent file exists, targets ordering / prerequisite analysis, writes `dependency-review.md`, uses a bounded task-to-task format, and states that it is advisory only.

### Task 3: Add project task-quality-reviewer agent definition [no-test]

### Task 3: Add project task-quality-reviewer agent definition [no-test]

**Justification:** prompt-only change — this task adds a bounded advisory agent definition. The correct verification is to check the generated markdown contract directly, not to add production behavior tests.

**Covers:** AC11, AC12, AC13, AC14, AC15

**Files:**
- Create: `.pi/agents/task-quality-reviewer.md`

**Step 1 — Make the change**
Create `.pi/agents/task-quality-reviewer.md` with this complete content:

```md
---
name: task-quality-reviewer
description: Focused plan-review advisor for per-task TDD quality and self-containment
model: anthropic/claude-sonnet-4-5
tools: read, write, bash, grep, find, ls
thinking: medium
---

You are a focused task-quality reviewer for Megapowers plan review. Your only job is to inspect each task body for TDD completeness, realistic commands and errors, real file paths, correct APIs, and self-containment.

## Required input
- Read every task file under `.megapowers/plans/<issue-slug>/tasks/`.
- Read the current `.megapowers/plans/<issue-slug>/spec.md` for feature workflows or `.megapowers/plans/<issue-slug>/diagnosis.md` for bugfix workflows.
- Read only the repo files needed to verify file paths, API names, commands, or error messages referenced by the tasks.
- If the tasks are missing, stop and report the missing task set instead of guessing.

## Scope
Analyze only:
1. Whether each task has complete TDD steps when it is not `[no-test]`.
2. Whether commands, error messages, file paths, imports, and APIs are realistic for this codebase.
3. Whether each task is self-contained and executable by a fresh session.
4. Whether each `[no-test]` justification is valid and paired with a verification step.

## Authority boundaries
You are advisory only.
- Do not call `megapowers_plan_task`.
- Do not call `megapowers_plan_review`.
- Do not call `megapowers_signal`.
- Do not edit `.megapowers/state.json`.
- Do not approve or reject the plan.
- Final approve/revise authority remains with the main plan-review session.

## Output
Write your artifact to:
`.megapowers/plans/<issue-slug>/task-quality-review.md`

Use this bounded format:

```md
## Task Quality Summary
- Overall: strong | mixed | weak

## Per-Task Findings
- Task 1
  - Status: pass | revise
  - Step refs: Step 1, Step 2
  - Paths / APIs: `tests/example.test.ts`, `handleThing()`
  - Finding: [one concrete sentence]

## Invalid No-Test Uses
- [short bullets or `None`]

## Repeated Realism Problems
- [short bullets or `None`]

## Notes for the Main Reviewer
- [up to 3 short bullets]
```

## Output rules
- Keep findings concrete and per-task.
- Tie each finding to task steps, file paths, commands, or API names.
- Do not give a final approve/revise verdict.
- Stay task-quality focused; do not drift into whole-plan dependency analysis.
```

**Step 2 — Verify**
Run:
```bash
bash -lc 'test -f .pi/agents/task-quality-reviewer.md && grep -q "^name: task-quality-reviewer$" .pi/agents/task-quality-reviewer.md && grep -q "TDD completeness, realistic commands and errors, real file paths, correct APIs, and self-containment" .pi/agents/task-quality-reviewer.md && grep -q ".megapowers/plans/<issue-slug>/task-quality-review.md" .pi/agents/task-quality-reviewer.md && grep -q "## Per-Task Findings" .pi/agents/task-quality-reviewer.md && grep -q "Step refs" .pi/agents/task-quality-reviewer.md && grep -q "Final approve/revise authority remains with the main plan-review session." .pi/agents/task-quality-reviewer.md'
```
Expected: command exits 0 and confirms the agent file exists, focuses on per-task TDD/codebase realism, writes `task-quality-review.md`, uses a bounded per-task format, and states that it is advisory only.

### Task 4: Add focused review fan-out gating and plan builder [depends: 1, 2, 3]

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

### Task 5: Run focused reviewers in parallel with soft-fail artifact collection [depends: 4]

### Task 5: Run focused reviewers in parallel with soft-fail artifact collection [depends: 4]

**Files:**
- Create: `extensions/megapowers/plan-review/focused-review-runner.ts`
- Test: `tests/focused-review-runner.test.ts`

**Covers:** AC24, AC25, AC26, AC27

**Step 1 — Write the failing test**
Create `tests/focused-review-runner.test.ts` with this complete content:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentConfig } from "pi-subagents/agents.js";
import type { SingleResult } from "pi-subagents/types.js";
import { runFocusedReviewFanout } from "../extensions/megapowers/plan-review/focused-review-runner.js";

function makeResult(agent: string, task: string): SingleResult {
  return {
    agent,
    task,
    exitCode: 0,
    messages: [],
    usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
  };
}

describe("runFocusedReviewFanout", () => {
  let tmp: string;
  let agents: AgentConfig[];

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "focused-review-runner-"));
    mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
    agents = [
      {
        name: "coverage-reviewer",
        description: "coverage",
        systemPrompt: "coverage",
        source: "project",
        filePath: "/x/coverage.md",
      },
      {
        name: "dependency-reviewer",
        description: "dependency",
        systemPrompt: "dependency",
        source: "project",
        filePath: "/x/dependency.md",
      },
      {
        name: "task-quality-reviewer",
        description: "quality",
        systemPrompt: "quality",
        source: "project",
        filePath: "/x/task-quality.md",
      },
    ];
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("runs the exact three focused reviewers in parallel through pi-subagents and records all produced artifacts", async () => {
    const calls: string[] = [];

    const result = await runFocusedReviewFanout(
      {
        cwd: tmp,
        issueSlug: "001-test",
        workflow: "feature",
        taskCount: 5,
      },
      {
        runtimeCwd: tmp,
        discoverAgents: () => ({ agents }),
        runSync: async (_runtimeCwd, _agents, agentName, task) => {
          calls.push(agentName);
          const filename =
            agentName === "coverage-reviewer"
              ? "coverage-review.md"
              : agentName === "dependency-reviewer"
                ? "dependency-review.md"
                : "task-quality-review.md";
          writeFileSync(join(tmp, ".megapowers", "plans", "001-test", filename), `# ${agentName}\n${task}`);
          return makeResult(agentName, task);
        },
      },
    );

    expect(result.ran).toBe(true);
    expect(result.mode).toBe("parallel");
    expect(result.runtime).toBe("pi-subagents");
    expect(calls.sort()).toEqual([
      "coverage-reviewer",
      "dependency-reviewer",
      "task-quality-reviewer",
    ]);
    expect(result.availableArtifacts).toEqual([
      "coverage-review.md",
      "dependency-review.md",
      "task-quality-review.md",
    ]);
    expect(result.unavailableArtifacts).toEqual([]);
  });

  it("continues when only one artifact is produced and names the unavailable artifacts", async () => {
    const result = await runFocusedReviewFanout(
      {
        cwd: tmp,
        issueSlug: "001-test",
        workflow: "feature",
        taskCount: 5,
      },
      {
        runtimeCwd: tmp,
        discoverAgents: () => ({ agents }),
        runSync: async (_runtimeCwd, _agents, agentName, task) => {
          if (agentName === "coverage-reviewer") {
            writeFileSync(join(tmp, ".megapowers", "plans", "001-test", "coverage-review.md"), `# coverage\n${task}`);
          }
          return makeResult(agentName, task);
        },
      },
    );

    expect(result.ran).toBe(true);
    expect(result.availableArtifacts).toEqual(["coverage-review.md"]);
    expect(result.unavailableArtifacts).toEqual([
      "dependency-review.md",
      "task-quality-review.md",
    ]);
    expect(result.message).toContain("Unavailable focused review artifacts: dependency-review.md, task-quality-review.md");
  });

  it("continues when all focused reviewers fail and reports a full fan-out failure", async () => {
    const result = await runFocusedReviewFanout(
      {
        cwd: tmp,
        issueSlug: "001-test",
        workflow: "feature",
        taskCount: 5,
      },
      {
        runtimeCwd: tmp,
        discoverAgents: () => ({ agents }),
        runSync: async () => {
          throw new Error("subagent crashed");
        },
      },
    );

    expect(result.ran).toBe(true);
    expect(result.availableArtifacts).toEqual([]);
    expect(result.unavailableArtifacts).toEqual([
      "coverage-review.md",
      "dependency-review.md",
      "task-quality-review.md",
    ]);
    expect(result.message).toContain("Focused review fan-out failed");
    expect(result.message).toContain("review proceeded without advisory artifacts");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/focused-review-runner.test.ts`
Expected: FAIL — `Cannot find module '../extensions/megapowers/plan-review/focused-review-runner.js'`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/plan-review/focused-review-runner.ts` with this complete content:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { discoverAgents } from "pi-subagents/agents.js";
import { runSync } from "pi-subagents/execution.js";
import type { AgentConfig } from "pi-subagents/agents.js";
import type { SingleResult } from "pi-subagents/types.js";
import {
  buildFocusedReviewFanoutPlan,
  type BuildFocusedReviewFanoutPlanParams,
} from "./focused-review.js";

export interface FocusedReviewFanoutResult {
  ran: boolean;
  runtime: "pi-subagents";
  mode: "parallel";
  availableArtifacts: string[];
  unavailableArtifacts: string[];
  message: string;
}

export interface FocusedReviewRunnerDeps {
  runtimeCwd?: string;
  discoverAgents?: (cwd: string, scope: unknown) => { agents: AgentConfig[] };
  runSync?: (
    runtimeCwd: string,
    agents: AgentConfig[],
    agentName: string,
    task: string,
    options: { cwd?: string; runId: string; modelOverride?: string },
  ) => Promise<SingleResult>;
}

export async function runFocusedReviewFanout(
  params: BuildFocusedReviewFanoutPlanParams & { cwd: string },
  deps: FocusedReviewRunnerDeps = {},
): Promise<FocusedReviewFanoutResult> {
  const fanoutPlan = buildFocusedReviewFanoutPlan(params);
  if (!fanoutPlan) {
    return {
      ran: false,
      runtime: "pi-subagents",
      mode: "parallel",
      availableArtifacts: [],
      unavailableArtifacts: [],
      message: "Focused review fan-out not triggered.",
    };
  }

  const discover = deps.discoverAgents ?? discoverAgents;
  const exec = deps.runSync ?? runSync;
  const runtimeCwd = deps.runtimeCwd ?? params.cwd;
  const agents = discover(params.cwd, "both").agents;

  await Promise.allSettled(
    fanoutPlan.tasks.map((task, index) =>
      exec(runtimeCwd, agents, task.agent, task.task, {
        cwd: params.cwd,
        runId: `focused-review-${params.issueSlug}-${index + 1}`,
      }),
    ),
  );

  const artifactEntries = Object.entries(fanoutPlan.artifacts) as Array<[string, string]>;
  const availableArtifacts = artifactEntries
    .filter(([, artifactPath]) => existsSync(join(params.cwd, artifactPath)))
    .map(([, artifactPath]) => artifactPath.split("/").pop()!);
  const unavailableArtifacts = artifactEntries
    .filter(([, artifactPath]) => !existsSync(join(params.cwd, artifactPath)))
    .map(([, artifactPath]) => artifactPath.split("/").pop()!);

  const message = unavailableArtifacts.length === 0
    ? "Focused review fan-out completed with all advisory artifacts available."
    : availableArtifacts.length === 0
      ? "Focused review fan-out failed and the review proceeded without advisory artifacts."
      : `Unavailable focused review artifacts: ${unavailableArtifacts.join(", ")}`;

  return {
    ran: true,
    runtime: fanoutPlan.runtime,
    mode: fanoutPlan.mode,
    availableArtifacts,
    unavailableArtifacts,
    message,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/focused-review-runner.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: Invoke focused review fan-out before building the review prompt [depends: 4, 5]

### Task 6: Invoke focused review fan-out before building the review prompt [depends: 4, 5]

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/hooks-focused-review.test.ts`

**Covers:** AC18, AC19

**Step 1 — Write the failing test**
Create `tests/hooks-focused-review.test.ts` with this complete content:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { preparePlanReviewContext } from "../extensions/megapowers/hooks.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    ...overrides,
  });
}

function createTaskFiles(tmp: string, count: number) {
  const dir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
  mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= count; i++) {
    writeFileSync(
      join(dir, `task-${String(i).padStart(3, "0")}.md`),
      `---\nid: ${i}\ntitle: Task ${i}\nstatus: draft\nfiles_to_modify:\n  - tests/fake-${i}.ts\nfiles_to_create: []\n---\nTask body ${i}.`,
    );
  }
}

describe("preparePlanReviewContext", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-focused-review-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("does not invoke focused review fan-out when the current plan has fewer than five tasks", async () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    createTaskFiles(tmp, 4);

    let called = 0;
    await preparePlanReviewContext(tmp, async () => {
      called += 1;
      return {
        ran: false,
        runtime: "pi-subagents",
        mode: "parallel",
        availableArtifacts: [],
        unavailableArtifacts: [],
        message: "not triggered",
      };
    });

    expect(called).toBe(0);
  });

  it("invokes focused review fan-out for plan review sessions with five or more tasks", async () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    createTaskFiles(tmp, 5);

    let captured: any = null;
    await preparePlanReviewContext(tmp, async (params) => {
      captured = params;
      return {
        ran: true,
        runtime: "pi-subagents",
        mode: "parallel",
        availableArtifacts: [],
        unavailableArtifacts: ["coverage-review.md"],
        message: "Unavailable focused review artifacts: coverage-review.md",
      };
    });

    expect(captured).toEqual({
      cwd: tmp,
      issueSlug: "001-test",
      workflow: "feature",
      taskCount: 5,
    });
  });

  it("soft-fails when focused review fan-out throws so review can still proceed", async () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    createTaskFiles(tmp, 6);

    await expect(
      preparePlanReviewContext(tmp, async () => {
        throw new Error("subagent timeout");
      }),
    ).resolves.toBeUndefined();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/hooks-focused-review.test.ts`
Expected: FAIL — `preparePlanReviewContext is not exported by '../extensions/megapowers/hooks.js'`

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/hooks.ts` exactly as follows:

1. Replace the import block at the top with:
```ts
import type { Deps } from "./commands.js";
import { readState, writeState } from "./state/state-io.js";
import { deriveTasks } from "./state/derived.js";
import { buildInjectedPrompt } from "./prompt-inject.js";
import { showDoneChecklist } from "./ui.js";
import { evaluateWriteOverride, recordTestFileWritten } from "./tools/tool-overrides.js";
import { runFocusedReviewFanout, type FocusedReviewFanoutResult } from "./plan-review/focused-review-runner.js";
import { shouldRunFocusedReviewFanout } from "./plan-review/focused-review.js";
```

2. Insert this exported helper above `onBeforeAgentStart`:
```ts
export async function preparePlanReviewContext(
  cwd: string,
  runFocusedReviewFanoutFn: typeof runFocusedReviewFanout = runFocusedReviewFanout,
): Promise<FocusedReviewFanoutResult | void> {
  const state = readState(cwd);
  if (state.phase !== "plan" || state.planMode !== "review" || !state.activeIssue || !state.workflow) {
    return;
  }

  const taskCount = deriveTasks(cwd, state.activeIssue).length;
  if (!shouldRunFocusedReviewFanout(taskCount)) return;

  try {
    return await runFocusedReviewFanoutFn({
      cwd,
      issueSlug: state.activeIssue,
      workflow: state.workflow,
      taskCount,
    });
  } catch {
    return;
  }
}
```

3. Replace `onBeforeAgentStart` with:
```ts
export async function onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any> {
  const { store } = deps;

  await preparePlanReviewContext(ctx.cwd);

  const prompt = buildInjectedPrompt(ctx.cwd, store);
  if (!prompt) return;

  return {
    message: {
      customType: "megapowers-context",
      content: prompt,
      display: false,
    },
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/hooks-focused-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Inject focused review artifacts and authority notes into the review prompt [depends: 4, 5, 6]

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
