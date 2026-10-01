---
id: 1
title: Preserve transition tool transcripts
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
  - tests/new-session-wiring.test.ts
files_to_create: []
---

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
