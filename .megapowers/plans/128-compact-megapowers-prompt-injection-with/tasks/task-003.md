---
id: 3
title: Render default context inspection report
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/context-summary.ts
  - tests/context-summary.test.ts
files_to_create: []
---

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
