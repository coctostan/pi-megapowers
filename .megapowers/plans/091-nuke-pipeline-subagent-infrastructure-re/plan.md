# Plan

### Task 1: Remove legacy pipeline and subagent tool registration

### Task 1: Remove legacy pipeline and subagent tool registration

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/register-tools.test.ts`

**Step 1 — Write the failing test**
Replace `tests/register-tools.test.ts` with:

```ts
import { describe, it, expect } from "bun:test";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("registerTools — legacy tool removal", () => {
  it("registers plan loop tools without pipeline or subagent", () => {
    const tools: Record<string, any> = {};

    const pi = {
      registerTool: (tool: any) => {
        tools[tool.name] = tool;
      },
    } as any;

    registerTools(pi, {} as any);

    expect(Object.keys(tools)).toContain("megapowers_signal");
    expect(Object.keys(tools)).toContain("megapowers_plan_task");
    expect(Object.keys(tools)).toContain("megapowers_plan_review");
    expect(Object.keys(tools)).not.toContain("pipeline");
    expect(Object.keys(tools)).not.toContain("subagent");
  });

  it("megapowers_signal still exposes plan_draft_done", () => {
    const tools: Record<string, any> = {};

    const pi = {
      registerTool: (tool: any) => {
        tools[tool.name] = tool;
      },
    } as any;

    registerTools(pi, {} as any);

    const signalParams = JSON.stringify(tools.megapowers_signal.parameters);
    expect(signalParams).toContain("plan_draft_done");
  });

  it("register-tools source no longer imports or wires legacy pipeline/subagent handlers", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");

    expect(source).not.toContain("handleOneshotTool");
    expect(source).not.toContain("handlePipelineTool");
    expect(source).not.toContain("PiSubagentsDispatcher");
    expect(source).not.toContain('name: "pipeline"');
    expect(source).not.toContain('name: "subagent"');
    expect(source).not.toContain("renderPipelineCall");
    expect(source).not.toContain("renderPipelineResult");
  });

  it("plan_draft_done wiring still calls handlePlanDraftDone directly", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");

    expect(source).toContain("result = await handlePlanDraftDone(ctx.cwd);");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts`
Expected: FAIL — `expect(received).not.toContain(expected)` fails because `pipeline`, `subagent`, and legacy handler imports are still present in `extensions/megapowers/register-tools.ts`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/register-tools.ts`:

1. Remove these imports entirely:

```ts
import { handleOneshotTool } from "./subagent/oneshot-tool.js";
import { PiSubagentsDispatcher } from "./subagent/pi-subagents-dispatcher.js";
import { handlePipelineTool } from "./subagent/pipeline-tool.js";
import { buildPipelineDetails, renderPipelineCall, renderPipelineResult } from "./subagent/pipeline-renderer.js";
import type { PipelineProgressEvent } from "./subagent/pipeline-renderer.js";
```

2. Delete the entire `// --- Tools: subagent ---` registration block.
3. Delete the entire `// --- Tools: pipeline ---` registration block.
4. Leave the existing `megapowers_signal`, `megapowers_plan_task`, `megapowers_plan_review`, `create_issue`, and `create_batch` registrations unchanged.

The tail of `registerTools()` should end immediately after the `create_batch` tool registration:

```ts
  pi.registerTool({
    name: "create_batch",
    label: "Create Batch Issue",
    description: "Create a batch issue grouping source issues.",
    parameters: Type.Object({
      title: Type.String(),
      type: StringEnum(["bugfix", "feature"] as const),
      sourceIds: Type.Array(Type.Number()),
      description: Type.String(),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { store } = ensureDeps(runtimeDeps, pi, ctx.cwd);
      const result = createBatchHandler(store, params);
      if ("error" in result) {
        return { content: [{ type: "text", text: result.error }], details: undefined };
      }
      return {
        content: [{ type: "text", text: `Created batch: ${result.slug} (id: ${result.id})` }],
        details: undefined,
      };
    },
  });
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Remove legacy tool names from mega on/off activation lists [depends: 1]

### Task 2: Remove legacy tool names from mega on/off activation lists [depends: 1]

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Modify: `tests/mp-on-off.test.ts`
- Test: `tests/commands-tools-filter.test.ts`

**Step 1 — Write the failing test**
Replace `tests/commands-tools-filter.test.ts` with:

```ts
import { describe, it, expect } from "bun:test";

describe("commands tool filtering", () => {
  it("/mega off/on only toggles megapowers_signal after legacy tool removal", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const src = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "commands.ts"), "utf-8");

    expect(src).not.toContain('"pipeline"');
    expect(src).not.toContain('"subagent"');
    expect(src).toContain('t !== "megapowers_signal"');
    expect(src).toContain('const toolsToAdd = ["megapowers_signal"]');
  });
});
```

Update `tests/mp-on-off.test.ts` so its expectations are:

```ts
expect(pi.getActiveTools()).not.toContain("megapowers_signal");
expect(pi.getActiveTools()).not.toContain("pipeline");
expect(pi.getActiveTools()).not.toContain("subagent");
```

for `/mp off`, and:

```ts
expect(pi.getActiveTools()).toContain("megapowers_signal");
expect(pi.getActiveTools()).not.toContain("pipeline");
expect(pi.getActiveTools()).not.toContain("subagent");
```

for `/mp on`.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-on-off.test.ts tests/commands-tools-filter.test.ts`
Expected: FAIL — assertions fail because `extensions/megapowers/commands.ts` still filters and restores `subagent` and `pipeline`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/commands.ts`, change `handleMegaCommand()` so it only hides/restores `megapowers_signal`:

```ts
  if (sub === "off") {
    const state = readState(ctx.cwd);
    writeState(ctx.cwd, { ...state, megaEnabled: false });
    const activeTools = deps.pi.getActiveTools().filter(
      (t: string) => t !== "megapowers_signal"
    );
    deps.pi.setActiveTools(activeTools);
    if (ctx.hasUI) ctx.ui.notify("Megapowers OFF — all enforcement disabled.", "info");
    return;
  }

  if (sub === "on") {
    const state = readState(ctx.cwd);
    writeState(ctx.cwd, { ...state, megaEnabled: true });
    const activeTools = deps.pi.getActiveTools();
    const toolsToAdd = ["megapowers_signal"];
    const missing = toolsToAdd.filter((t: string) => !activeTools.includes(t));
    if (missing.length > 0) {
      deps.pi.setActiveTools([...activeTools, ...missing]);
    }
    if (ctx.hasUI) ctx.ui.notify("Megapowers ON — enforcement restored.", "info");
    return;
  }
```

In `tests/mp-on-off.test.ts`, update the mock's starting tool list to keep the legacy names out of the restored expectations:

```ts
function makeMockPi() {
  let active = ["megapowers_signal", "other"];
  return {
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => {
      active = names;
    },
    sendUserMessage: (_c: any, _o?: any) => {},
  } as any;
}
```

Then update the `/mp on` and `/mp off` assertions to match the new expectations from Step 1.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-on-off.test.ts tests/commands-tools-filter.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Remove satellite bootstrap from the extension entrypoint [depends: 1, 2]

### Task 3: Remove satellite bootstrap from the extension entrypoint [depends: 1, 2]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Modify: `tests/index-integration.test.ts`
- Test: `tests/satellite-root.test.ts`

**Step 1 — Write the failing test**
Replace the `satellite TDD flow invariants` block in `tests/index-integration.test.ts` with:

```ts
describe("extension bootstrap after legacy pipeline removal", () => {
  it("index.ts does not import or branch on satellite mode", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).not.toContain("isSatelliteMode");
    expect(source).not.toContain("setupSatellite");
    expect(source).not.toContain("if (satellite)");
  });
});
```

Replace the body of `tests/satellite-root.test.ts` with:

```ts
import { describe, it, expect } from "bun:test";

describe("legacy satellite bootstrap removal", () => {
  it("index.ts no longer imports the satellite helper", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const source = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "index.ts"), "utf-8");

    expect(source).not.toContain("./satellite.js");
    expect(source).not.toContain("isSatelliteMode");
    expect(source).not.toContain("setupSatellite");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/index-integration.test.ts tests/satellite-root.test.ts`
Expected: FAIL — assertions fail because `extensions/megapowers/index.ts` still imports `./satellite.js` and still returns early from the satellite branch.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/index.ts`:

1. Remove this import:

```ts
import { isSatelliteMode, setupSatellite } from "./satellite.js";
```

2. Delete the entire satellite bootstrap block at the top of `megapowers()`:

```ts
  const satellite = isSatelliteMode({
    isTTY: process.stdout.isTTY,
    env: process.env as Record<string, string | undefined>,
  });

  if (satellite) {
    setupSatellite(pi);
    return;
  }
```

3. Leave the rest of `megapowers()` intact so the normal hooks, tool registration, and command registration always execute in the primary session.

The top of the file should now begin like this:

```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerTools } from "./register-tools.js";
import {
  ensureDeps,
  handleMegaCommand, handleIssueCommand, handleTriageCommand,
  handlePhaseCommand, handleDoneCommand, handleLearnCommand,
  handleTddCommand, handleTaskCommand, handleReviewCommand,
  type RuntimeDeps,
} from "./commands.js";
import { onContext, onSessionStart, onBeforeAgentStart, onToolCall, onToolResult, onAgentEnd } from "./hooks.js";
import { handleMpCommand, mpArgumentCompletions } from "./mp/mp-command.js";

export default function megapowers(pi: ExtensionAPI): void {
  const runtimeDeps: RuntimeDeps = {
    execGit: async (args: string[]) => {
      const r = await pi.exec("git", args);
      if (r.code !== 0) throw new Error(`git ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
      return { stdout: r.stdout, stderr: r.stderr };
    },
    execCmd: async (cmd: string, args: string[]) => {
      const r = await pi.exec(cmd, args);
      if (r.code !== 0) throw new Error(`${cmd} ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
      return { stdout: r.stdout, stderr: r.stderr };
    },
  };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/index-integration.test.ts tests/satellite-root.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Remove legacy delegation wording from implement prompts [depends: 1, 3]

### Task 4: Remove legacy delegation wording from implement prompts [depends: 1, 3]

**Files:**
- Modify: `extensions/megapowers/prompts.ts`
- Modify: `prompts/implement-task.md`
- Test: `tests/prompts.test.ts`

**Step 1 — Write the failing test**
In `tests/prompts.test.ts`, replace the `describe("implement prompt — subagent delegation instructions", ...)` block with:

```ts
describe("implement prompt — direct primary-session execution", () => {
  it("implement-task template explicitly prohibits legacy pipeline/subagent tools", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toMatch(/do not use.*pipeline|do not use.*subagent/i);
  });

  it("implement-task template specifies inline execution mode", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toMatch(/work directly|inline|this session/i);
  });

  it("buildImplementTaskVars does not advertise delegation to subagents", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Set up shared types", completed: true, noTest: false },
      { index: 2, description: "Build auth module", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Build logging module", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 1);
    expect(vars).toHaveProperty("remaining_tasks");
    expect(vars.remaining_tasks).toContain("Task 3");
    expect(vars.remaining_tasks).not.toContain("delegated to subagent");
    expect(vars.remaining_tasks).toContain("ready — can be implemented now");
  });

  it("remaining_tasks still marks tasks with unmet dependencies", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Types", completed: false, noTest: false },
      { index: 2, description: "Auth", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Logging", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 0);
    expect(vars.remaining_tasks).toContain("Task 2");
    expect(vars.remaining_tasks).toContain("blocked — waiting on task(s) 1");
  });

  it("remaining_tasks is sentinel when no tasks remain after current", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Only task", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 0);
    expect(vars.remaining_tasks).toBe("None — this is the only remaining task.");
  });

  it("remaining_tasks shows tasks as ready when their dependencies are complete", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Types", completed: true, noTest: false },
      { index: 2, description: "Auth", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Logging", completed: false, noTest: false, dependsOn: [1] },
    ];
    const vars = buildImplementTaskVars(tasks, 1);
    expect(vars.remaining_tasks).toContain("Task 3");
    expect(vars.remaining_tasks).not.toMatch(/Task 3.*blocked/i);
  });

  it("implement-task template instructs tests_failed signal after RED test failure", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toContain('megapowers_signal({ action: "tests_failed" })');
  });

  it("implement-task template instructs tests_passed signal after GREEN test pass", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toContain('megapowers_signal({ action: "tests_passed" })');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompts.test.ts`
Expected: FAIL — the `buildImplementTaskVars` assertion fails because `extensions/megapowers/prompts.ts` still says `ready — can be delegated to subagent`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/prompts.ts`, replace the ready-task wording in `buildRemainingTasksSummary()` with:

```ts
      if (unmetDeps.length > 0) {
        return `○ Task ${t.index}: ${t.description} [blocked — waiting on task(s) ${unmetDeps.join(", ")}]`;
      }
      return `○ Task ${t.index}: ${t.description} [ready — can be implemented now]`;
```

In `prompts/implement-task.md`, keep the direct-session guidance and legacy-tool prohibition as the implementation contract:

```md
## Execution Mode
Work directly in this session. TDD is enforced via tdd-guard.
**Do NOT use `pipeline` or `subagent` tools for implementation work in this session.** Do all implementation work inline here.

This restriction is specific to implement-phase task execution. Advisory planning-scout usage in the plan phase is separate.
```

Do not add any replacement delegation workflow.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompts.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: Delete the legacy pipeline and one-shot execution stack [depends: 1, 2, 3, 4]

### Task 5: Delete the legacy pipeline and one-shot execution stack [depends: 1, 2, 3, 4]

**Files:**
- Create test: `tests/legacy-subagent-stack-removed.test.ts`
- Modify/Delete: `extensions/megapowers/subagent/oneshot-tool.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-tool.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-runner.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-results.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-context.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-context-bounded.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-log.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-meta.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-steps.ts`
- Modify/Delete: `extensions/megapowers/subagent/task-deps.ts`
- Modify/Delete: `extensions/megapowers/subagent/message-utils.ts`
- Modify/Delete: `extensions/megapowers/subagent/tdd-auditor.ts`
- Modify/Delete: `extensions/megapowers/subagent/dispatcher.ts`
- Modify/Delete: `extensions/megapowers/subagent/pi-subagents-dispatcher.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-schemas.ts`
- Modify/Delete: `tests/oneshot-tool.test.ts`
- Modify/Delete: `tests/pipeline-tool.test.ts`
- Modify/Delete: `tests/pipeline-runner.test.ts`
- Modify/Delete: `tests/pipeline-workspace.test.ts`
- Modify/Delete: `tests/pipeline-results.test.ts`
- Modify/Delete: `tests/pipeline-context.test.ts`
- Modify/Delete: `tests/pipeline-context-bounded.test.ts`
- Modify/Delete: `tests/pipeline-log.test.ts`
- Modify/Delete: `tests/pipeline-meta.test.ts`
- Modify/Delete: `tests/pipeline-renderer.test.ts`
- Modify/Delete: `tests/pipeline-steps.test.ts`
- Modify/Delete: `tests/task-deps.test.ts`
- Modify/Delete: `tests/message-utils.test.ts`
- Modify/Delete: `tests/message-utils-test-output.test.ts`
- Modify/Delete: `tests/tdd-auditor.test.ts`
- Modify/Delete: `tests/pi-subagents-dispatcher.test.ts`
- Modify/Delete: `tests/pipeline-schemas-review.test.ts`
- Modify/Delete: `tests/pipeline-diff.test.ts`
- Modify/Delete: `tests/reproduce-086-bugs.test.ts`
- Modify/Delete: `tests/tools-subagent-wiring.test.ts`
- Modify/Delete: `tests/tools-pipeline-wiring.test.ts`

**Step 1 — Write the failing test**
Create `tests/legacy-subagent-stack-removed.test.ts` with:

```ts
import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.cwd();

const legacyRuntimeFiles = [
  "extensions/megapowers/subagent/oneshot-tool.ts",
  "extensions/megapowers/subagent/pipeline-tool.ts",
  "extensions/megapowers/subagent/pipeline-runner.ts",
  "extensions/megapowers/subagent/pipeline-workspace.ts",
  "extensions/megapowers/subagent/pipeline-results.ts",
  "extensions/megapowers/subagent/pipeline-context.ts",
  "extensions/megapowers/subagent/pipeline-context-bounded.ts",
  "extensions/megapowers/subagent/pipeline-log.ts",
  "extensions/megapowers/subagent/pipeline-meta.ts",
  "extensions/megapowers/subagent/pipeline-renderer.ts",
  "extensions/megapowers/subagent/pipeline-steps.ts",
  "extensions/megapowers/subagent/task-deps.ts",
  "extensions/megapowers/subagent/message-utils.ts",
  "extensions/megapowers/subagent/tdd-auditor.ts",
  "extensions/megapowers/subagent/dispatcher.ts",
  "extensions/megapowers/subagent/pi-subagents-dispatcher.ts",
  "extensions/megapowers/subagent/pipeline-schemas.ts",
];

describe("legacy pipeline/subagent stack removal", () => {
  it("deletes the legacy runtime modules", () => {
    for (const rel of legacyRuntimeFiles) {
      expect(existsSync(join(repo, rel))).toBe(false);
    }
  });

  it("keeps focused review wired to pi-subagents", () => {
    const runner = readFileSync(
      join(repo, "extensions/megapowers/plan-review/focused-review-runner.ts"),
      "utf-8",
    );
    expect(runner).toContain('from "pi-subagents/agents.js"');
    expect(runner).toContain('from "pi-subagents/execution.js"');
    expect(runner).not.toContain("pi-subagents-dispatcher");
  });

  it("has no legacy-only state fields in retained state/runtime files", () => {
    const files = [
      "extensions/megapowers/state/state-io.ts",
      "extensions/megapowers/state/state-machine.ts",
      "extensions/megapowers/tools/tool-signal.ts",
    ].map((rel) => readFileSync(join(repo, rel), "utf-8"));

    for (const source of files) {
      expect(source).not.toMatch(/pipeline(Id|Workspace)|subagentId/);
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/legacy-subagent-stack-removed.test.ts`
Expected: FAIL — `expect(existsSync(join(repo, rel))).toBe(false)` fails for files such as `extensions/megapowers/subagent/pipeline-tool.ts` and `extensions/megapowers/subagent/oneshot-tool.ts` because the legacy stack still exists.

**Step 3 — Write minimal implementation**
1. Delete these legacy runtime modules from `extensions/megapowers/subagent/`:
   - `oneshot-tool.ts`
   - `pipeline-tool.ts`
   - `pipeline-runner.ts`
   - `pipeline-workspace.ts`
   - `pipeline-results.ts`
   - `pipeline-context.ts`
   - `pipeline-context-bounded.ts`
   - `pipeline-log.ts`
   - `pipeline-meta.ts`
   - `pipeline-renderer.ts`
   - `pipeline-steps.ts`
   - `task-deps.ts`
   - `message-utils.ts`
   - `tdd-auditor.ts`
   - `dispatcher.ts`
   - `pi-subagents-dispatcher.ts`
   - `pipeline-schemas.ts`
2. Delete only the tests that exist solely for that stack:
   - `tests/oneshot-tool.test.ts`
   - `tests/pipeline-tool.test.ts`
   - `tests/pipeline-runner.test.ts`
   - `tests/pipeline-workspace.test.ts`
   - `tests/pipeline-results.test.ts`
   - `tests/pipeline-context.test.ts`
   - `tests/pipeline-context-bounded.test.ts`
   - `tests/pipeline-log.test.ts`
   - `tests/pipeline-meta.test.ts`
   - `tests/pipeline-renderer.test.ts`
   - `tests/pipeline-steps.test.ts`
   - `tests/task-deps.test.ts`
   - `tests/message-utils.test.ts`
   - `tests/message-utils-test-output.test.ts`
   - `tests/tdd-auditor.test.ts`
   - `tests/pi-subagents-dispatcher.test.ts`
   - `tests/pipeline-schemas-review.test.ts`
   - `tests/pipeline-diff.test.ts`
   - `tests/reproduce-086-bugs.test.ts`
   - `tests/tools-subagent-wiring.test.ts`
   - `tests/tools-pipeline-wiring.test.ts`
3. Preserve these files unchanged because they are the retained non-legacy path:
   - `extensions/megapowers/plan-review/focused-review.ts`
   - `extensions/megapowers/plan-review/focused-review-runner.ts`
   - `tests/focused-review.test.ts`
   - `tests/focused-review-runner.test.ts`
   - `tests/hooks-focused-review.test.ts`
   - `package.json` (keep the `pi-subagents` dependency)
   - `extensions/megapowers/state/state-machine.ts`
   - `extensions/megapowers/state/state-io.ts`
   - `extensions/megapowers/tools/tool-signal.ts`
4. Also verify that `extensions/megapowers/state/state-io.ts`, `extensions/megapowers/state/state-machine.ts`, and `extensions/megapowers/tools/tool-signal.ts` do not contain legacy-only fields `pipelineId`, `pipelineWorkspace`, or `subagentId`.
5. Do **not** add any replacement orchestration layer, new state fields, or new dispatch wrappers.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/legacy-subagent-stack-removed.test.ts tests/state-io.test.ts tests/tool-signal.test.ts tests/phase-advance.test.ts tests/focused-review.test.ts tests/focused-review-runner.test.ts tests/hooks-focused-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: Delete satellite-mode helpers and tests [no-test] [depends: 3, 5]

### Task 6: Delete satellite-mode helpers and tests [no-test] [depends: 3, 5]

**Justification:** dead-path deletion. Once the extension no longer branches into satellite mode and the legacy subagent/pipeline path is removed, `satellite.ts` and its satellite-only tests are obsolete implementation details with no remaining runtime entrypoint.

**Files:**
- Modify/Delete: `extensions/megapowers/satellite.ts`
- Modify/Delete: `tests/satellite.test.ts`
- Modify/Delete: `tests/satellite-root.test.ts`
- Modify/Delete: `tests/satellite-resolve-root.test.ts`
- Modify/Delete: `tests/satellite-pi-subagent-depth.test.ts`
- Modify/Delete: `tests/satellite-setup-noop.test.ts`
- Modify/Delete: `tests/satellite-unused-imports.test.ts`

**Step 1 — Make the change**
Delete `extensions/megapowers/satellite.ts` and the satellite-specific tests that only existed to support the removed legacy subagent execution mode.

Also remove any remaining comments in nearby files that describe satellite-mode write-hook exceptions or audit-only subagent execution as a supported runtime path.

**Step 2 — Verify**
Run: `grep -R "satellite" extensions/megapowers tests | cat && bun test`
Expected: no production code imports `./satellite.js`, only intentional historical/docs references remain, and the full test suite passes without the deleted satellite helpers.

### Task 7: Update public documentation to remove the legacy pipeline workflow [no-test] [depends: 5, 6]

### Task 7: Update public documentation to remove the legacy pipeline workflow [no-test] [depends: 5, 6]

**Justification:** documentation-only change.

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `ROADMAP.md`

**Step 1 — Make the change**
Update the public docs so they no longer advertise the removed legacy implement-phase pipeline/subagent workflow.

Required edits:
- In `README.md`, remove the `pipeline` and legacy `subagent` entries from the tool table, remove the isolated-worktree architecture bullets, update the directory layout so it no longer presents `subagent/` or `.megapowers/subagents/<id>/` as supported runtime structure, and rewrite any surviving `subagent` references so they clearly refer only to preserved newer `pi-subagents` usage where applicable.
- In `AGENTS.md`, remove the custom-tool bullets for `pipeline` and legacy `subagent`, remove the satellite-mode enforcement notes, and rewrite the key-concepts/known-issues sections so they describe direct primary-session implementation rather than a per-task pipeline.
- In `ROADMAP.md`, remove or reword completed/current milestone entries that still present the deleted pipeline/subagent architecture as current product behavior.

Do not remove mentions of `pi-subagents` where they refer to focused review or other preserved non-legacy capabilities.

**Step 2 — Verify**
Run: `grep -nEi '(^|[^a-z])pipeline([^a-z]|$)|satellite mode|isolated git worktree|\bsubagent(s)?\b' README.md AGENTS.md ROADMAP.md || true; bun test`
Expected: any remaining matches are only preserved `pi-subagents` references or historical context that clearly distinguishes the preserved functionality from the deleted legacy path; public docs no longer advertise the removed implement-phase pipeline / one-shot subagent workflow; and the full test suite passes.

### Task 8: Update internal agent and review prompts after legacy subagent removal [no-test] [depends: 4, 5, 6]

### Task 8: Update internal agent and review prompts after legacy subagent removal [no-test] [depends: 4, 5, 6]

**Justification:** prompt/documentation-only change.

**Files:**
- Modify: `.pi/agents/implementer.md`
- Modify: `prompts/code-review.md`
- Modify: `prompts/verify.md`

**Step 1 — Make the change**
Rewrite internal prompt content that still assumes the removed legacy pipeline/subagent execution path.

Required edits:
- In `.pi/agents/implementer.md`, remove the sentence that says the pipeline runner will audit tool-call history and pass that report to the reviewer. Keep strict TDD instructions, but describe direct task execution rather than pipeline-runner auditing.
- In `prompts/code-review.md`, replace wording like “If subagents implemented some tasks” with wording that does not assume a legacy delegated implementation path.
- In `prompts/verify.md`, remove the verification red flag that talks about trusting a subagent’s reported status for task completion; replace it with language about independently verifying any preserved advisory/review outputs if they were used.

Do not remove legitimate references to preserved `pi-subagents` review fan-out elsewhere in the repo.

**Step 2 — Verify**
Run: `grep -nE 'pipeline runner|If subagents implemented|Subagent completed task' .pi/agents/implementer.md prompts/code-review.md prompts/verify.md || true; bun test`
Expected: those legacy delegated-execution phrases are gone or rewritten to reflect direct primary-session implementation, any retained wording is clearly about preserved non-legacy review/advisory usage, and the full test suite passes.
