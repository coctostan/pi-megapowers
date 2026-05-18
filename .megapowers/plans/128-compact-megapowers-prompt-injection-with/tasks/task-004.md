---
id: 4
title: Render debug context inspection report
status: approved
depends_on:
  - 3
no_test: false
files_to_modify:
  - extensions/megapowers/context-summary.ts
  - tests/context-summary.test.ts
files_to_create: []
---

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
