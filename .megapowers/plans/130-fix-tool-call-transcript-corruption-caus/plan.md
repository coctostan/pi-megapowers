# Plan

### Task 1: Preserve transition tool transcripts

### Task 1: Preserve transition tool transcripts

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Modify: `tests/new-session-wiring.test.ts`
- Test (adopt unchanged): `tests/tool-session-transcript.test.ts`

Covers Fixed When 1–6 and the next-agent-start portion of 7. Policy: these tools advance workflow state in the current session; no deferred reset, automatic handoff, newSession command call, or termination workaround. Preserve state handlers, gates, result/error formatting, dashboard behavior, and all five tool registrations.

**Step 1 — Write the failing test**
Adopt the already failing reproduction test below unchanged (do not duplicate, delete, or weaken it). Verified registration signature: `registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void`; callbacks use `async execute(_toolCallId, params, _signal, _onUpdate, ctx)`.

```ts
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

type TranscriptMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: { type: "toolCall"; id: string; name: string; arguments: unknown }[] }
  | { role: "toolResult"; toolCallId: string; toolName: string; content: unknown; isError: boolean };

// Models the relevant Pi persistence boundary without importing the Pi runtime:
// the assistant is persisted before execute(), the result after execute(), and
// the next provider request projects messages from the session manager.
class TranscriptSessionManager {
  private messages: TranscriptMessage[] = [];

  appendMessage(message: TranscriptMessage): void {
    this.messages.push(message);
  }

  newSession(): void {
    this.messages = [];
  }

  buildSessionProjection(): { messages: TranscriptMessage[] } {
    return { messages: [...this.messages] };
  }
}

describe("Megapowers transition tool transcript pairing", () => {
  it.each(["phase_next", "task_done"] as const)(
    "%s preserves the originating call when Pi persists its result",
    async (action) => {
      const cwd = mkdtempSync(join(tmpdir(), "megapowers-transcript-"));
      try {
        writeState(cwd, {
          ...createInitialState(),
          activeIssue: "001-repro",
          workflow: "feature",
          phase: action === "task_done" ? "implement" : "brainstorm",
          tddTaskState: action === "task_done"
            ? { taskIndex: 1, state: "impl-allowed", skipped: false }
            : null,
        });
        if (action === "task_done") {
          const planDir = join(cwd, ".megapowers", "plans", "001-repro");
          mkdirSync(planDir, { recursive: true });
          writeFileSync(join(planDir, "plan.md"), "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
        }

        const tools: Record<string, any> = {};
        registerTools({
          registerTool: (tool: any) => { tools[tool.name] = tool; },
          exec: async () => ({ code: 1, stdout: "", stderr: "" }),
        } as any, {});

        const sessionManager = new TranscriptSessionManager();
        const toolCallId = `call_repro_${action}`;
        sessionManager.appendMessage({ role: "user", content: "Continue" });
        sessionManager.appendMessage({
          role: "assistant",
          content: [{ type: "toolCall", id: toolCallId, name: "megapowers_signal", arguments: { action } }],
        });
        const result = await tools.megapowers_signal.execute(
          toolCallId, { action }, undefined, undefined,
          { cwd, hasUI: false, sessionManager },
        );
        // Verify the workflow operation succeeded, not an unrelated gate error.
        expect(result.content[0].text).not.toStartWith("Error:");
        if (action === "task_done") {
          expect(readState(cwd).completedTasks).toEqual([1]);
          expect(readState(cwd).currentTaskIndex).toBe(1);
        } else {
          expect(readState(cwd).phase).toBe("spec");
        }

        // Pi records a normal tool result only after execute() returns.
        sessionManager.appendMessage({
          role: "toolResult", toolCallId, toolName: "megapowers_signal",
          content: result.content, isError: false,
        });
        const messages = sessionManager.buildSessionProjection().messages;
        const calls = new Set(messages.flatMap((message) =>
          message.role === "assistant" ? message.content.map((call) => call.id) : [],
        ));
        const orphanedResults = messages.flatMap((message) =>
          message.role === "toolResult" && !calls.has(message.toolCallId) ? [message.toolCallId] : [],
        );
        expect(orphanedResults).toEqual([]);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
  );
});

```

Replace the ENTIRE existing `tests/new-session-wiring.test.ts` with this persistence-boundary test. This retires all six unsafe reset expectations as part of the same logical repair. The matrix tests one invariant across affected entry paths and persistence layouts; it simulates host persistence, not live SDK or provider integration.

```ts
import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { readPlanTask } from "../extensions/megapowers/state/plan-store.js";
import { onBeforeAgentStart } from "../extensions/megapowers/hooks.js";

type Case = {
  name: string; phase: any; mode?: any; tool: string; params: any;
  next: any; nextMode?: any; error?: boolean;
};
const cases: Case[] = [
  { name: "phase-next", phase: "brainstorm", tool: "megapowers_signal", params: { action: "phase_next" }, next: "spec" },
  { name: "phase-back", phase: "verify", tool: "megapowers_signal", params: { action: "phase_back" }, next: "implement" },
  { name: "task-next", phase: "implement", tool: "megapowers_signal", params: { action: "task_done" }, next: "implement" },
  { name: "task-final", phase: "implement", tool: "megapowers_signal", params: { action: "task_done" }, next: "verify" },
  { name: "draft-done", phase: "plan", mode: "draft", tool: "megapowers_signal", params: { action: "plan_draft_done" }, next: "plan", nextMode: "review" },
  { name: "revise-done", phase: "plan", mode: "revise", tool: "megapowers_signal", params: { action: "plan_draft_done" }, next: "plan", nextMode: "review" },
  { name: "review-approve", phase: "plan", mode: "review", tool: "megapowers_plan_review", params: { verdict: "approve", feedback: "Good", approved_tasks: [1] }, next: "implement", nextMode: null },
  { name: "review-revise", phase: "plan", mode: "review", tool: "megapowers_plan_review", params: { verdict: "revise", feedback: "Fix it", needs_revision_tasks: [1] }, next: "plan", nextMode: "revise" },
  { name: "phase-gate-error", phase: "spec", tool: "megapowers_signal", params: { action: "phase_next" }, next: "spec", error: true },
  { name: "tdd-gate-error", phase: "implement", tool: "megapowers_signal", params: { action: "task_done" }, next: "implement", error: true },
  { name: "review-gate-error", phase: "plan", mode: "review", tool: "megapowers_plan_review", params: { verdict: "revise", feedback: "Fix it", needs_revision_tasks: [1] }, next: "plan", nextMode: "review", error: true },
  { name: "tests-failed", phase: "implement", tool: "megapowers_signal", params: { action: "tests_failed" }, next: "implement" },
  { name: "tests-passed", phase: "implement", tool: "megapowers_signal", params: { action: "tests_passed" }, next: "implement" },
  { name: "close-issue", phase: "done", tool: "megapowers_signal", params: { action: "close_issue" }, next: null },
];

function setup(cwd: string, row: Case) {
  const dir = join(cwd, ".megapowers", "plans", "001-test");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plan.md"), row.name === "task-final"
    ? "# Plan\n\n### Task 1: First\n"
    : "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
  if (row.phase === "plan") {
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks", "task-001.md"), "---\nid: 1\ntitle: First\nstatus: draft\n---\nBody.");
    if (row.name === "review-revise") {
      writeFileSync(join(dir, "revise-instructions-1.md"), "Fix task 1.");
    }
  }
  if (row.name === "phase-back") writeFileSync(join(dir, "verify.md"), "Old verification");
  mkdirSync(join(cwd, ".megapowers", "issues"), { recursive: true });
  writeFileSync(join(cwd, ".megapowers", "issues", "001-test.md"),
    "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Test\nFixture");
  writeState(cwd, {
    ...createInitialState(), activeIssue: "001-test", workflow: "feature",
    phase: row.phase, planMode: row.mode ?? null,
    planIteration: row.phase === "plan" ? 1 : 0,
    tddTaskState: row.name === "tdd-gate-error" ? null : row.phase === "implement"
      ? { taskIndex: 1, state: row.name === "tests-failed" ? "test-written" : "impl-allowed", skipped: false }
      : null,
  });
}

describe("transition tool persistence", () => {
  it("preserves tool pairing for every transition across direct, batch, and nested layouts", async () => {
    for (const row of cases) {
      for (const layout of ["direct", "batch-sibling-first", "batch-transition-first", "nested"]) {
        const cwd = mkdtempSync(join(tmpdir(), "transition-persistence-"));
        try {
          setup(cwd, row);
          const tools: Record<string, any> = {};
          registerTools({ registerTool: (tool: any) => { tools[tool.name] = tool; },
            exec: async () => ({ code: 1, stdout: "", stderr: "" }) } as any, {});
          expect(Object.keys(tools).sort()).toEqual([
            "create_batch", "create_issue", "megapowers_plan_review", "megapowers_plan_task", "megapowers_signal",
          ]);
          let messages: any[] = [];
          let resets = 0;
          const sessionManager = {
            appendMessage: (m: any) => { messages.push(m); },
            newSession: () => { resets++; messages = []; },
            buildSessionProjection: () => ({ messages: [...messages] }),
          };
          const outerId = "call_" + row.name;
          const nested = layout === "nested";
          const batch = layout.startsWith("batch");
          const calls = [{
            type: "toolCall", id: outerId, name: nested ? "codemode" : row.tool,
            arguments: nested ? { code: "invoke transition" } : row.params,
          }];
          if (batch) calls.push({ type: "toolCall", id: "call_sibling", name: "read", arguments: { path: "fixture.md" } });
          sessionManager.appendMessage({ role: "user", content: "Continue" });
          sessionManager.appendMessage({ role: "assistant", content: calls });
          const sibling = { role: "toolResult", toolCallId: "call_sibling", toolName: "read", content: [{ type: "text", text: "Fixture" }], isError: false };
          if (layout === "batch-sibling-first") sessionManager.appendMessage(sibling);
          // A nested executeTool call has a parent/n id; only its outer result is persisted.
          const result = await tools[row.tool].execute(
            nested ? outerId + "/0" : outerId, row.params, undefined, undefined,
            { cwd, hasUI: false, sessionManager,
              newSession: () => { throw new Error("Command-only session replacement is unavailable in tools"); } },
          );
          expect(result.content[0].text.startsWith("Error:")).toBe(row.error ?? false);
          sessionManager.appendMessage({
            role: "toolResult", toolCallId: outerId, toolName: nested ? "codemode" : row.tool,
            content: result.content, isError: false,
          });
          if (layout === "batch-transition-first") sessionManager.appendMessage(sibling);
          const projected = sessionManager.buildSessionProjection().messages;
          const ids = new Set(projected.filter(m => m.role === "assistant").flatMap(m => m.content.map((c: any) => c.id)));
          const resultIds = projected.filter(m => m.role === "toolResult").map(m => m.toolCallId);
          expect(resultIds.filter(id => !ids.has(id))).toEqual([]);
          expect([...ids].sort()).toEqual(resultIds.slice().sort());
          expect(projected.slice(0, 2).map(m => m.role)).toEqual(["user", "assistant"]);
          expect(resets).toBe(0);
          const state = readState(cwd);
          expect(state.phase).toBe(row.next);
          if ("nextMode" in row) expect(state.planMode).toBe(row.nextMode);
          if (row.name.startsWith("task-")) {
            expect(state.completedTasks).toEqual([1]);
            expect(state.tddTaskState).toBeNull();
            if (row.name === "task-next") expect(state.currentTaskIndex).toBe(1);
          }
          if (row.name === "tdd-gate-error") expect(state.completedTasks).toEqual([]);
          if (row.name === "tests-failed") expect(state.tddTaskState?.state).toBe("impl-allowed");
          if (row.name === "review-revise") expect(state.planIteration).toBe(2);
          if (row.name === "review-approve" || row.name === "review-revise") {
            const task = readPlanTask(cwd, "001-test", 1);
            expect(task && !("error" in task) ? task.data.status : undefined)
              .toBe(row.name === "review-approve" ? "approved" : "needs_revision");
            expect(existsSync(join(cwd, ".megapowers", "plans", "001-test", "review-001.md"))).toBe(true);
          }
          if (row.name === "phase-back") expect(existsSync(join(cwd, ".megapowers", "plans", "001-test", "verify.v1.md"))).toBe(true);
          // This is the NEXT agent start, not a promise of reinjection inside a running batch.
          const context = await onBeforeAgentStart({}, { cwd, hasUI: false },
            { store: createStore(cwd) } as any);
          expect(context.message.content).toContain(state.phase ? "Active phase: " + state.phase : "No active issue.");
        } finally {
          rmSync(cwd, { recursive: true, force: true });
        }
      }
    }
  });
});

```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-session-transcript.test.ts`
Expected: FAIL at line 92, with actual observed Bun output:
```text
error: expect(received).toEqual(expected)
- []
+ [
+   "call_repro_phase_next",
+ ]
```
The second case similarly receives `["call_repro_task_done"]`. This command was probed before planning. Workflow-success assertions precede and pass before these failures.

**Step 3 — Write minimal implementation**
Inside the existing `pi.registerTool` objects, replace ONLY the signal and review execute methods with these complete methods. All other registration code stays unchanged. Never invoke session replacement from these callbacks or relocate it into hooks.

Signal:
```ts
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { store, ui } = ensureDeps(runtimeDeps, pi, ctx.cwd);
      let result: SignalResult;
      if (params.action === "plan_draft_done") {
        result = await handlePlanDraftDone(ctx.cwd);
      } else {
        result = handleSignal(ctx.cwd, params.action, params.target);
      }
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      // Workflow transitions preserve the current Pi session.


      if (ctx.hasUI) {
        ui.renderDashboard(ctx, readState(ctx.cwd), store);
      }
      return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
    },
```

Review:
```ts
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handlePlanReview(ctx.cwd, params);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      // Workflow transitions preserve the current Pi session.

      return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
    },
```

The legacy result flags remain temporarily present but unused until Tasks 2–3; this makes Task 1 independently green without breaking producer tests prematurely.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-session-transcript.test.ts`
Expected: PASS (both adopted reproduction cases). Also run `bun test tests/new-session-wiring.test.ts` to verify the full path/layout matrix.

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing. Baseline was 868 passing plus exactly the two reproduced failures; do not accept suppressing those failures. Existing domain, create-issue/batch, plan-task, gate, artifact-versioning, and TDD tests remain enabled.


**Operational checkpoint — reload before live completion**
After the tests pass, the file change is NOT yet reflected in the currently loaded tool callbacks. Before calling live `megapowers_signal(task_done)` for this first task, ask the user to run `/reload`. Then continue in the refreshed runtime. If the transcript was already corrupted, a user-initiated `/new` may additionally be needed. Do not call the old loaded transition callback to test whether it still breaks the session. Never edit coordination state or bypass review/TDD.

### Task 2: Remove signal session-reset instructions [depends: 1]

### Task 2: Remove signal session-reset instructions [depends: 1]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`
- Modify: `extensions/megapowers/plan-orchestrator.ts`

Covers Fixed When 1, 3, 5–7. Task 1 must have removed the consumers first. Preserve all workflow state mutations and feedback content except for the explicitly obsolete automatic-session promise in `transitionDraftToReview`. The optional result-field removal is a result contract change, not a state.json schema change.

Grounding: verified `SignalResult`, `handleSignal(cwd, action, target?): SignalResult`, and `handlePlanDraftDone(cwd): Promise<SignalResult>` from source. `impact([SignalResult], signature_change)` found no indexed call-edge dependents; explicit search identified the signal producer, register-tools consumer (already removed by Task 1), and `tests/tool-signal.test.ts`. No other dependent tests require changes.

Revision grounding: `read(symbol)` and `symbol_graph` confirm `transitionDraftToReview(state: MegapowersState, taskCount: number): OrchestratorResult<PlanTransitionResult>` and `composeMessage(args: ComposeArgs): string`. AST search confirms the `composeMessage` call owns the obsolete `nextStep` inside this function. All Step 3 local callees were checked against their current source signatures; Node fs/path helpers remain the existing imports.

**Step 1 — Write the failing test**
Append this COMPLETE describe block at EOF in `tests/tool-signal.test.ts`. Its imports (`describe/it/expect`, fs/temp/path helpers, handlers, state helpers) already exist in that file; it uses its own temporary fixtures rather than another describe's hooks.

```ts
describe("signal session policy", () => {
  it("successful signal transitions return no session-reset instruction", async () => {
    for (const action of ["phase_next", "phase_back", "task_done", "plan_draft_done"] as const) {
      const cwd = mkdtempSync(join(tmpdir(), "signal-policy-"));
      try {
        const dir = join(cwd, ".megapowers", "plans", "001-test");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
        if (action === "plan_draft_done") {
          mkdirSync(join(dir, "tasks"), { recursive: true });
          writeFileSync(join(dir, "tasks", "task-001.md"), "---\nid: 1\ntitle: First\nstatus: draft\n---\nBody.");
        }
        writeState(cwd, {
          ...createInitialState(), activeIssue: "001-test", workflow: "feature",
          phase: action === "phase_next" ? "brainstorm" : action === "phase_back" ? "verify"
            : action === "task_done" ? "implement" : "plan",
          planMode: action === "plan_draft_done" ? "draft" : null,
          planIteration: action === "plan_draft_done" ? 1 : 0,
          tddTaskState: action === "task_done" ? { taskIndex: 1, state: "impl-allowed", skipped: false } : null,
        });
        const result = action === "plan_draft_done" ? await handlePlanDraftDone(cwd) : handleSignal(cwd, action);
        expect(result.error).toBeUndefined();
        if (action === "plan_draft_done") {
          expect(result.message).toContain("current Pi session");
          expect(result.message).not.toMatch(/new review session|starts a new session|fresh session/i);
        }
        expect(result).not.toHaveProperty("triggerNewSession");
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "signal session policy"`
Expected: FAIL. Minimal actual handler probe emitted:
```text
error: expect(received).not.toHaveProperty(path)

Expected path: not "triggerNewSession"

Received value: true
```

The loop initially fails on the `phase_next` no-flag assertion above. Once the obsolete flags are removed, the `plan_draft_done` message assertion independently fails until its producer's next step is corrected:
```text
error: expect(received).toContain(expected)

Expected to contain: "current Pi session"
Received: "📋 Plan draft complete — 1 task saved\n  Next: Transitioning to review mode. A new review session will start."
```
Both failures protect the same session-preservation policy; keep all four action fixtures and the no-flag assertion.

**Step 3 — Write minimal implementation**
Replace the existing interface and these five symbols with the complete bodies below. They differ only by removing the interface field and all five return flags. Keep imports and every other handler unchanged.

```ts
export interface SignalResult {
  message?: string;
  error?: string;
}

function handleTaskDone(cwd: string): SignalResult {
  const state = readState(cwd);

  if (!state.activeIssue || state.phase !== "implement") {
    return { error: "task_done can only be called during the implement phase." };
  }

  const tasks = deriveTasks(cwd, state.activeIssue);
  if (tasks.length === 0) {
    return { error: "No tasks found. Ensure task files exist in .megapowers/plans/<issue>/tasks/." };
  }

  const currentTask = tasks[state.currentTaskIndex];
  if (!currentTask) {
    return { error: `No task at index ${state.currentTaskIndex}. Tasks: ${tasks.length}` };
  }

  // -----------------------------------------------------------------------
  // AC13 — null-safe TDD validation
  //
  // The null-safety gap: `tdd && tdd.taskIndex === currentTask.index` evaluates
  // to `false` when `tdd` is null (&&-short-circuit), making the surrounding
  // condition treat null as "no constraint violated". We must explicitly treat
  // null as a blocking state for non-[no-test] tasks.
  // -----------------------------------------------------------------------
  if (!currentTask.noTest) {
    const tdd = state.tddTaskState;

    // tddOk is true only when:
    //   - tdd is NOT null, AND
    //   - either (a) it was explicitly skipped, OR
    //            (b) it refers to the current task AND state is impl-allowed
    const tddOk =
      tdd !== null &&
      (tdd.skipped || (tdd.taskIndex === currentTask.index && tdd.state === "impl-allowed"));

    if (!tddOk) {
      const reason =
        tdd === null
          ? "TDD requirements not met. No test file written yet. Write a test file, run tests (they must fail), then implement. Or use /tdd skip to bypass."
          : tdd.taskIndex !== currentTask.index
            ? `TDD state is for task ${tdd.taskIndex} but current task is ${currentTask.index}. TDD state must match the current task.`
            : "TDD requirements not met. Tests have not failed yet (need RED phase). Run tests and ensure they fail before implementing.";
      return { error: reason };
    }
  }

  // Mark complete using PlanTask.index (1-based)
  const completedTasks = [...state.completedTasks, currentTask.index];
  const completedSet = new Set(completedTasks);

  // Find next incomplete task — search forward from current, wrap around
  let nextIncompleteIdx = -1;
  for (let i = state.currentTaskIndex + 1; i < tasks.length; i++) {
    if (!completedSet.has(tasks[i].index)) {
      nextIncompleteIdx = i;
      break;
    }
  }
  if (nextIncompleteIdx === -1) {
    for (let i = 0; i <= state.currentTaskIndex; i++) {
      if (!completedSet.has(tasks[i].index)) {
        nextIncompleteIdx = i;
        break;
      }
    }
  }

  const allDone = tasks.every(t => completedSet.has(t.index));

  if (allDone) {
    // Auto-advance to verify
    const updatedState = {
      ...state,
      completedTasks,
      tddTaskState: null,
    };
    const newState = transition(updatedState, "verify" as Phase);
    writeState(cwd, newState);
    return {
      message: composeMessage({
        icon: "success",
        summary: `Task ${currentTask.index} (${currentTask.description}) marked complete`,
        changes: [`All ${tasks.length} tasks done`],
        nextStep: "Phase advanced to verify — begin verification.",
      }),
    };
  }

  // Advance to next task
  const nextIdx = nextIncompleteIdx >= 0 ? nextIncompleteIdx : state.currentTaskIndex;
  const nextTask = tasks[nextIdx];
  const updatedState = {
    ...state,
    completedTasks,
    currentTaskIndex: nextIdx,
    tddTaskState: null, // Reset TDD state for next task
  };
  writeState(cwd, updatedState);

  const remaining = tasks.length - completedTasks.length;
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${currentTask.index} (${currentTask.description}) marked complete`,
      changes: [`${remaining} task${remaining === 1 ? "" : "s"} remaining`],
      nextStep: `Task ${nextTask.index}: ${nextTask.description}`,
    }),
  };
}

export async function handlePlanDraftDone(cwd: string): Promise<SignalResult> {
  const state = readState(cwd);
  if (state.phase !== "plan") {
    return { error: "plan_draft_done can only be called during the plan phase." };
  }
  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return { error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
  }
  const tasks = listPlanTasks(cwd, state.activeIssue!);
  if (tasks.length === 0) {
    return { error: "No task files found. Use megapowers_plan_task to create tasks before signaling draft done." };
  }

  const orchestrated = transitionDraftToReview(state, tasks.length);
  if (!orchestrated.ok) {
    return { error: orchestrated.error };
  }

  writeState(cwd, orchestrated.value.nextState);
  return {
    message: orchestrated.value.message,
  };
}

function handlePhaseNext(cwd: string, target?: string): SignalResult {
  const result = advancePhase(cwd, target as Phase | undefined);
  if (!result.ok) {
    return { error: result.error };
  }
  return {
    message: composeMessage({
      icon: "info",
      summary: `Phase advanced to ${result.newPhase}`,
      nextStep: `Proceed with ${result.newPhase} phase work.`,
    }),
  };
}

function handlePhaseBack(cwd: string): SignalResult {
  const state = readState(cwd);

  if (!state.activeIssue || !state.phase || !state.workflow) {
    return { error: "No active issue or phase." };
  }

  const config = getWorkflowConfig(state.workflow);
  const backwardTransition = config.transitions.find(
    (t) => t.from === state.phase && t.backward === true,
  );

  if (!backwardTransition) {
    return {
      error: `No backward transition from ${state.phase} in ${state.workflow} workflow.`,
    };
  }

  // Note: reviewApproved is reset by transition() in state-machine.ts
  // when to === "plan". No explicit intermediate write needed here.

  const planDir = join(cwd, ".megapowers", "plans", state.activeIssue);

  // Auto-version artifacts on backward transitions (AC13-AC16)
  if (backwardTransition.from === "review" && backwardTransition.to === "plan") {
    versionArtifact(planDir, "review.md");
    versionArtifact(planDir, "plan.md");
  }
  if (backwardTransition.from === "verify" && backwardTransition.to === "implement") {
    versionArtifact(planDir, "verify.md");
  }
  if (backwardTransition.from === "code-review" && backwardTransition.to === "implement") {
    versionArtifact(planDir, "code-review.md");
  }
  const result = advancePhase(cwd, backwardTransition.to);
  if (!result.ok) {
    return { error: result.error };
  }

  return {
    message: composeMessage({
      icon: "warn",
      summary: `Phase moved back to ${result.newPhase}`,
      changes: ["Rework needed"],
      nextStep: `Continue with the ${result.newPhase} phase.`,
    }),
  };
}
```

In `extensions/megapowers/plan-orchestrator.ts`, inside `transitionDraftToReview(state: MegapowersState, taskCount: number): OrchestratorResult<PlanTransitionResult>`, replace ONLY:
```ts
        nextStep: "Transitioning to review mode. A new review session will start.",
```
with:
```ts
        nextStep: "Review mode is active in the current Pi session. Continue with plan review.",
```
Keep its guards, `nextState`, summary and task count unchanged. Do not replace the whole orchestrator file or change any other transition.

Retire obsolete test expectations in `tests/tool-signal.test.ts`. Replace every exact occurrence of either of these lines:
```ts
expect(result.triggerNewSession).toBe(true);
expect(result.triggerNewSession).toBeUndefined();
```
with:
```ts
expect(result).not.toHaveProperty("triggerNewSession");
```
Keep ALL surrounding state, gate, message, and TDD assertions. Rename the five former positive-reset tests to:
- `omits session-reset instructions when auto-advancing to verify`
- `omits session-reset instructions when advancing to the next task`
- `omits session-reset instructions when entering review mode`
- `omits session-reset instructions on phase advance`
- `omits session-reset instructions on backward transition`

The error/non-transition test groups should be named `session policy — error cases` and `session policy — non-transition actions`; their case titles should say `omits session-reset instructions` rather than referring to reading a removed typed property. String-key negative assertions are intentional behavioral regressions.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "signal session policy"`
Expected: PASS. Also run `bun test tests/tool-signal.test.ts tests/plan-orchestrator.test.ts` to check updated legacy cases and unchanged orchestrator behavior.

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing.

### Task 3: Remove review session-reset instructions [depends: 1]

### Task 3: Remove review session-reset instructions [depends: 1]

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Modify: `tests/tool-plan-review.test.ts`
- Modify: `extensions/megapowers/plan-orchestrator.ts`

Covers Fixed When 1–3 and 6–7 for review results. Preserve review files, task statuses, plan iteration, revise-instructions gates, legacy plan.md, and transition-to-implement logic.

Grounding: `handlePlanReview(cwd: string, params: PlanReviewParams): PlanReviewResult` and private `handleApproveVerdict(cwd, state, slug): PlanReviewResult` were read by symbol. `impact([PlanReviewResult], signature_change)` found no indexed call-edge dependents; explicit search found this producer, the wrapper removed in Task 1, and `tests/tool-plan-review.test.ts`. Do not interpret the graph result as proof there were no consumers.

Revision grounding: `read(symbol)` and `symbol_graph` confirm `transitionReviewToRevise(state: MegapowersState, approvedIds: number[], needsRevisionIds: number[], maxIterations: number): OrchestratorResult<PlanTransitionResult>` and `composeMessage(args: ComposeArgs): string`. AST search confirms the success-result `composeMessage` call owns the obsolete `nextStep`. All Step 3 local callees were checked against their current source signatures; Node fs/path helpers remain the existing imports.

**Step 1 — Write the failing test**
Append this complete describe block at EOF in `tests/tool-plan-review.test.ts`. All imports used below already exist at its top; no extra dependency or shared fixture helper is needed.

```ts
describe("plan-review session policy", () => {
  it("successful review verdicts return no session-reset instruction", () => {
    for (const verdict of ["approve", "revise"] as const) {
      const cwd = mkdtempSync(join(tmpdir(), "review-policy-"));
      try {
        const dir = join(cwd, ".megapowers", "plans", "001-test");
        mkdirSync(join(dir, "tasks"), { recursive: true });
        writeFileSync(join(dir, "tasks", "task-001.md"), "---\nid: 1\ntitle: First\nstatus: draft\n---\nBody.");
        writeFileSync(join(dir, "revise-instructions-1.md"), "Fix task 1.");
        writeState(cwd, { ...createInitialState(), activeIssue: "001-test", workflow: "feature",
          phase: "plan", planMode: "review", planIteration: 1 });
        const result = handlePlanReview(cwd, {
          verdict, feedback: "Review feedback",
          approved_tasks: verdict === "approve" ? [1] : [],
          needs_revision_tasks: verdict === "revise" ? [1] : [],
        });
        expect(result.error).toBeUndefined();
        if (verdict === "revise") {
          expect(result.message).toContain("current Pi session");
          expect(result.message).not.toMatch(/new review session|starts a new session|fresh session/i);
        }
        expect(result).not.toHaveProperty("triggerNewSession");
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-review.test.ts -t "plan-review session policy"`
Expected: FAIL. The actual approve-handler probe emitted:
```text
error: expect(received).not.toHaveProperty(path)

Expected path: not "triggerNewSession"

Received value: true
```

The approve-first loop initially fails on the no-flag assertion above. After flag cleanup, the revise message assertion independently fails until `transitionReviewToRevise`'s next step is corrected:
```text
error: expect(received).toContain(expected)

Expected to contain: "current Pi session"
Received: "📋 Plan review: REVISE (iteration 2 of 4)\n  • Tasks none approved\n  • Tasks 1 need revision\n  Next: Transitioning to revise mode. A new review session will start."
```
Keep both verdict fixtures and the no-flag assertion.

**Step 3 — Write minimal implementation**
Replace the existing interface and these two function bodies with the complete code below. Keep every other symbol and import unchanged.

```ts
export interface PlanReviewResult {
  message?: string;
  error?: string;
}

export function handlePlanReview(cwd: string, params: PlanReviewParams): PlanReviewResult {
  const state = readState(cwd);

  if (state.phase !== "plan") {
    return { error: "❌ plan_review: not in plan phase. Submit during plan review." };
  }

  if (state.planMode !== "review") {
    return { error: `❌ plan_review: not in review mode (got planMode '${state.planMode}'). Submit during plan review.` };
  }

  const slug = state.activeIssue!;

  // Gate: revise verdict requires revise-instructions file (AC5, AC6)
  if (params.verdict === "revise") {
    const filename = `revise-instructions-${state.planIteration}.md`;
    const filepath = join(cwd, ".megapowers", "plans", slug, filename);
    if (!existsSync(filepath)) {
      return {
        error: composeMessage({
          icon: "error",
          summary: `plan_review: missing revise-instructions file at ${filepath}`,
          nextStep: `Write the ${filename} file before submitting a revise verdict.`,
        }),
      };
    }
  }
  const approvedIds = params.approved_tasks ?? [];
  const needsRevisionIds = params.needs_revision_tasks ?? [];

  const review: PlanReview = {
    type: "plan-review",
    iteration: state.planIteration,
    verdict: params.verdict,
    reviewed_tasks: [...approvedIds, ...needsRevisionIds],
    approved_tasks: approvedIds,
    needs_revision_tasks: needsRevisionIds,
  };
  if (params.verdict === "revise") {
    const orchestrated = transitionReviewToRevise(
      state,
      approvedIds,
      needsRevisionIds,
      MAX_PLAN_ITERATIONS,
    );
    if (!orchestrated.ok) {
      return { error: orchestrated.error };
    }
    writePlanReview(cwd, slug, review, params.feedback);
    updateTaskStatuses(cwd, slug, approvedIds, "approved");
    updateTaskStatuses(cwd, slug, needsRevisionIds, "needs_revision");
    writeState(cwd, orchestrated.value.nextState);
    return {
      message: orchestrated.value.message,
    };
  }

  writePlanReview(cwd, slug, review, params.feedback);
  updateTaskStatuses(cwd, slug, approvedIds, "approved");
  updateTaskStatuses(cwd, slug, needsRevisionIds, "needs_revision");
  return handleApproveVerdict(cwd, state, slug);
}

function handleApproveVerdict(
  cwd: string,
  state: ReturnType<typeof readState>,
  slug: string,
): PlanReviewResult {
  const tasks = listPlanTasks(cwd, slug);
  const derivedTasks = deriveTasks(cwd, slug);
  const orchestrated = approvePlan(state, tasks, derivedTasks, (currentState, nextTasks) =>
    transition(currentState, "implement" as Phase, nextTasks),
  );

  if (!orchestrated.ok) {
    return { error: orchestrated.error };
  }

  updateTaskStatuses(
    cwd,
    slug,
    orchestrated.value.statusUpdates.map((update) => update.taskId),
    "approved",
  );
  const planDir = join(cwd, ".megapowers", "plans", slug);
  writeFileSync(join(planDir, "plan.md"), orchestrated.value.legacyPlanMd);
  writeState(cwd, orchestrated.value.nextState);
  return {
    message: composeMessage({
      icon: "success",
      summary: `Plan approved (iteration ${state.planIteration})`,
      changes: [`All ${tasks.length} tasks approved`],
      artifactPath: `.megapowers/plans/${slug}/plan.md`,
      nextStep: "Advancing to implement phase.",
    }),
  };
}
```

In `extensions/megapowers/plan-orchestrator.ts`, inside `transitionReviewToRevise(state: MegapowersState, approvedIds: number[], needsRevisionIds: number[], maxIterations: number): OrchestratorResult<PlanTransitionResult>`, replace ONLY:
```ts
        nextStep: "Transitioning to revise mode. A new review session will start.",
```
with:
```ts
        nextStep: "Revise mode is active in the current Pi session. Update the tasks using the review feedback.",
```
Do not overwrite the whole file: sequential execution preserves Task 2's correction to `transitionDraftToReview`. This edit targets an independent existing function, so dependency `[depends: 1]` remains valid. Preserve iteration limits, iteration increment, status updates, feedback artifacts, and approve behavior.

In the two existing tests currently titled `sets triggerNewSession flag on revise` and `returns triggerNewSession on approve`, retain their fixtures and other assertions but replace:
```ts
expect(result.triggerNewSession).toBe(true);
```
with:
```ts
expect(result.error).toBeUndefined();
expect(result).not.toHaveProperty("triggerNewSession");
```
Rename those tests to `omits session-reset instructions on revise` and `omits session-reset instructions on approve`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-review.test.ts -t "plan-review session policy"`
Expected: PASS. Also run `bun test tests/tool-plan-review.test.ts tests/plan-orchestrator.test.ts` to retain all review/state/gate coverage and unchanged orchestrator behavior.

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing.

### Task 4: Describe session-preserving transitions [depends: 1]

### Task 4: Describe session-preserving transitions [depends: 1]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Modify: `tests/register-tools.test.ts`

Covers Fixed When 7's model-facing policy. Registration still has the verified signature `registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void`; this task changes descriptions, not schemas, tool names, state handlers, or execution semantics.

**Step 1 — Write the failing test**
Append this complete block to `tests/register-tools.test.ts`, whose existing imports already supply all four symbols it uses.

```ts
describe("tool session descriptions", () => {
  it("transition tools describe preservation rather than automatic fresh sessions", () => {
    const tools: Record<string, any> = {};
    registerTools({ registerTool: (tool: any) => { tools[tool.name] = tool; } } as any, {});
    for (const name of ["megapowers_signal", "megapowers_plan_review"]) {
      expect(tools[name].description).toContain("preserves the current Pi session");
      expect(tools[name].description).not.toMatch(/starts a new session|fresh session/i);
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts -t "tool session descriptions"`
Expected: FAIL. An actual registerTools probe emitted:
```text
error: expect(received).toContain(expected)

Expected to contain: "preserves the current Pi session"
```
The received current signal description includes `plan_draft_done ... starts a new session`. Task 1 does not modify descriptions, so this remains RED after its repair.

**Step 3 — Write minimal implementation**
Replace ONLY the signal tool's description property with:
```ts
description: "Signal a megapowers state transition. Every action preserves the current Pi session. Actions: task_done (mark current implement task complete), plan_draft_done (signal draft is complete — transitions planMode from draft/revise to review), phase_next (advance to the next workflow phase), phase_back (go back one phase — e.g. verify→implement, code-review→implement; errors if no backward transition exists), tests_failed (mark RED after a failing test run), tests_passed (acknowledge GREEN after a passing test run), close_issue (mark issue as done, reset workflow state — done phase only).",
```
Replace ONLY the review tool's description property with:
```ts
description: "Submit plan review verdict. Approves the plan or requests revisions with per-task feedback. This preserves the current Pi session.",
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts -t "tool session descriptions"`
Expected: PASS.

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing; existing registration/schema tests remain intact.

### Task 5: Document the current session policy [no-test] [depends: 1, 2, 3, 4]

### Task 5: Document the current session policy [no-test] [depends: 1, 2, 3, 4]

**Justification:** Documentation-only corrections for an explicitly chosen compatibility policy; no new runtime behavior. Observable behavior is tested in Tasks 1–4.

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `.megapowers/docs/080-clean-context-windows.md`

Covers Fixed When 7 and supplies operator guidance for 8. All three files were inspected before planning.

**Step 1 — Make the change**
In README's plan-loop list, replace the complete submit item:
```md
2. **Submit** — `megapowers_signal({ action: "plan_draft_done" })` → enters review mode in the current Pi session
```
Immediately after that plan-loop list, add:
```md
### Session boundaries

Megapowers phase, task, and plan-review transitions preserve the current Pi session. They update workflow state without automatically clearing history or starting a fresh agent runtime.

For a fresh context window, use Pi's `/new` command between agent runs. Workflow state and artifacts remain on disk, so the next agent start builds context for the current phase/task. This context is injected at agent start, not on every follow-up model request inside an existing run.

After updating the extension, reload it before testing transitions. A session already corrupted by an older version may need a one-time `/new`; this fix prevents new corruption but does not repair historical transcripts.
```

In AGENTS.md, replace the submit-draft instruction with:
```md
- **Submit draft:** `megapowers_signal({ action: "plan_draft_done" })` → enters review mode in the current Pi session
```
Add this key-concept bullet:
```md
- **Session boundaries:** workflow tools preserve the current Pi session. Fresh context is user-initiated with `/new` between runs; the next agent start rebuilds phase/task context from disk. Never reset a raw/read-only session manager from a tool or lifecycle hook.
```

Replace the entire historical #080 document with:
```md
# Historical Feature: Clean Context Windows (#080)

> Superseded by #130 for session handling. This document records historical intent, not the current session API contract.

#080 aimed to give each phase/task a focused context window. Its implementation called the underlying session manager's newSession() during model-tool execution. That reset changed storage without replacing the agent runtime and split persisted tool calls from their results. Pi's canonical session projection exposed the resulting invalid provider history.

Current policy after #130:
- Megapowers transition tools preserve the current Pi session and its transcript.
- They continue to update workflow state, gates, task completion, and plan-review artifacts.
- Fresh sessions are user-initiated with Pi's /new command between runs, not automatic side effects of workflow tools.
- Workflow state and artifacts remain on disk; the next agent start builds context from that current state.
- Context injection occurs at agent start, not before every follow-up provider request inside an already-running tool loop.
- No raw/read-only session-manager mutation, command-only session API invoked from a tool, or deferred-reset workaround is supported.

The historical done-phase/close_issue cleanup shipped with #080 remains separate from this session-compatibility correction. TypeScript casts do not fail at runtime or make mutating a read-only API safe.

```

Do not edit immutable past plans, completed-issue acceptance criteria, or auto-generated prompt-assembler caches. Do not add automatic context-reset promises elsewhere.

**Step 2 — Verify**
Use `read` on all three files and `grep` for `new session|fresh session|triggerNewSession|newSession` over current extension code, README, AGENTS, and the #080 document. Expected: runtime producers/consumers are gone, active guidance consistently states preservation, and any historical mention explicitly explains the superseded behavior. String-key negative tests and issue artifacts are allowed to mention the removed flag.

Run: `bun test`
Expected: all passing.

Ask the plan/code reviewer (fresh context when available) to check that docs make no claim of phase-prompt reinjection inside the current run and do not recommend a tool-side or hook-side replacement API. Read-only review is sufficient; no new subagent infrastructure is needed.

### Task 6: Document compatibility smoke checks [no-test] [depends: 1, 2, 3, 4, 5]

### Task 6: Document compatibility smoke checks [no-test] [depends: 1, 2, 3, 4, 5]

**Justification:** Verification documentation only: adds a reproducible operator guide, not a new extension function, runtime dependency, or production behavior. Runtime regressions are tested in Tasks 1–4; provider-dependent validation cannot be a mandatory pure unit test.

**Files:**
- Create: `docs/session-compatibility.md`

Covers Fixed When 6 and 8 and the self-hosted reload constraint. The installed CLI docs were checked: explicit --extension paths still load with --no-extensions; --tools names the complete active set; --session-dir isolates persistence; --model accepts provider/id; --print exits after the supplied prompt. No SDK initialization API is assumed.

**Step 1 — Make the change**
Create this COMPLETE document:

````md
# Session compatibility verification

Megapowers transition tools must preserve the current Pi session. These checks are for #130 and later compatibility updates. Run from the pi-megapowers repository root with Bun. All workflow fixtures and session files below are temporary and removed in finally; never point the fixture cwd at a real project.

## Automated regressions

Run `bun test`. The persistence tests cover phase/task transitions, review verdicts, errors, non-transition signals, sibling result orders, nested outer-call pairing, and updated context at the next agent start.

## Installed-host offline check

Set PI_SESSION_MANAGER_MODULE to the installed Pi dist/core/session-manager.js. On the reproduction machine this is /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js. This check invokes the actual registered tool against the real manager and projects canonical context, without provider access.

Copy the following complete command into a Bun-capable shell from the repository root:

```sh
PI_SESSION_MANAGER_MODULE=/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js bun -e '
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { registerTools } from "./extensions/megapowers/register-tools.ts";
import { createInitialState } from "./extensions/megapowers/state/state-machine.ts";
import { writeState, readState } from "./extensions/megapowers/state/state-io.ts";

const cwd = mkdtempSync(join(tmpdir(), "megapowers-compatibility-"));
try {
  writeState(cwd, { ...createInitialState(), activeIssue: "001-smoke", workflow: "feature", phase: "brainstorm" });
  mkdirSync(join(cwd, ".megapowers", "issues"), { recursive: true });
  writeFileSync(join(cwd, ".megapowers", "issues", "001-smoke.md"),
    "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Smoke\nDisposable fixture");
  let transcripts: any[][];
  let sessionIdChanged = false;
  if (process.env.MEGA_SMOKE_MODEL) {
    const sessions = join(cwd, "sessions");
    const args = ["--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files",
      "--extension", resolve("extensions/megapowers/index.ts"),
      "--session-dir", sessions, "--tools", "read,megapowers_signal",
      "--model", process.env.MEGA_SMOKE_MODEL, "--print"];
    if (process.env.MEGA_SMOKE_PROVIDER_EXTENSION) {
      args.push("--extension", process.env.MEGA_SMOKE_PROVIDER_EXTENSION);
    }
    args.push("Call megapowers_signal with action phase_next exactly once. After receiving its result, call read on .megapowers/issues/001-smoke.md. Do not call any other transition. Finally reply SESSION_SMOKE_OK.");
    const run = spawnSync("pi", args, { cwd, encoding: "utf8", timeout: 90000 });
    if (run.error || run.status !== 0) throw new Error(JSON.stringify({ status: run.status, error: String(run.error ?? ""), stderr: run.stderr }));
    const files = readdirSync(sessions).filter(f => f.endsWith(".jsonl"));
    sessionIdChanged = files.length !== 1;
    transcripts = files.map(f => readFileSync(join(sessions, f), "utf8").trim().split("\n")
      .map(line => JSON.parse(line)).filter(e => e.type === "message").map(e => e.message));
    const results = transcripts.flat().filter(m => m.role === "toolResult");
    if (results.filter(m => m.toolName === "megapowers_signal").length !== 1 ||
        !results.some(m => m.toolName === "read") || !run.stdout.includes("SESSION_SMOKE_OK")) {
      throw new Error("Live smoke did not complete the requested transition and follow-up read");
    }
  } else {
    const modulePath = process.env.PI_SESSION_MANAGER_MODULE;
    if (!modulePath) throw new Error("Set PI_SESSION_MANAGER_MODULE to the installed Pi dist/core/session-manager.js");
    const { SessionManager } = await import(pathToFileURL(modulePath).href);
    const manager = SessionManager.inMemory(cwd);
    const oldId = manager.getSessionId();
    const id = "call_compatibility_smoke";
    manager.appendMessage({ role: "user", content: "Continue", timestamp: 0 });
    manager.appendMessage({ role: "assistant",
      content: [{ type: "toolCall", id, name: "megapowers_signal", arguments: { action: "phase_next" } }],
      api: "openai-responses", provider: "openai", model: "offline", stopReason: "toolUse", timestamp: 1,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });
    const tools: Record<string, any> = {};
    registerTools({ registerTool: (tool: any) => { tools[tool.name] = tool; },
      exec: async () => ({ code: 1, stdout: "", stderr: "" }) } as any, {});
    const result = await tools.megapowers_signal.execute(id, { action: "phase_next" }, undefined, undefined,
      { cwd, hasUI: false, sessionManager: manager });
    manager.appendMessage({ role: "toolResult", toolCallId: id, toolName: "megapowers_signal",
      content: result.content, isError: false, timestamp: 2 });
    sessionIdChanged = manager.getSessionId() !== oldId;
    transcripts = [manager.buildSessionProjection().messages];
  }
  const orphaned = transcripts.flatMap(messages => {
    const calls = new Set(messages.filter(m => m.role === "assistant")
      .flatMap(m => m.content.filter((c: any) => c.type === "toolCall").map((c: any) => c.id)));
    return messages.filter(m => m.role === "toolResult" && !calls.has(m.toolCallId)).map(m => m.toolCallId);
  });
  const errors = transcripts.flat().filter(m => m.role === "assistant" && m.stopReason === "error")
    .map(m => m.errorMessage);
  const report = { mode: process.env.MEGA_SMOKE_MODEL ?? "offline", phase: readState(cwd).phase,
    sessionIdChanged, orphaned, errors };
  console.log(JSON.stringify(report));
  if (report.phase !== "spec" || sessionIdChanged || orphaned.length || errors.length) {
    throw new Error("Session compatibility smoke failed");
  }
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
'
```

Expected offline output: phase spec, sessionIdChanged false, orphaned [], errors []. An external module path unavailable on another machine is an environment limitation, not a passing smoke. Use that machine's installed module path rather than adding Pi to the repo's pure unit-test dependencies.

## Optional live provider checks

The SAME command supports live mode when MEGA_SMOKE_MODEL is set to an actual available provider/model ID. Choose IDs using `pi --list-models`; do not print credentials or use credential-export commands.

Run once with an available OpenAI/OpenAI Codex model and once with an available Anthropic model. If a model's provider comes from an extension rather than built-in Pi, also set MEGA_SMOKE_PROVIDER_EXTENSION to that provider extension's absolute entry point. It is explicitly loaded into an otherwise extension-isolated child process. The user's anthropic-cc provider may require this.

In live mode the command starts a fresh Pi process in its disposable cwd, explicitly loads the corrected extension, requests one gated phase advance followed by a read tool and a final reply, then verifies each persisted session's call/result pairs. Live mode does not use PI_SESSION_MANAGER_MODULE. If run through an agent harness, use its process manager for the potentially long provider checks rather than a shell background job.

Expected live output: selected model ID, phase spec, sessionIdChanged false, orphaned [], errors [], with no tool-call pairing rejection. Each run uses a new temporary fixture; it never repeats task completion in a real project.

Record Bun/Pi versions, model/provider IDs, command result, and the JSON report in the issue's verify.md. Treat unavailable credentials, provider-extension setup, quota, transport errors, or timeout as explicit limitations/failures, not live-provider PASS. Unit/real-manager checks alone do not establish a live Anthropic result.

## Reload and historical-session cautions

After changing local extension source, reload Pi before issuing ANY live Megapowers transition. In this self-hosted issue, do not call task_done through the old loaded runtime after Task 1: ask the user to run /reload first. Verify the signal/review tool descriptions match the corrected session-preserving policy; use /new once if the current transcript is already corrupted.

This fix does not repair historical orphaned transcripts or implement an automatic fresh-context handoff. User-initiated /new between runs remains the supported way to start a clean session; workflow artifacts/state persist separately.

````

**Step 2 — Verify**
Run the offline command printed in the document AFTER Tasks 1–4. Expected: `{"mode":"offline","phase":"spec","sessionIdChanged":false,"orphaned":[],"errors":[]}`; no modification of the active project/session. This smoke imports installed Pi only on explicit request; the repository test suite must not acquire that dependency.

Run: `bun test`
Expected: all passing.

Read the final guide to verify there are no credential-printing steps or live tests against the actual issue workspace. Attempt isolated OpenAI and Anthropic live modes when available, preferably during verify after reloading the corrected runtime. Record each independently in verify.md. If access is unavailable or setup/transport fails, record that limitation and do not label the provider check PASS.

**Self-hosting handoff:** Task 1's source repair does not update already loaded callbacks. Before its first live task_done, ask the user to /reload. Until that reload, do not intentionally invoke known-broken transition tools. Plan submission/review before the fix still carries this limitation; do not bypass review or edit coordination state directly.
