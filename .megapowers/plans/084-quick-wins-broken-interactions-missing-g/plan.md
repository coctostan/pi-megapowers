# Revised Implementation Plan — #084 Quick Wins: Broken Interactions & Missing Guards

## AC → Task Mapping

| Fixed When | Task |
|------------|------|
| FC1: `megapowers_signal({ action: "phase_next", target: "implement" })` transitions backward | Task 2, Task 3 |
| FC2: `/phase implement` triggers backward transition from code-review | Task 4 |
| FC3: `/phase plan` triggers backward transition from review | Task 4 |
| FC4: Bugfix workflow has `review→plan` and `verify→implement` backward transitions | Task 1 |
| FC5: `handleSaveArtifact` creates versioned backup (`spec.v1.md`) on overwrite | Task 5 |
| FC6: Third overwrite creates `spec.v1.md` and `spec.v2.md`, latest in `spec.md` | Task 6 |
| FC7: All existing tests continue to pass | Task 7 |
| FC8: #061 regression test passes | Task 7 |

---

### Task 1: Add bugfix backward transitions with semantic config test

**Files**
- Modify: `extensions/megapowers/workflows/bugfix.ts`
- Modify: `tests/workflow-configs.test.ts`

**Step 1 — Write failing test**
Add to `tests/workflow-configs.test.ts` inside the existing `describe("bugfix workflow config", ...)` block:
```ts
it("has review → plan as backward transition", () => {
  const t = bugfixWorkflow.transitions.find(t => t.from === "review" && t.to === "plan");
  expect(t).toBeDefined();
  expect(t!.backward).toBe(true);
});

it("has verify → implement as backward transition", () => {
  const t = bugfixWorkflow.transitions.find(t => t.from === "verify" && t.to === "implement");
  expect(t).toBeDefined();
  expect(t!.backward).toBe(true);
});
```

**Step 2 — Run test (expect FAIL)**
Run: `bun test tests/workflow-configs.test.ts --test-name-pattern "has review → plan as backward"`
Expected fail: `expect(received).toBeDefined()` — no such transition found in bugfix config.

**Step 3 — Implement minimal change**
In `extensions/megapowers/workflows/bugfix.ts`, add two entries to the `transitions` array after the `{ from: "review", to: "implement", ... }` entry:
```ts
    { from: "review", to: "plan", gates: [], backward: true },
    { from: "verify", to: "implement", gates: [], backward: true },
```

Full transitions array after change:
```ts
  transitions: [
    { from: "reproduce", to: "diagnose", gates: [{ type: "requireArtifact", file: "reproduce.md" }] },
    { from: "diagnose", to: "plan", gates: [{ type: "requireArtifact", file: "diagnosis.md" }] },
    { from: "plan", to: "review", gates: [{ type: "requireArtifact", file: "plan.md" }] },
    { from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }] },
    { from: "review", to: "implement", gates: [{ type: "requireReviewApproved" }] },
    { from: "review", to: "plan", gates: [], backward: true },
    { from: "implement", to: "verify", gates: [{ type: "allTasksComplete" }] },
    { from: "verify", to: "done", gates: [{ type: "alwaysPass" }] },
    { from: "verify", to: "implement", gates: [], backward: true },
  ],
```

**Step 4 — Re-run (expect PASS)**
Run: `bun test tests/workflow-configs.test.ts --test-name-pattern "has review → plan as backward"`

**Step 5 — Full suite**
Run: `bun test`
Expected: all tests pass.

---

### Task 2: Plumb `target` through `handleSignal` → `handlePhaseNext` [depends: 1]

**Files**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

**Step 1 — Write failing test**
Add to `tests/tool-signal.test.ts` inside the existing `describe("handleSignal", ...)` block:
```ts
it("phase_next uses explicit target for backward transition", () => {
  writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
  setState(tmp, { phase: "code-review", workflow: "feature", completedTasks: [1] });

  const result = handleSignal(tmp, "phase_next", undefined, "implement");
  expect(result.error).toBeUndefined();
  expect(readState(tmp).phase).toBe("implement");
});
```

**Step 2 — Run test (expect FAIL)**
Run: `bun test tests/tool-signal.test.ts --test-name-pattern "phase_next uses explicit target"`
Expected fail: `handleSignal` only accepts 3 args — 4th arg ignored, `advancePhase` called with `undefined` target, phase becomes `"done"` instead of `"implement"`. Assertion `expect(readState(tmp).phase).toBe("implement")` fails with `received: "done"`.

**Step 3 — Implement minimal change**
In `extensions/megapowers/tools/tool-signal.ts`:

Change `handleSignal` signature (line 16):
```ts
export function handleSignal(
  cwd: string,
  action: "task_done" | "review_approve" | "phase_next" | string,
  jj?: JJ,
  target?: string,
): SignalResult {
```

Change `case "phase_next"` (line 33):
```ts
    case "phase_next":
      return handlePhaseNext(cwd, jj, target);
```

Change `handlePhaseNext` function (line ~244):
```ts
function handlePhaseNext(cwd: string, jj?: JJ, target?: string): SignalResult {
  const result = advancePhase(cwd, target as Phase | undefined, jj);
  if (!result.ok) {
    return { error: result.error };
  }
  return {
    message: `Phase advanced to ${result.newPhase}. Proceed with ${result.newPhase} phase work.`,
  };
}
```

**Step 4 — Re-run (expect PASS)**
Run: `bun test tests/tool-signal.test.ts --test-name-pattern "phase_next uses explicit target"`

**Step 5 — Full suite**
Run: `bun test`
Expected: all tests pass.

---

### Task 3: Add optional `target` to `megapowers_signal` tool schema and wire it through [depends: 2]

**Files**
- Modify: `extensions/megapowers/register-tools.ts`
- Modify: `tests/tool-signal.test.ts`

**Step 1 — Write failing test**
Add to `tests/tool-signal.test.ts` inside `describe("handleSignal", ...)`:
```ts
it("phase_next with target from feature code-review transitions to implement", () => {
  writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
  writeArtifact(tmp, "001-test", "code-review.md", "# Code Review\nApproved.");
  setState(tmp, { phase: "code-review", workflow: "feature", completedTasks: [1] });

  // Simulate what register-tools.ts will do: pass target from params
  const result = handleSignal(tmp, "phase_next", undefined, "implement");
  expect(result.error).toBeUndefined();
  expect(result.message).toContain("implement");
});
```

Note: This test validates that the plumbing from Task 2 works end-to-end. The schema change itself is verified by inspection since `register-tools.ts` is a pi integration layer not unit-testable without the full extension API.

**Step 2 — Run test (expect FAIL or PASS)**
Run: `bun test tests/tool-signal.test.ts --test-name-pattern "phase_next with target from feature"`
This may pass immediately since Task 2 wired the plumbing. If so, proceed to Step 3.

**Step 3 — Implement schema change**
In `extensions/megapowers/register-tools.ts`, update the `megapowers_signal` tool registration.

Change the parameters (around line 28):
```ts
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("task_done"),
        Type.Literal("review_approve"),
        Type.Literal("phase_next"),
        Type.Literal("tests_failed"),
        Type.Literal("tests_passed"),
      ]),
      target: Type.Optional(Type.String({ description: "Target phase for phase_next (enables backward transitions)" })),
    }),
```

Change the execute handler (around line 37):
```ts
      const result = handleSignal(ctx.cwd, params.action, jj, params.target);
```

**Step 4 — Re-run (expect PASS)**
Run: `bun test tests/tool-signal.test.ts --test-name-pattern "phase_next with target from feature"`

**Step 5 — Full suite**
Run: `bun test`
Expected: all tests pass.

---

### Task 4: Support `/phase <target>` command for backward transitions [depends: 2]

**Files**
- Modify: `extensions/megapowers/commands.ts`
- Create: `tests/commands-phase.test.ts`

**Step 1 — Write failing test**
Create `tests/commands-phase.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePhaseCommand, ensureDeps, type RuntimeDeps } from "../extensions/megapowers/commands.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

function seed(tmp: string, phase: any, workflow = "feature") {
  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow,
    phase,
    completedTasks: [1],
    megaEnabled: true,
  });
  const dir = join(tmp, ".megapowers", "plans", "001-test");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: Build\n");
}

function makeDeps(): any {
  return {
    jj: undefined,
    store: { listIssues: () => [] } as any,
    ui: { renderDashboard: () => {} } as any,
    pi: { getActiveTools: () => [], setActiveTools: () => {} } as any,
  };
}

describe("handlePhaseCommand with target", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "phase-cmd-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("/phase implement transitions code-review → implement", async () => {
    seed(tmp, "code-review");
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (m: string) => notices.push(m) } };

    await handlePhaseCommand("implement", ctx, makeDeps());
    expect(readState(tmp).phase).toBe("implement");
    expect(notices.some(n => n.includes("Phase advanced"))).toBe(true);
  });

  it("/phase plan transitions review → plan", async () => {
    seed(tmp, "review");
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (m: string) => notices.push(m) } };

    await handlePhaseCommand("plan", ctx, makeDeps());
    expect(readState(tmp).phase).toBe("plan");
  });

  it("/phase with no arg shows status (existing behavior preserved)", async () => {
    seed(tmp, "implement");
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (m: string) => notices.push(m) } };

    await handlePhaseCommand("", ctx, makeDeps());
    expect(notices.some(n => n.includes("Phase: implement"))).toBe(true);
  });

  it("/phase next still works (existing behavior preserved)", async () => {
    seed(tmp, "review");
    // review→implement requires reviewApproved
    writeState(tmp, { ...readState(tmp), reviewApproved: true });
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (m: string) => notices.push(m) } };

    await handlePhaseCommand("next", ctx, makeDeps());
    expect(readState(tmp).phase).toBe("implement");
  });
});
```

**Step 2 — Run test (expect FAIL)**
Run: `bun test tests/commands-phase.test.ts`
Expected fail: `/phase implement` falls through to the status branch (else clause), so `readState(tmp).phase` is still `"code-review"`. Assertion `expect(readState(tmp).phase).toBe("implement")` fails with `received: "code-review"`.

**Step 3 — Implement minimal change**
In `extensions/megapowers/commands.ts`, replace the `handlePhaseCommand` function:

```ts
export async function handlePhaseCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim().toLowerCase();

  if (sub === "next" || (sub !== "" && sub !== "status")) {
    // "next" uses default forward transition; any other non-empty string is a target phase
    const target = sub === "next" ? undefined : sub;
    const result = handleSignal(ctx.cwd, "phase_next", deps.jj, target);
    if (result.error) {
      if (ctx.hasUI) ctx.ui.notify(result.error, "error");
    } else {
      if (ctx.hasUI) {
        ctx.ui.notify(result.message ?? "Phase advanced.", "info");
        deps.ui.renderDashboard(ctx, readState(ctx.cwd), deps.store);
      }
    }
  } else {
    const state = readState(ctx.cwd);
    if (state.phase && state.workflow) {
      if (ctx.hasUI) {
        ctx.ui.notify(
          `Phase: ${state.phase}\nWorkflow: ${state.workflow}\nIssue: ${state.activeIssue ?? "none"}`,
          "info"
        );
      }
    } else {
      if (ctx.hasUI) ctx.ui.notify("No active workflow. Use /issue to start.", "info");
    }
  }
}
```

**Step 4 — Re-run (expect PASS)**
Run: `bun test tests/commands-phase.test.ts`

**Step 5 — Full suite**
Run: `bun test`
Expected: all tests pass.

---

### Task 5: Version artifact on second write (`.v1` backup) [depends: none]

**Files**
- Modify: `extensions/megapowers/tools/tool-artifact.ts`
- Modify: `tests/tool-artifact.test.ts`

**Step 1 — Write failing test**
Add to `tests/tool-artifact.test.ts` inside `describe("handleSaveArtifact", ...)`, in the `describe("happy path", ...)` block:
```ts
it("creates spec.v1.md backup when saving spec twice", () => {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
  handleSaveArtifact(tmp, "spec", "first version");
  handleSaveArtifact(tmp, "spec", "second version");

  const dir = join(tmp, ".megapowers", "plans", "001-test");
  expect(readFileSync(join(dir, "spec.md"), "utf-8")).toBe("second version");
  expect(readFileSync(join(dir, "spec.v1.md"), "utf-8")).toBe("first version");
});
```

**Step 2 — Run test (expect FAIL)**
Run: `bun test tests/tool-artifact.test.ts --test-name-pattern "creates spec.v1.md backup"`
Expected fail: `ENOENT: no such file or directory` for `spec.v1.md` — current code overwrites unconditionally with no backup.

**Step 3 — Implement minimal change**
Replace the write logic in `extensions/megapowers/tools/tool-artifact.ts`:

```ts
import { mkdirSync, writeFileSync, existsSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readState } from "../state/state-io.js";

export interface ArtifactResult {
  message?: string;
  error?: string;
}

export function handleSaveArtifact(cwd: string, phase: string, content: string): ArtifactResult {
  const state = readState(cwd);

  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  if (!state.activeIssue) {
    return { error: "No active issue. Use /issue to select or create one first." };
  }

  const dir = join(cwd, ".megapowers", "plans", state.activeIssue);
  mkdirSync(dir, { recursive: true });

  const filePath = join(dir, `${phase}.md`);

  // Version existing artifact before overwriting
  if (existsSync(filePath)) {
    const existing = readdirSync(dir);
    const versionPattern = new RegExp(`^${phase}\\.v(\\d+)\\.md$`);
    let maxVersion = 0;
    for (const f of existing) {
      const match = f.match(versionPattern);
      if (match) {
        const v = parseInt(match[1], 10);
        if (v > maxVersion) maxVersion = v;
      }
    }
    const nextVersion = maxVersion + 1;
    renameSync(filePath, join(dir, `${phase}.v${nextVersion}.md`));
  }

  writeFileSync(filePath, content);

  return { message: `Artifact saved: .megapowers/plans/${state.activeIssue}/${phase}.md` };
}
```

**Step 4 — Re-run (expect PASS)**
Run: `bun test tests/tool-artifact.test.ts --test-name-pattern "creates spec.v1.md backup"`

**Step 5 — Full suite**
Run: `bun test`
Expected: all tests pass.

---

### Task 6: Version artifact on repeated writes (`.v2`, `.v3`, ...) [depends: 5]

**Files**
- Modify: `tests/tool-artifact.test.ts`

Note: No production code change needed — Task 5's implementation already handles arbitrary version numbers via `readdirSync` + max scan. This task adds the test to confirm.

**Step 1 — Write failing test (expected to PASS immediately after Task 5)**
Add to `tests/tool-artifact.test.ts`:
```ts
it("creates sequential versions on repeated saves", () => {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
  handleSaveArtifact(tmp, "plan", "v1 content");
  handleSaveArtifact(tmp, "plan", "v2 content");
  handleSaveArtifact(tmp, "plan", "v3 content");

  const dir = join(tmp, ".megapowers", "plans", "001-test");
  expect(readFileSync(join(dir, "plan.md"), "utf-8")).toBe("v3 content");
  expect(readFileSync(join(dir, "plan.v1.md"), "utf-8")).toBe("v1 content");
  expect(readFileSync(join(dir, "plan.v2.md"), "utf-8")).toBe("v2 content");
});
```

**Step 2 — Run test**
Run: `bun test tests/tool-artifact.test.ts --test-name-pattern "creates sequential versions"`
Expected: PASS (Task 5 implementation handles this).

**Step 3 — No production code change needed**
Task 5's `readdirSync` + version scan already handles N overwrites.

**Step 4 — Confirm PASS**
Run: `bun test tests/tool-artifact.test.ts --test-name-pattern "creates sequential versions"`

**Step 5 — Full suite**
Run: `bun test`
Expected: all tests pass.

---

### Task 7: Regression verification for FC7 + FC8 [no-test] [depends: 1, 2, 3, 4, 5, 6]

**Justification**
Verification-only task: no production changes, confirms no regressions and #061 remains fixed.

**Files**
- No file edits expected.

**Step 1 — Run #084 regression file**
Run: `bun test tests/084-reproduce.test.ts`
Expected: PASS.

**Step 2 — Run #061 targeted guard (if named test exists)**
Run: `bun test tests/084-reproduce.test.ts --test-name-pattern "#061"`
Expected: PASS.

**Step 3 — Run full suite**
Run: `bun test`
Expected: all passing.

**Step 4 — Record results in verify artifact**
Capture pass counts and command outputs in `verify.md`.

**Step 5 — Confirm AC closure**
Mark FC7 and FC8 closed only if full suite and #061 regression pass.

---

## Dependency Graph

```
Task 1 (bugfix transitions)
  └→ Task 2 (plumb target) [depends: 1]
       ├→ Task 3 (schema change) [depends: 2]
       └→ Task 4 (command path) [depends: 2]

Task 5 (versioning v1)
  └→ Task 6 (versioning vN) [depends: 5]

Task 7 (regression) [depends: 1, 2, 3, 4, 5, 6]
```