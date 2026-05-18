---
id: 1
title: Derive compact context summary
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/context-summary.ts
  - tests/context-summary.test.ts
---

**Covers:** AC 3, AC 4, AC 5, AC 6, AC 16, AC 17, AC 18, AC 19, AC 20, AC 22

**Files:**
- Create: `extensions/megapowers/context-summary.ts`
- Test: `tests/context-summary.test.ts`

**Step 1 — Write the failing test**
Create `tests/context-summary.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildContextSummary, formatCompactContextStatus } from "../extensions/megapowers/context-summary.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";

function setState(cwd: string, overrides: Partial<MegapowersState>) {
  writeState(cwd, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    megaEnabled: true,
    ...overrides,
  });
}

describe("context summary derivation", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "context-summary-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("derives workflow, phase, plan mode, task progress, artifacts, and active tool guidance without storing derived prompt text", () => {
    const store = createStore(tmp);
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "spec.md"), "# Spec\n\n## Acceptance Criteria\n1. Works");
    writeFileSync(join(planDir, "plan.md"), "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
    setState(tmp, {
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
      currentTaskIndex: 1,
      completedTasks: [1],
      tddTaskState: { taskIndex: 2, state: "impl-allowed", skipped: false },
    });

    const beforeState = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
    const summary = buildContextSummary(tmp, store);
    const status = formatCompactContextStatus(summary);
    const afterState = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");

    expect(afterState).toBe(beforeState);

    expect(summary.workflow).toBe("feature");
    expect(summary.phase).toBe("plan");
    expect(summary.planMode).toBe("draft");
    expect(summary.taskProgress).toEqual({ current: 2, total: 2, completed: 1, tddState: "impl-allowed" });
    expect(summary.artifacts.available).toContain("spec.md");
    expect(summary.artifacts.count).toBeGreaterThanOrEqual(2);
    expect(summary.toolGuidance.active).toContain("prompts/write-plan.md");
    expect(summary.toolGuidance.reference).toContain("docs/phase-tools.md");
    expect(summary.toolGuidance.availabilityNote).toContain("preferred if available");
    expect(status).toContain("feature/plan");
    expect(status).toContain("mode draft");
    expect(status).toContain("task 2/2");
    expect(status).toContain("artifacts");
    expect(JSON.stringify(summary)).not.toContain("You are writing a step-by-step implementation plan");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/context-summary.test.ts`
Expected: FAIL — `Cannot find module '../extensions/megapowers/context-summary.js' from 'tests/context-summary.test.ts'`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/context-summary.ts`:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readState } from "./state/state-io.js";
import { deriveTasks } from "./state/derived.js";
import type { Phase, PlanMode, TddState, WorkflowType } from "./state/state-machine.js";
import type { Store } from "./state/store.js";
import { getWorkflowConfig } from "./workflows/registry.js";
import { deriveToolInstructions } from "./workflows/tool-instructions.js";
import { resolvePlanTemplate } from "./plan-orchestrator.js";

export interface ContextTaskProgress {
  current: number;
  total: number;
  completed: number;
  tddState: TddState | null;
}

export interface ContextArtifactsSummary {
  available: string[];
  missing: string[];
  count: number;
}

export interface ContextToolGuidanceSummary {
  active: string;
  reference: string;
  availabilityNote: string;
  instructionSummary: string;
}

export interface MegapowersContextSummary {
  megaEnabled: boolean;
  activeIssue: string | null;
  workflow: WorkflowType | null;
  phase: Phase | null;
  planMode: PlanMode;
  taskProgress: ContextTaskProgress | null;
  artifacts: ContextArtifactsSummary;
  toolGuidance: ContextToolGuidanceSummary;
}

const TASK_ORIENTED_PHASES = new Set<Phase>(["plan", "implement", "verify", "code-review", "done"]);

function planFileExists(cwd: string, issueSlug: string, filename: string, store?: Store): boolean {
  if (store?.planFileExists(issueSlug, filename)) return true;
  return existsSync(join(cwd, ".megapowers", "plans", issueSlug, filename));
}

function deriveArtifacts(cwd: string, issueSlug: string | null, workflow: WorkflowType | null, store?: Store): ContextArtifactsSummary {
  if (!issueSlug) return { available: [], missing: [], count: 0 };

  const names = new Set<string>(["plan.md"]);
  if (workflow) {
    for (const phase of getWorkflowConfig(workflow).phases) {
      if (phase.artifact) names.add(phase.artifact);
    }
  }

  const available: string[] = [];
  const missing: string[] = [];
  for (const filename of [...names].sort()) {
    if (planFileExists(cwd, issueSlug, filename, store)) available.push(filename);
    else missing.push(filename);
  }

  return { available, missing, count: available.length };
}

function deriveTaskProgress(cwd: string, issueSlug: string | null, phase: Phase | null, currentTaskIndex: number, completedTasks: number[], tddState: TddState | null): ContextTaskProgress | null {
  if (!issueSlug || !phase || !TASK_ORIENTED_PHASES.has(phase)) return null;
  const tasks = deriveTasks(cwd, issueSlug);
  if (tasks.length === 0) return null;
  const boundedIndex = Math.max(0, Math.min(currentTaskIndex, tasks.length - 1));
  return {
    current: boundedIndex + 1,
    total: tasks.length,
    completed: completedTasks.length,
    tddState,
  };
}

function promptSourceFor(phase: Phase | null, planMode: PlanMode): string {
  if (!phase) return "idle context";
  if (phase === "plan" && planMode) return `prompts/${resolvePlanTemplate(planMode)}`;
  if (phase === "spec") return "prompts/write-spec.md";
  if (phase === "reproduce") return "prompts/reproduce-bug.md";
  if (phase === "diagnose") return "prompts/diagnose-bug.md";
  if (phase === "implement") return "prompts/implement-task.md";
  return `prompts/${phase}.md`;
}

function deriveGuidance(cwd: string, issueSlug: string | null, workflow: WorkflowType | null, phase: Phase | null, planMode: PlanMode): ContextToolGuidanceSummary {
  let instructionSummary = "No active workflow phase guidance.";
  if (issueSlug && workflow && phase) {
    const config = getWorkflowConfig(workflow);
    const phaseConfig = config.phases.find((p) => p.name === phase);
    if (phaseConfig) {
      const isTerminal = config.phases[config.phases.length - 1]?.name === phase;
      instructionSummary = deriveToolInstructions(phaseConfig, issueSlug, { isTerminal }) || instructionSummary;
    }
  }

  return {
    active: `${promptSourceFor(phase, planMode)} is active for ${workflow ?? "no-workflow"}/${phase ?? "idle"}${planMode ? ` (${planMode})` : ""}.`,
    reference: "Prompt markdown in prompts/*.md is the source of truth; docs/phase-tools.md is the compact review index.",
    availabilityNote: "Project-specific tools mentioned by guidance are preferred if available.",
    instructionSummary,
  };
}

export function buildContextSummary(cwd: string, store?: Store): MegapowersContextSummary {
  const state = readState(cwd);
  const tddState = state.tddTaskState?.state ?? null;
  return {
    megaEnabled: state.megaEnabled,
    activeIssue: state.activeIssue,
    workflow: state.workflow,
    phase: state.phase,
    planMode: state.planMode,
    taskProgress: deriveTaskProgress(cwd, state.activeIssue, state.phase, state.currentTaskIndex, state.completedTasks, tddState),
    artifacts: deriveArtifacts(cwd, state.activeIssue, state.workflow, store),
    toolGuidance: deriveGuidance(cwd, state.activeIssue, state.workflow, state.phase, state.planMode),
  };
}

export function formatCompactContextStatus(summary: MegapowersContextSummary): string {
  const parts = [`⚡ ${summary.workflow && summary.phase ? `${summary.workflow}/${summary.phase}` : "idle"}`];
  if (summary.phase === "plan" && summary.planMode) parts.push(`mode ${summary.planMode}`);
  if (summary.taskProgress) parts.push(`task ${summary.taskProgress.current}/${summary.taskProgress.total}`);
  parts.push(`${summary.artifacts.count} artifacts`);
  return parts.join(" • ");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/context-summary.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
