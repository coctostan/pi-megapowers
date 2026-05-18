# Plan

### Task 1: Derive compact context summary

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

### Task 2: Update hook status indicator [depends: 1]

**Covers:** AC 1, AC 2, AC 3, AC 4, AC 5, AC 6, AC 23

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/hooks.test.ts`

**Step 1 — Write the failing test**
Append to `tests/hooks.test.ts`:

```ts
import { onBeforeAgentStart } from "../extensions/megapowers/hooks.js";
import { createStore } from "../extensions/megapowers/state/store.js";

describe("onBeforeAgentStart — compact context status", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-context-status-"));
    mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "plans", "001-test", "spec.md"), "# Spec");
    writeFileSync(join(tmp, ".megapowers", "plans", "001-test", "plan.md"), "# Plan\n\n### Task 1: Build it\n");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("keeps hidden megapowers-context injection and updates TUI status without notifications", async () => {
    setState(tmp, { phase: "implement", currentTaskIndex: 0, completedTasks: [], tddTaskState: { taskIndex: 1, state: "test-written", skipped: false } });
    const notifications: string[] = [];
    const statuses: string[] = [];
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: {
        notify: (message: string) => notifications.push(message),
        setStatus: (message: string) => statuses.push(message),
      },
    };

    const result = await onBeforeAgentStart({}, ctx as any, { store: createStore(tmp), ui: { renderDashboard: () => {} } } as any);

    expect(result?.message?.customType).toBe("megapowers-context");
    expect(result?.message?.display).toBe(false);
    expect(result?.message?.content).toContain("megapowers_signal");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toContain("feature/implement");
    expect(statuses[0]).toContain("task 1/1");
    expect(statuses[0]).toContain("artifacts");
    expect(notifications).toEqual([]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/hooks.test.ts`
Expected: FAIL — `Expected length: 1` for `expect(statuses).toHaveLength(1)`

**Step 3 — Write minimal implementation**
Modify `extensions/megapowers/hooks.ts` imports:

```ts
import { buildContextSummary, formatCompactContextStatus } from "./context-summary.js";
```

Replace `onBeforeAgentStart` with:

```ts
export async function onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any> {
  const { store } = deps;
  await preparePlanReviewContext(ctx.cwd);
  const prompt = buildInjectedPrompt(ctx.cwd, store);
  if (!prompt) return;

  if (ctx.hasUI && ctx.ui?.setStatus) {
    const summary = buildContextSummary(ctx.cwd, store);
    ctx.ui.setStatus(formatCompactContextStatus(summary));
  }

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
Run: `bun test tests/hooks.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Render default context inspection report [depends: 1]

**Covers:** AC 9, AC 10, AC 11, AC 12, AC 13, AC 16, AC 18, AC 19, AC 20, AC 21

**Files:**
- Modify: `extensions/megapowers/context-summary.ts`
- Test: `tests/context-summary.test.ts`

**Step 1 — Write the failing test**
Update the import in `tests/context-summary.test.ts`:

```ts
import { buildContextSummary, formatCompactContextStatus, renderContextReport } from "../extensions/megapowers/context-summary.js";
```

Append to `tests/context-summary.test.ts`:

```ts
describe("context inspection report", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "context-report-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("renders metadata, active guidance, task/TDD state, and artifact availability without the full prompt", () => {
    const store = createStore(tmp);
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "spec.md"), "# Spec\n\n## Acceptance Criteria\n1. Works");
    writeFileSync(join(planDir, "plan.md"), "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
    setState(tmp, {
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
      currentTaskIndex: 0,
      completedTasks: [],
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });

    const report = renderContextReport(tmp, store);

    expect(report).toContain("Workflow: feature");
    expect(report).toContain("Phase: plan");
    expect(report).toContain("Plan mode: draft");
    expect(report).toContain("Current task: 1/2");
    expect(report).toContain("TDD state: test-written");
    expect(report).toContain("Available artifacts");
    expect(report).toContain("spec.md");
    expect(report).toContain("Tool guidance");
    expect(report).toContain("prompts/write-plan.md");
    expect(report).toContain("docs/phase-tools.md");
    expect(report).toContain("preferred if available");
    expect(report).not.toContain("You are writing a step-by-step implementation plan");
    expect(report).not.toContain("## Megapowers Protocol");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/context-summary.test.ts`
Expected: FAIL — `SyntaxError: Export named 'renderContextReport' not found in module '../extensions/megapowers/context-summary.js'.`

**Step 3 — Write minimal implementation**
Append to `extensions/megapowers/context-summary.ts`:

```ts
function formatList(label: string, values: string[]): string[] {
  if (values.length === 0) return [`${label}: none`];
  return [`${label}:`, ...values.map((value) => `- ${value}`)];
}

export function renderContextReport(cwd: string, store?: Store): string {
  const summary = buildContextSummary(cwd, store);
  const lines: string[] = [
    "# Megapowers Context",
    "",
    `Enabled: ${summary.megaEnabled ? "yes" : "no"}`,
    `Issue: ${summary.activeIssue ?? "none"}`,
    `Workflow: ${summary.workflow ?? "none"}`,
    `Phase: ${summary.phase ?? "none"}`,
  ];

  if (summary.phase === "plan" && summary.planMode) {
    lines.push(`Plan mode: ${summary.planMode}`);
  }

  lines.push("");
  lines.push("## Task state");
  if (summary.taskProgress) {
    lines.push(`Current task: ${summary.taskProgress.current}/${summary.taskProgress.total}`);
    lines.push(`Completed tasks: ${summary.taskProgress.completed}/${summary.taskProgress.total}`);
    lines.push(`TDD state: ${summary.taskProgress.tddState ?? "none"}`);
  } else {
    lines.push("Current task: none");
    lines.push("TDD state: none");
  }

  lines.push("");
  lines.push("## Artifacts");
  lines.push(`Artifact count: ${summary.artifacts.count}`);
  lines.push(...formatList("Available artifacts", summary.artifacts.available));
  lines.push(...formatList("Missing artifacts", summary.artifacts.missing));

  lines.push("");
  lines.push("## Tool guidance");
  lines.push(summary.toolGuidance.active);
  lines.push(summary.toolGuidance.reference);
  lines.push(summary.toolGuidance.availabilityNote);
  lines.push(summary.toolGuidance.instructionSummary);

  return lines.join("\n");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/context-summary.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Render debug context inspection report [depends: 3]

**Covers:** AC 13, AC 14, AC 15, AC 16, AC 22

**Files:**
- Modify: `extensions/megapowers/context-summary.ts`
- Test: `tests/context-summary.test.ts`

**Step 1 — Write the failing test**
Append to `tests/context-summary.test.ts`:

```ts
describe("context inspection debug report", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "context-debug-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("includes an explicit rendered prompt section only in debug mode", () => {
    const store = createStore(tmp);
    mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const normal = renderContextReport(tmp, store);
    const debug = renderContextReport(tmp, store, { debug: true });

    expect(normal).not.toContain("## Rendered prompt");
    expect(normal).not.toContain("You are writing a step-by-step implementation plan");
    expect(debug).toContain("## Rendered prompt");
    expect(debug).toContain("You are writing a step-by-step implementation plan");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/context-summary.test.ts`
Expected: FAIL — `Expected substring: "## Rendered prompt"`

**Step 3 — Write minimal implementation**
Modify imports in `extensions/megapowers/context-summary.ts`:

```ts
import { buildInjectedPrompt } from "./prompt-inject.js";
```

Replace `renderContextReport` with:

```ts
export function renderContextReport(cwd: string, store?: Store, options?: { debug?: boolean }): string {
  const summary = buildContextSummary(cwd, store);
  const lines: string[] = [
    "# Megapowers Context",
    "",
    `Enabled: ${summary.megaEnabled ? "yes" : "no"}`,
    `Issue: ${summary.activeIssue ?? "none"}`,
    `Workflow: ${summary.workflow ?? "none"}`,
    `Phase: ${summary.phase ?? "none"}`,
  ];

  if (summary.phase === "plan" && summary.planMode) {
    lines.push(`Plan mode: ${summary.planMode}`);
  }

  lines.push("");
  lines.push("## Task state");
  if (summary.taskProgress) {
    lines.push(`Current task: ${summary.taskProgress.current}/${summary.taskProgress.total}`);
    lines.push(`Completed tasks: ${summary.taskProgress.completed}/${summary.taskProgress.total}`);
    lines.push(`TDD state: ${summary.taskProgress.tddState ?? "none"}`);
  } else {
    lines.push("Current task: none");
    lines.push("TDD state: none");
  }

  lines.push("");
  lines.push("## Artifacts");
  lines.push(`Artifact count: ${summary.artifacts.count}`);
  lines.push(...formatList("Available artifacts", summary.artifacts.available));
  lines.push(...formatList("Missing artifacts", summary.artifacts.missing));

  lines.push("");
  lines.push("## Tool guidance");
  lines.push(summary.toolGuidance.active);
  lines.push(summary.toolGuidance.reference);
  lines.push(summary.toolGuidance.availabilityNote);
  lines.push(summary.toolGuidance.instructionSummary);

  if (options?.debug) {
    lines.push("");
    lines.push("## Rendered prompt");
    lines.push(buildInjectedPrompt(cwd, store) ?? "No rendered prompt available.");
  }

  return lines.join("\n");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/context-summary.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: Add `/mega context` command [depends: 4]

**Covers:** AC 7, AC 9, AC 10, AC 14, AC 17

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Create: `tests/commands-context.test.ts`

**Step 1 — Write the failing test**
Create `tests/commands-context.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleMegaCommand } from "../extensions/megapowers/commands.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";

function setState(cwd: string, overrides: Partial<MegapowersState>) {
  writeState(cwd, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", megaEnabled: true, ...overrides });
}

function makeDeps(cwd: string) {
  return {
    pi: { getActiveTools: () => [], setActiveTools: (_tools: string[]) => {} },
    store: createStore(cwd),
    ui: { renderDashboard: () => {} },
  } as any;
}

describe("/mega context", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mega-context-command-"));
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "spec.md"), "# Spec");
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("renders default and debug context reports without mutating state", async () => {
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (message: string) => notices.push(message) } };
    const before = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");

    await handleMegaCommand("context", ctx as any, makeDeps(tmp));
    await handleMegaCommand("context debug", ctx as any, makeDeps(tmp));

    const after = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
    expect(notices).toHaveLength(2);
    expect(notices[0]).toContain("Workflow: feature");
    expect(notices[0]).toContain("Phase: plan");
    expect(notices[0]).toContain("Plan mode: draft");
    expect(notices[0]).not.toContain("## Rendered prompt");
    expect(notices[1]).toContain("## Rendered prompt");
    expect(notices[1]).toContain("You are writing a step-by-step implementation plan");
    expect(after).toBe(before);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/commands-context.test.ts`
Expected: FAIL — `Expected length: 2` for `expect(notices).toHaveLength(2)`

**Step 3 — Write minimal implementation**
Modify imports in `extensions/megapowers/commands.ts`:

```ts
import { renderContextReport } from "./context-summary.js";
```

Add this branch after `const sub = args.trim().toLowerCase();` and before the `off` branch:

```ts
if (sub === "context" || sub === "context debug") {
  const report = renderContextReport(ctx.cwd, deps.store, { debug: sub === "context debug" });
  if (ctx.hasUI) ctx.ui.notify(report, "info");
  return;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/commands-context.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: Add `/mp context` command [depends: 4]

**Covers:** AC 8, AC 9, AC 10, AC 15, AC 17, AC 21

**Files:**
- Modify: `extensions/megapowers/mp/mp-handlers.ts`
- Test: `tests/mp-command.test.ts`

**Step 1 — Write the failing test**
Append these imports to `tests/mp-command.test.ts` if they are not already present:

```ts
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
```

Append this test to `tests/mp-command.test.ts`:

```ts
describe("/mp context", () => {
  it("renders the same default and debug context report through the /mp registry", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "mp-context-"));
    try {
      mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
      writeFileSync(join(tmp, ".megapowers", "plans", "001-test", "spec.md"), "# Spec");
      writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
      const before = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
      const deps = { ...makeDeps(), store: createStore(tmp) } as any;
      const ctx = { ...makeCtx(), cwd: tmp } as any;
      const registry = createMpRegistry(deps);

      const normal = await dispatchMpCommand("context", ctx, registry);
      const debug = await dispatchMpCommand("context debug", ctx, registry);
      const after = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
      const completions = mpArgumentCompletions("con") ?? [];

      expect(after).toBe(before);
      expect(normal).toContain("Workflow: feature");
      expect(normal).toContain("Phase: plan");
      expect(normal).toContain("Plan mode: draft");
      expect(normal).not.toContain("## Rendered prompt");
      expect(debug).toContain("## Rendered prompt");
      expect(debug).toContain("You are writing a step-by-step implementation plan");
      expect(completions.map((item) => item.value)).toContain("context");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-command.test.ts`
Expected: FAIL — `Expected substring: "Workflow: feature"`

**Step 3 — Write minimal implementation**
Modify imports in `extensions/megapowers/mp/mp-handlers.ts`:

```ts
import { renderContextReport } from "../context-summary.js";
```

Add `"context",` to `MP_SUBCOMMANDS` between `"off"` and `"council"`.

Add this registry entry after `registry.off`:

```ts
registry.context = {
  tier: "programmatic",
  description: "Inspect current derived Megapowers context",
  execute: async (args: string, ctx: ExtensionCommandContext) => {
    return renderContextReport(ctx.cwd, deps.store, { debug: args.trim().toLowerCase() === "debug" });
  },
};
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-command.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
