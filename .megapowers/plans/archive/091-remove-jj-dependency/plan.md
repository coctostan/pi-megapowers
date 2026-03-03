# Plan

### Task 1: Remove task-level jj change helpers and task_done jj integration

### Task 1: Remove task-level jj change helpers and task_done jj integration
**Covers AC 9, AC 20 (tests updated to remove jj path)**

**Goal:** Remove `createTaskChange` / `inspectTaskChange` exports and remove `task_done`’s optional jj side-effects. This task must **not** require `MegapowersState` jj fields to be removed yet (that happens in Task 11).

#### Step 1 — Write the failing tests (self-contained)

In `tests/task-coordinator.test.ts`:
- Remove `createTaskChange, inspectTaskChange` from named imports.
- Remove `import type { JJ } from "../extensions/megapowers/jj.js";` if present.
- Add:

```ts
describe("task-coordinator jj removals", () => {
  it("does not export createTaskChange or inspectTaskChange", () => {
    expect((taskCoordinator as any).createTaskChange).toBeUndefined();
    expect((taskCoordinator as any).inspectTaskChange).toBeUndefined();
  });
});
```

In `tests/tool-signal.test.ts`:
- Remove `import type { JJ } from "../extensions/megapowers/jj.js";` if present.
- Delete any existing suite that asserts jj integration for `task_done`.
- Add:

```ts
describe("task_done without jj bookkeeping", () => {
  it("completes task using only state-machine fields", () => {
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
    setState(tmp, {
      phase: "implement",
      currentTaskIndex: 0,
      completedTasks: [],
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });

    const result = handleSignal(tmp, "task_done");
    expect(result.error).toBeUndefined();

    const state = readState(tmp);
    expect(state.completedTasks).toEqual([1]);
  });
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/task-coordinator.test.ts tests/tool-signal.test.ts`

Expected failure (from `tests/task-coordinator.test.ts`): the new assertions fail because `createTaskChange` / `inspectTaskChange` are still exported.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/task-coordinator.ts`:
1. Delete the `export function createTaskChange(...)` entirely.
2. Delete the `export async function inspectTaskChange(...)` entirely.
3. Keep unrelated exports intact.

In `extensions/megapowers/tools/tool-signal.ts`:
1. Remove imports of `createTaskChange` / `inspectTaskChange`.
2. Remove `import type { JJ } from "../jj.js";` if present.
3. In `handleTaskDone`, delete the entire optional jj async fire-and-forget block (`if (jj) { ... }`).
   - Also remove any variables that exist **only** to support that block.
   - **Do not** remove references to `state.taskJJChanges` in other unrelated branches in this file (those fields are removed later in Task 11).

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/task-coordinator.test.ts tests/tool-signal.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 2: Remove jj automation from phase-advance [depends: 1]

### Task 2: Remove jj automation from phase-advance [depends: 1]
**Covers AC 8**

#### Step 1 — Write failing tests

In `tests/phase-advance.test.ts`:
- Remove `import type { JJ } from "../extensions/megapowers/jj.js";` if present.
- Delete any suite dedicated to jj integration.
- Add a source-level guard + a minimal behavioral check:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("AC8: phase-advance has no jj import or jj parameter", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/policy/phase-advance.ts"), "utf-8");
  expect(source).not.toContain("from \"../jj.js\"");
  expect(source).not.toMatch(/advancePhase\([^)]*jj\??/);
});

it("AC8: advancePhase can still advance spec → plan without jj", () => {
  writeArtifact(tmp, "001-test", "spec.md", "# Spec\n\nNo open questions.\n");
  setState(tmp, {
    activeIssue: "001-test",
    workflow: "feature",
    phase: "spec",
  });

  const result = advancePhase(tmp);
  expect(result.ok).toBe(true);
  expect(result.newPhase).toBe("plan");
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/phase-advance.test.ts`

Expected failure: the source-level guard fails because `phase-advance.ts` still imports from `../jj.js` and/or includes a `jj` parameter.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/policy/phase-advance.ts`:
1. Delete `import { formatChangeDescription, type JJ } from "../jj.js";`.
2. Remove the `jj?: JJ` parameter from `advancePhase`.
3. Delete the entire `if (jj) { ... }` async fire-and-forget block that runs `jj describe/new/squash`.

In `extensions/megapowers/tools/tool-signal.ts`:
- Update `handlePhaseNext` and `handlePhaseBack` to call `advancePhase(cwd, ...)` **without** a jj argument.
- Keep `handleSignal`’s jj-parameter threading as-is for now; that’s removed in Task 6.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/phase-advance.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 3: Remove unused jj parameter from prompt injection path [depends: 2]

### Task 3: Remove unused jj parameter from prompt injection path [depends: 2]
**Covers AC 10**

#### Step 1 — Write failing tests

In `tests/prompt-inject.test.ts`, add a signature guard test (self-contained imports included):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("buildInjectedPrompt signature no longer includes _jj", () => {
  const source = readFileSync(
    join(process.cwd(), "extensions", "megapowers", "prompt-inject.ts"),
    "utf-8",
  );
  expect(source).not.toContain("_jj?:");
  expect(source).toContain("export function buildInjectedPrompt(cwd: string, store?: Store)");
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/prompt-inject.test.ts`

Expected failure: the test fails because `_jj?:` is still present in `buildInjectedPrompt`.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/prompt-inject.ts`:
1. Delete: `import type { JJ } from "./jj.js";`
2. Change signature from:
   - `export function buildInjectedPrompt(cwd: string, store?: Store, _jj?: JJ): string | null {`
   to:
   - `export function buildInjectedPrompt(cwd: string, store?: Store): string | null {`

In `extensions/megapowers/hooks.ts`:
- In `onBeforeAgentStart`, remove `jj` from deps destructure and call `buildInjectedPrompt(ctx.cwd, store)`.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/prompt-inject.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 4: Remove jj from UI issue/triage flows and command deps [depends: 3]

### Task 4: Remove jj from UI issue/triage flows and command deps [depends: 3]
**Covers AC 5, AC 6**

> Note: This task is intentionally limited to *UI rendering + command dependency wiring* only. `handleSignal` jj-parameter removal is handled in Task 6 to avoid overlap.

#### Step 1 — Write failing tests

In `tests/ui.test.ts` add:

```ts
it("renderDashboardLines does not show jj line", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature" as const,
    phase: "implement" as const,
  };
  const lines = renderDashboardLines(state, [], plainTheme as any, []);
  expect(lines.join("\n")).not.toContain("jj:");
});

it("getDoneChecklistItems never includes squash-task-changes", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature" as const,
    phase: "done" as const,
  };
  expect(getDoneChecklistItems(state).map((i) => i.key)).not.toContain("squash-task-changes");
});
```

In `tests/commands-phase.test.ts` add:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("commands.ts no longer references createJJ or deps.jj", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/commands.ts"), "utf-8");
  expect(source).not.toContain("createJJ");
  expect(source).not.toContain("deps.jj");
});
```

Also, in `tests/ui.test.ts`, remove any `createMockJJ()` usage in calls to issue/triage handlers (delete the jj arg entirely).

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/ui.test.ts tests/commands-phase.test.ts`

Expected failures:
- UI test fails because the dashboard still prints `jj:`.
- commands test fails because `commands.ts` still imports `createJJ` and/or references `deps.jj`.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/ui.ts`:
1. Remove jj-related imports (`JJ`, `formatChangeDescription`).
2. Remove any `jj:` dashboard line rendering.
3. Remove `squash-task-changes` from done checklist items.
4. Update `handleIssueCommand` and `handleTriageCommand` signatures/implementation to **not** accept `jj`.
5. Remove any `if (await jj.isJJRepo()) { ... }` blocks inside those handlers.

In `extensions/megapowers/commands.ts`:
1. Remove `import { createJJ, type JJ } from "./jj.js";`.
2. Remove jj from deps types:

```ts
export type RuntimeDeps = { store?: Store; ui?: MegapowersUI };
export type Deps = { pi: ExtensionAPI; store: Store; ui: MegapowersUI };
```

3. Update `ensureDeps` to no longer create jj.
4. Update issue/triage command wiring to call UI without jj:
   - `deps.ui.handleIssueCommand(ctx, state, deps.store, args)`
   - `deps.ui.handleTriageCommand(ctx, state, deps.store, args)`

(Do not change `handleSignal` call signatures here; Task 6 removes jj threading.)

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/ui.test.ts tests/commands-phase.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 5: Remove session-start jj checks and notifications [depends: 4]

### Task 5: Remove session-start jj checks and notifications [depends: 4]
**Covers AC 4**

#### Step 1 — Write failing tests

In `tests/hooks.test.ts`, add:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("hooks.ts no longer imports jj availability helpers/messages", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/hooks.ts"), "utf-8");
  expect(source).not.toContain("checkJJAvailability");
  expect(source).not.toContain("JJ_INSTALL_MESSAGE");
  expect(source).not.toContain("JJ_INIT_MESSAGE");
});
```

In `tests/index-integration.test.ts`, replace any jj-availability/session-start assertions with this explicit test:

```ts
it("onSessionStart does not require jj and still renders dashboard", async () => {
  // Arrange deps with store+ui only
  const ui = createUI();
  const store = createStore(tmp);

  // Ensure state exists and megaEnabled is false so we verify reset-to-true behavior
  writeState(tmp, { ...createInitialState(), megaEnabled: false, activeIssue: null });

  // Call session start
  await onSessionStart({} as any, { cwd: tmp, hasUI: true } as any, { store, ui } as any);

  const state = readState(tmp);
  expect(state.megaEnabled).toBe(true);
});
```

In `tests/reproduce-086-bugs.test.ts`, remove `jj: null` from any deps helper (e.g. `makeDeps`) and from call sites.

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/hooks.test.ts tests/index-integration.test.ts tests/reproduce-086-bugs.test.ts`

Expected failure: `tests/hooks.test.ts` fails because `hooks.ts` still imports `checkJJAvailability` / jj messages.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/hooks.ts`:
1. Remove imports:
   - `checkJJAvailability` from `./jj.js`
   - `JJ_INSTALL_MESSAGE`, `JJ_INIT_MESSAGE` from `./jj-messages.js`
2. In `onSessionStart`, remove any logic that checks jj availability or detects jj change ID mismatches.
3. Keep the existing behavior of reading state from disk, resetting `megaEnabled` to true on session start, and rendering the dashboard when `ctx.hasUI`.

Update tests/fixtures:
- Remove `jj` from deps objects in the tests modified above.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/hooks.test.ts tests/index-integration.test.ts tests/reproduce-086-bugs.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 6: Drop jj parameter threading from signal handling and tool wiring [depends: 5]

### Task 6: Drop jj parameter threading from signal handling and tool wiring [depends: 5]
**Covers AC 7**

#### Step 1 — Write failing tests

In `tests/tool-signal.test.ts`:
- Remove any `JJ` type imports.
- Update any calls that pass a jj argument to `handleSignal` to match the new signature.
- Add wiring assertions:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("handleSignal signature has no jj parameter", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/tools/tool-signal.ts"), "utf-8");
  expect(source).not.toContain("jj?:");
  expect(source).toContain("export function handleSignal(");
});

it("register-tools wires handleSignal without jj", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
  expect(source).toContain("handleSignal(ctx.cwd, params.action, params.target)");
  expect(source).not.toContain("handleSignal(ctx.cwd, params.action, jj");
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/tool-signal.test.ts`

Expected failure: the signature assertion fails because `handleSignal` still mentions `jj`.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/tools/tool-signal.ts`:
1. Remove `import type { JJ } from "../jj.js";`.
2. Change signature to:

```ts
export function handleSignal(
  cwd: string,
  action: "task_done" | "review_approve" | "phase_next" | "phase_back" | "tests_failed" | "tests_passed" | "plan_draft_done" | string,
  target?: string,
): SignalResult {
```

3. Update switch dispatch to call helpers without jj.
4. Update helper signatures accordingly:
   - `handleTaskDone(cwd)`
   - `handlePhaseNext(cwd, target?)`
   - `handlePhaseBack(cwd)`

In `extensions/megapowers/register-tools.ts`:
- In the `megapowers_signal` tool execute block, call:
  - `handleSignal(ctx.cwd, params.action, params.target)`

In `extensions/megapowers/commands.ts`:
- Update all `handleSignal` call sites to drop the jj argument.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/tool-signal.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 7: Switch register-tools subagent/pipeline executors from jj to git [depends: 6]

### Task 7: Switch register-tools subagent/pipeline executors from jj to git [depends: 6]
**Covers AC 11**

> Important: AC13 defines `ExecGit` in `pipeline-workspace.ts`. This task only changes tool wiring to use `git` as the executor command.

#### Step 1 — Write failing tests

In `tests/register-tools.test.ts`, add:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("register-tools uses git exec for subagent and pipeline tools", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
  expect(source).toContain('pi.exec("git"');
  expect(source).not.toContain('pi.exec("jj"');
  expect(source).toContain("isolated workspace");
  expect(source).not.toContain("isolated jj workspace");
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/register-tools.test.ts`

Expected failure: it still contains `pi.exec("jj"`.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/register-tools.ts`:
1. Replace any `execJJ` lambdas with `execGit` that calls `pi.exec("git", ...)`.
2. Keep the executor signature compatible with AC13 by using `git -C <cwd>` when a working directory is needed by callers.
   - Example pattern:

```ts
const execGit = async (args: string[]) => {
  const r = await pi.exec("git", args);
  if (r.code !== 0) throw new Error(`git ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
  return { stdout: r.stdout, stderr: r.stderr };
};

// When you need cwd, include -C:
// execGit(["-C", somePath, "worktree", "add", "--detach", ...])
```

3. Update tool descriptions to remove “jj workspace” wording.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/register-tools.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 8: Rewrite pipeline-workspace.ts to git worktree with patch squash [depends: 7]

### Task 8: Rewrite pipeline-workspace.ts to git worktree with patch squash [depends: 7]
**Covers AC 13–18, AC 21**

#### Step 1 — Write failing tests

Replace `tests/pipeline-workspace.test.ts` entirely with:

```ts
import { describe, it, expect } from "bun:test";
import {
  pipelineWorkspaceName,
  pipelineWorkspacePath,
  createPipelineWorkspace,
  squashPipelineWorkspace,
  cleanupPipelineWorkspace,
  getWorkspaceDiff,
  type ExecGit,
} from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("pipeline-workspace (git worktree)", () => {
  it("pipelineWorkspaceName returns mega-prefixed name", () => {
    expect(pipelineWorkspaceName("pipe-1")).toBe("mega-pipe-1");
  });

  it("AC21: workspace path is .megapowers/workspaces/<pipelineId>", () => {
    expect(pipelineWorkspacePath("/project", "pipe-1")).toBe("/project/.megapowers/workspaces/pipe-1");
  });

  it("AC14: createPipelineWorkspace calls git worktree add --detach", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.workspacePath).toBe("/project/.megapowers/workspaces/pipe-1");
    expect(r.workspaceName).toBe("mega-pipe-1");
    expect((r as any).error).toBeUndefined();

    expect(calls.some((a) => a.includes("worktree") && a.includes("add") && a.includes("--detach"))).toBe(true);
  });

  it("AC15: squash stages+diffs in worktree and applies in project root", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("diff") && args.includes("--cached")) return { stdout: "diff --git a/a.ts b/a.ts\n+x", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect((r as any).error).toBeUndefined();

    // stage in worktree
    expect(calls).toContainEqual(["-C", "/project/.megapowers/workspaces/pipe-1", "add", "-A"]);
    // diff in worktree
    expect(calls).toContainEqual(["-C", "/project/.megapowers/workspaces/pipe-1", "diff", "--cached", "HEAD"]);
    // apply in root
    expect(calls.some((a) => a[0] === "apply")).toBe(true);
  });

  it("AC16: preserves worktree on squash failure (apply throws)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("diff") && args.includes("--cached")) return { stdout: "diff content", stderr: "" };
      if (args[0] === "apply") throw new Error("git apply failed");
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect((r as any).error).toBeDefined();
    expect(String((r as any).error)).toContain("apply");

    // no worktree remove on failure
    expect(calls.some((a) => a.includes("worktree") && a.includes("remove"))).toBe(false);
  });

  it("AC17: cleanupPipelineWorkspace calls git worktree remove --force", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execGit);
    expect((r as any).error).toBeUndefined();

    expect(calls).toContainEqual(["-C", "/project", "worktree", "remove", "--force", "/project/.megapowers/workspaces/pipe-1"]);
  });

  it("AC18: getWorkspaceDiff stages changes before diffing", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("--stat")) return { stdout: "a.ts | 1 +\n", stderr: "" };
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "full diff", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await getWorkspaceDiff("/ws", execGit);
    expect(result.diff).toBe("full diff");

    const addIdx = calls.findIndex((a) => a[0] === "-C" && a[1] === "/ws" && a[2] === "add");
    const statIdx = calls.findIndex((a) => a.includes("--stat"));
    const diffIdx = calls.findIndex((a) => a.includes("diff") && a.includes("--cached") && !a.includes("--stat"));
    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(statIdx).toBeGreaterThan(addIdx);
    expect(diffIdx).toBeGreaterThan(statIdx);
  });
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/pipeline-workspace.test.ts`

Expected failure: module still exports `ExecJJ` and uses jj workspace commands.

#### Step 3 — Implement (full code)

Replace `extensions/megapowers/subagent/pipeline-workspace.ts` with a compiling git-worktree implementation:

```ts
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

// AC13
export type ExecGit = (args: string[]) => Promise<{ stdout: string; stderr: string }>;

export function pipelineWorkspaceName(pipelineId: string): string {
  return `mega-${pipelineId}`;
}

// AC21
export function pipelineWorkspacePath(projectRoot: string, pipelineId: string): string {
  return join(projectRoot, ".megapowers", "workspaces", pipelineId);
}

function inDir(cwd: string, args: string[]): string[] {
  // Use git's -C option so ExecGit stays args-only (AC13)
  return ["-C", cwd, ...args];
}

// AC14
export async function createPipelineWorkspace(projectRoot: string, pipelineId: string, execGit: ExecGit) {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  mkdirSync(join(projectRoot, ".megapowers", "workspaces"), { recursive: true });

  try {
    await execGit(inDir(projectRoot, ["worktree", "add", "--detach", workspacePath]));
    return { workspaceName, workspacePath };
  } catch (err: any) {
    return { workspaceName, workspacePath, error: err?.message ?? "git worktree add failed" };
  }
}

// AC15 + AC16
export async function squashPipelineWorkspace(projectRoot: string, pipelineId: string, execGit: ExecGit) {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    await execGit(inDir(workspacePath, ["add", "-A"]));
    const diff = await execGit(inDir(workspacePath, ["diff", "--cached", "HEAD"]));

    if (!diff.stdout.trim()) {
      // nothing to apply; remove worktree
      try {
        await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
      } catch {
        // ignore cleanup failure
      }
      return {};
    }

    const patchPath = join(tmpdir(), `mega-squash-${pipelineId}.patch`);
    writeFileSync(patchPath, diff.stdout);

    // apply in main working directory (AC15)
    await execGit(["apply", "--allow-empty", patchPath]);

    // remove worktree after successful apply
    try {
      await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    } catch {
      // ignore cleanup failure
    }

    return {};
  } catch (err: any) {
    // AC16: preserve worktree for inspection on failure
    return { error: err?.message ?? "git squash failed" };
  }
}

// AC17
export async function cleanupPipelineWorkspace(projectRoot: string, pipelineId: string, execGit: ExecGit) {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    return {};
  } catch (err: any) {
    return { error: err?.message ?? "git worktree remove failed" };
  }
}

function parseSummaryFiles(summary: string): string[] {
  // git diff --stat output is lines like: "path/to/file | 3 ++-"
  return summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("|")[0].trim())
    .filter(Boolean);
}

// AC18
export async function getWorkspaceDiff(
  workspaceCwd: string,
  execGit: ExecGit,
): Promise<{ filesChanged: string[]; diff: string }> {
  await execGit(inDir(workspaceCwd, ["add", "-A"]));
  const stat = await execGit(inDir(workspaceCwd, ["diff", "--cached", "HEAD", "--stat"]));
  const full = await execGit(inDir(workspaceCwd, ["diff", "--cached", "HEAD"]));

  return {
    filesChanged: parseSummaryFiles(stat.stdout),
    diff: full.stdout,
  };
}
```

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/pipeline-workspace.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 9: Migrate pipeline runner/tool/oneshot to ExecGit [depends: 8]

### Task 9: Migrate pipeline runner/tool/oneshot to ExecGit [depends: 8]
**Covers AC 19**

#### Step 1 — Write failing tests

In `tests/pipeline-tool.test.ts`:
- Rename all existing mocks/types `ExecJJ` → `ExecGit` and `execJJ` → `execGit`.
- Add a behavioral failure-propagation test:

```ts
import { type ExecGit } from "../extensions/megapowers/subagent/pipeline-workspace.js";

it("handlePipelineTool accepts ExecGit and surfaces workspace creation failure", async () => {
  const execGit: ExecGit = async (args) => {
    if (args.includes("worktree") && args.includes("add")) throw new Error("git worktree failed (exit 128)");
    return { stdout: "", stderr: "" };
  };

  const result = await handlePipelineTool(tmp, validInput, mockDispatcher, execGit);
  expect(result.error).toBeDefined();
});
```

In `tests/pipeline-runner.test.ts` and `tests/oneshot-tool.test.ts`:
- Rename `ExecJJ` → `ExecGit` and `execJJ` → `execGit` consistently.

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/pipeline-runner.test.ts tests/pipeline-tool.test.ts tests/oneshot-tool.test.ts`

Expected failure: TypeScript/runtime import errors because production code still references `ExecJJ` / expects an `execJJ` injected executor.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/subagent/pipeline-runner.ts`:
- Import `ExecGit` from `./pipeline-workspace.js` and rename the option to `execGit`.

In `extensions/megapowers/subagent/pipeline-tool.ts`:
- Replace all `ExecJJ`/`execJJ` usage with `ExecGit`/`execGit`.
- Ensure calls to workspace helpers pass `execGit`.

In `extensions/megapowers/subagent/oneshot-tool.ts`:
- Same migration: `ExecGit`/`execGit`.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/pipeline-runner.test.ts tests/pipeline-tool.test.ts tests/oneshot-tool.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 10: Update remaining workspace-related tests and comments for git worktrees [depends: 9]

### Task 10: Update remaining workspace-related tests and comments for git worktrees [depends: 9]
**Covers AC 12 (no remaining jj imports/usages), AC 20 (tests updated)**

#### Step 1 — Write failing tests

In `tests/pipeline-diff.test.ts`:
- Rename `ExecJJ` → `ExecGit` and `execJJ` → `execGit`.
- Update mock call expectations to the staged git flow:
  - `git -C <ws> add -A`
  - `git -C <ws> diff --cached HEAD --stat`
  - `git -C <ws> diff --cached HEAD`

Add/adjust a test like:

```ts
import { type ExecGit } from "../extensions/megapowers/subagent/pipeline-workspace.js";

it("getWorkspaceDiff stages changes before diffing", async () => {
  const calls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    calls.push(args);
    if (args.includes("--stat")) return { stdout: "a.ts | 2 ++\n", stderr: "" };
    if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "patch content", stderr: "" };
    return { stdout: "", stderr: "" };
  };

  const result = await getWorkspaceDiff("/ws", execGit);
  expect(result.diff).toBe("patch content");

  const addIdx = calls.findIndex((c) => c[0] === "-C" && c[1] === "/ws" && c[2] === "add");
  const statIdx = calls.findIndex((c) => c.includes("--stat"));
  const diffIdx = calls.findIndex((c) => c.includes("diff") && c.includes("--cached") && !c.includes("--stat"));
  expect(addIdx).toBeGreaterThanOrEqual(0);
  expect(statIdx).toBeGreaterThan(addIdx);
  expect(diffIdx).toBeGreaterThan(statIdx);
});
```

In `tests/satellite.test.ts`, add a simple wording guard (source-level is fine for doc comments):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("dispatcher.ts does not mention jj workspace", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/subagent/dispatcher.ts"), "utf-8");
  expect(source).not.toContain("jj workspace");
});
```

In `tests/reproduce-086-bugs.test.ts`:
- Replace any `jj workspace add` mock expectations with git worktree expectations.
- Assert that a call includes `"worktree", "add"` and `"--detach"` and that the path includes `.megapowers/workspaces/`.

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/pipeline-diff.test.ts tests/reproduce-086-bugs.test.ts tests/satellite.test.ts`

Expected failure: wording/test expectations still reference jj and/or old command shapes.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/subagent/dispatcher.ts` and `extensions/megapowers/satellite.ts`:
- Replace any “jj workspace” wording in comments/docs with “git worktree” or “isolated workspace”.

Update the three test files as described in Step 1.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/pipeline-diff.test.ts tests/reproduce-086-bugs.test.ts tests/satellite.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.

### Task 11: Remove jj fields from state-machine and state-io [depends: 10]

### Task 11: Remove jj fields from state-machine and state-io [depends: 10]
**Covers AC 2, AC 3**

**Step 1 — Write failing tests**

In `tests/state-machine.test.ts` (imports `createInitialState` already exist):

```ts
it("createInitialState has no jj fields", () => {
  const state = createInitialState();
  expect("jjChangeId" in state).toBe(false);
  expect("taskJJChanges" in state).toBe(false);
});
```

In `tests/state-io.test.ts` (imports `mkdirSync`, `writeFileSync`, `join`, `readState`, `createInitialState` already exist; `tmp` is the test fixture dir):

```ts
it("AC3: drops legacy jj keys when reading state.json (silently ignored on read)", () => {
  const dir = join(tmp, ".megapowers");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    ...createInitialState(),
    jjChangeId: "x",
    taskJJChanges: { 1: "y" },
  }));
  const state = readState(tmp);
  expect("jjChangeId" in state).toBe(false);
  expect("taskJJChanges" in state).toBe(false);
});

it("AC3: write then read round-trip has no jj fields", () => {
  writeState(tmp, createInitialState());
  const raw = JSON.parse(readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8"));
  expect("jjChangeId" in raw).toBe(false);
  expect("taskJJChanges" in raw).toBe(false);
});
```

**Step 2 — Run tests, verify RED**

Run:
- `bun test tests/state-machine.test.ts tests/state-io.test.ts`

Expected failure message from `tests/state-machine.test.ts`:
```
expect(received).toBe(expected)
Expected: false
Received: true
```
because `createInitialState()` still includes `jjChangeId: null` and `taskJJChanges: {}`.

**Step 3 — Implement (full code)**

In `extensions/megapowers/state/state-machine.ts`:

1. Remove from `MegapowersState` interface:
   ```ts
   // DELETE these two lines:
   taskJJChanges: Record<number, string>;
   jjChangeId: string | null;
   ```

2. Remove from `PhaseTransition` interface:
   ```ts
   // DELETE:
   jjChangeId?: string;
   ```

3. Remove from `createInitialState()` return:
   ```ts
   // DELETE these two lines:
   taskJJChanges: {},
   jjChangeId: null,
   ```

4. Remove `taskJJChanges` reset in `transition()` (two occurrences):
   ```ts
   // DELETE:
   if (to === "implement" && tasks) {
     ...
     next.taskJJChanges = {};  // Remove this line
   } else if (to === "implement") {
     next.taskJJChanges = {};  // Remove this line
   }
   ```
In `extensions/megapowers/state/state-io.ts`:
- Remove `"taskJJChanges"` and `"jjChangeId"` from `KNOWN_KEYS` set. This ensures:
  - Read: legacy keys in JSON are silently ignored (not picked into state)
  - Write: since the fields don't exist in the state object, they're not written

Update test fixtures in `tests/state-machine.test.ts` and `tests/state-io.test.ts` to stop constructing `taskJJChanges` and `jjChangeId` fields.

**Step 4 — Run targeted tests, verify GREEN**

Run:
- `bun test tests/state-machine.test.ts tests/state-io.test.ts`

Expected: PASS.

**Step 5 — Full regression**

Run:
- `bun test`
Expected: PASS.

### Task 12: Delete jj modules and jj-specific tests [depends: 11]

### Task 12: Delete jj modules and jj-specific tests [depends: 11]
**Covers AC 1, AC 12**

**Step 1 — Write failing tests**

In `tests/index-integration.test.ts` (add `existsSync` import if not present):

```ts
import { existsSync } from "node:fs";
it("jj module files are removed", () => {
  expect(existsSync("extensions/megapowers/jj.ts")).toBe(false);
  expect(existsSync("extensions/megapowers/jj-messages.ts")).toBe(false);
});

it("jj test file is removed", () => {
  expect(existsSync("tests/jj.test.ts")).toBe(false);
});
```

Also remove old jj-availability assertions in this file (obsolete after Task 5).

**Step 2 — Run tests, verify RED**

Run:
- `bun test tests/index-integration.test.ts`

Expected failure message:
```
expect(received).toBe(expected)
Expected: false
Received: true
```
because `extensions/megapowers/jj.ts` still exists on disk.

**Step 3 — Implement (full code)**

1. Delete these files (use `rm` or equivalent):
   - `extensions/megapowers/jj.ts`
   - `extensions/megapowers/jj-messages.ts`
- `tests/jj.test.ts`
2. Verify no remaining imports reference the deleted modules:
   ```bash
   grep -R 'from.*["./]jj[".]' extensions/megapowers tests --include='*.ts'
   ```
   Expected: no matches (all imports were removed in Tasks 1–11).

3. Ensure no index/barrel file re-exports from the deleted modules.

**Step 4 — Run targeted tests, verify GREEN**

Run:
- `bun test tests/index-integration.test.ts`

Expected: PASS.

**Step 5 — Full regression**

Run:
- `bun test`
Expected: PASS.

### Task 13: Final code/test sweep for residual jj symbols [no-test] [depends: 12]

### Task 13: Final code/test sweep for residual jj symbols [no-test] [depends: 12]

**Covers AC 12, AC 20**

**Justification for [no-test]:** This is a verification-only sweep task. It doesn't introduce new behavior — it cleans up any stale jj references that slipped through earlier tasks. The verification is done via grep commands and full test suite run, not a new test.

**Step 1 — Identify residuals**

Run:
```bash
grep -R "\bJJ\b\|ExecJJ\|jjChangeId\|taskJJChanges\|createJJ\|jj-messages\|jj\.ts" extensions/megapowers tests --include='*.ts'
```

Any matches in production code or test files (excluding `.megapowers/` plan artifacts) are residuals to fix.

**Step 2 — Apply exact cleanup edits**

For each file with residual matches:

- `tests/tool-signal.test.ts`: remove any remaining `JJ` imports/typed mocks; update `handleSignal` call assertions
- `tests/hooks.test.ts`: deps helper should contain only `{ store, ui }` (no `jj` field)
- `tests/reproduce-086-bugs.test.ts`: deps helper should contain only `{ store, ui }` (no `jj` field)
- `tests/pipeline-diff.test.ts`: rename `ExecJJ`/`execJJ` → `ExecGit`/`execGit`; update diff command assertions
- `tests/index-integration.test.ts`: remove stale jj-availability/jj-message assertions

**Step 3 — Verify**

Run:
```bash
grep -R "\bJJ\b\|ExecJJ\|jjChangeId\|taskJJChanges\|createJJ\|jj-messages" extensions/megapowers tests --include='*.ts'
```
Expected: no matches.

Run:
- `bun test`
Expected: full test suite passes.

### Task 14: Update AGENTS.md and prompt files to remove jj references [no-test] [depends: 13]

### Task 14: Update AGENTS.md and prompt files to remove jj references [no-test] [depends: 13]

**Justification:** Docs/prompt wording only.

**Step 1 — Apply exact doc/prompt edits**

Update `AGENTS.md`:
- `pipeline` and `subagent` descriptions: replace "isolated jj workspace" with "isolated git worktree" / "isolated workspace"
- remove "Async jj fire-and-forget" known issue entry
- ensure any remaining VCS guidance references git, not jj

Update prompt files (exact paths):
- `prompts/brainstorm.md`
- `prompts/megapowers-protocol.md`
- `prompts/implement-task.md`
- `prompts/done.md`
- `prompts/capture-learnings.md`
- `prompts/generate-docs.md`
- `prompts/generate-bugfix-summary.md`
- `prompts/code-review.md`

Required wording changes:
- remove jj-as-required-VCS language
- replace "jj workspace" with "git worktree" or neutral "isolated workspace"
- where prompts mention diff commands, keep `git diff` guidance (drop `jj diff` references)

**Step 2 — Verify**

Run:

```bash
grep -R "\bjj\b\|Jujutsu" AGENTS.md prompts --include="*.md"
```

Expected: no jj/Jujutsu references in these top-level docs/prompts.

Then run:
- `bun test`

Expected: PASS.
