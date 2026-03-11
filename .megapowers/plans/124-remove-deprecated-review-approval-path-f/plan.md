# Plan

### Task 1: Route review approval instructions through megapowers_plan_review

### Task 1: Route review approval instructions through megapowers_plan_review
**Covers:** AC1, AC2, AC6
**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`
**Step 1 — Write the failing test**
Add this test inside `describe("buildInjectedPrompt — plan mode routing", () => { ... })` in `tests/prompt-inject.test.ts`:
```ts
  it("review mode routes approval through megapowers_plan_review instead of phase_next", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_plan_review");
    expect(result).not.toContain('Then call `megapowers_signal` with action `"phase_next"` to advance.');
    expect(result).not.toContain('writing it to `.megapowers/plans/001-test/plan.md`');
  });
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts -t "review mode routes approval through megapowers_plan_review instead of phase_next"`
Expected: FAIL — `expect(received).not.toContain(expected)` because the injected plan-review prompt still appends the generic derived tool instructions: `Then call \`megapowers_signal\` with action \`"phase_next"\` to advance.` and `writing it to \`.megapowers/plans/001-test/plan.md\``.
**Step 3 — Write minimal implementation**
In `extensions/megapowers/prompt-inject.ts`, update the phase-specific tool-instruction block so review-mode plan prompts do not append the generic artifact/phase-next guidance:
```ts
  // Phase-specific tool instructions derived from config (AC42)
  const suppressDerivedToolInstructions =
    state.phase === "plan" && state.planMode === "review";

  if (!suppressDerivedToolInstructions && state.workflow && state.phase) {
    const config = getWorkflowConfig(state.workflow);
    const phaseConfig = config.phases.find(p => p.name === state.phase);
    if (phaseConfig) {
      const isTerminal = config.phases[config.phases.length - 1].name === state.phase;
      const toolInstructions = deriveToolInstructions(phaseConfig, state.activeIssue, { isTerminal });
      if (toolInstructions) parts.push(toolInstructions.trim());
    }
  }
```
This preserves the existing `prompts/review-plan.md` / `prompts/megapowers-protocol.md` guidance that already instructs approval via `megapowers_plan_review`, while removing the conflicting live `plan.md` / `phase_next` instructions from review mode.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts -t "review mode routes approval through megapowers_plan_review instead of phase_next"`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Remove review_approve from the megapowers_signal tool surface

### Task 2: Remove review_approve from the megapowers_signal tool surface

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**
Add this test inside `describe("megapowers_signal schema", () => { ... })` in `tests/tool-signal.test.ts`:
```ts
    it("does not advertise review_approve while the low-level deprecation error remains", () => {
      const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");

      expect(toolsSource).not.toContain('Type.Literal("review_approve")');
      expect(toolsSource).not.toContain("Note: review_approve is deprecated");

      const result = handleSignal(tmp, "review_approve");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("deprecated");
      expect(result.error).toContain("megapowers_plan_review");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "does not advertise review_approve while the low-level deprecation error remains"`
Expected: FAIL — `expect(received).not.toContain(expected)` because `extensions/megapowers/register-tools.ts` still contains `Type.Literal("review_approve")` and the deprecation note in the tool description.

**Step 3 — Write minimal implementation**
Update the `megapowers_signal` registration in `extensions/megapowers/register-tools.ts` so the description and schema no longer advertise `review_approve`:
```ts
  pi.registerTool({
    name: "megapowers_signal",
    label: "Megapowers Signal",
    description:
      "Signal a megapowers state transition. Actions: task_done (mark current implement task complete), plan_draft_done (signal draft is complete — transitions planMode from draft/revise to review and starts a new session), phase_next (advance to the next workflow phase), phase_back (go back one phase — e.g. verify→implement, code-review→implement; errors if no backward transition exists), tests_failed (mark RED after a failing test run), tests_passed (acknowledge GREEN after a passing test run), close_issue (mark issue as done, reset state — done phase only).",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("task_done"),
        Type.Literal("phase_next"),
        Type.Literal("phase_back"),
        Type.Literal("tests_failed"),
        Type.Literal("tests_passed"),
        Type.Literal("plan_draft_done"),
        Type.Literal("close_issue"),
      ]),
      target: Type.Optional(Type.String({ description: "Target phase for phase_next (enables backward transitions)" })),
    }),
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
      if (result.triggerNewSession) {
        (ctx.sessionManager as any)?.newSession?.();
      }

      if (ctx.hasUI) {
        ui.renderDashboard(ctx, readState(ctx.cwd), store);
      }
      return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
    },
  });
```
Do not change `extensions/megapowers/tools/tool-signal.ts`; the low-level `handleSignal(cwd, "review_approve")` deprecation error should remain intact.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "does not advertise review_approve while the low-level deprecation error remains"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Remove the deprecated /review approve command surface

### Task 3: Remove the deprecated /review approve command surface

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Modify: `extensions/megapowers/commands.ts`
- Test: `tests/mp-existing-commands.test.ts`

**Step 1 — Write the failing test**
Replace the contents of `tests/mp-existing-commands.test.ts` with:
```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("/mp registration compatibility", () => {
  it("keeps active standalone commands while removing deprecated /review", () => {
    const indexSource = readFileSync(join(process.cwd(), "extensions", "megapowers", "index.ts"), "utf-8");
    const commandsSource = readFileSync(join(process.cwd(), "extensions", "megapowers", "commands.ts"), "utf-8");

    expect(indexSource).toContain('pi.registerCommand("mp"');

    for (const cmd of ["mega", "issue", "triage", "phase", "done", "learn", "tdd", "task"]) {
      expect(indexSource).toContain(`pi.registerCommand("${cmd}"`);
    }

    expect(indexSource).not.toContain('pi.registerCommand("review"');
    expect(indexSource).not.toContain("handleReviewCommand");
    expect(commandsSource).not.toContain("export async function handleReviewCommand");
    expect(commandsSource).not.toContain('handleSignal(ctx.cwd, "review_approve")');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-existing-commands.test.ts -t "keeps active standalone commands while removing deprecated /review"`
Expected: FAIL — `expect(received).not.toContain(expected)` because `extensions/megapowers/index.ts` still registers `pi.registerCommand("review")` and `extensions/megapowers/commands.ts` still exports `handleReviewCommand` that calls `handleSignal(ctx.cwd, "review_approve")`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/index.ts`, remove `handleReviewCommand` from the command-handler import and delete the entire `/review` registration block so the import section becomes:
```ts
import {
  ensureDeps,
  handleMegaCommand, handleIssueCommand, handleTriageCommand,
  handlePhaseCommand, handleDoneCommand, handleLearnCommand,
  handleTddCommand, handleTaskCommand,
  type RuntimeDeps,
} from "./commands.js";
```

Keep the rest of the file unchanged, with the last command registration now being `/task`.

In `extensions/megapowers/commands.ts`, delete the entire deprecated handler at the end of the file:
```ts
export async function handleReviewCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim();

  if (sub === "approve") {
    const result = handleSignal(ctx.cwd, "review_approve");
    if (result.error) {
      if (ctx.hasUI) ctx.ui.notify(result.error, "error");
    } else {
      if (ctx.hasUI) ctx.ui.notify(result.message ?? "Review approved.", "info");
    }
    return;
  }

  if (ctx.hasUI) ctx.ui.notify("Usage: /review approve", "info");
}
```
Do not replace it with another command; this issue removes the deprecated command surface entirely.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-existing-commands.test.ts -t "keeps active standalone commands while removing deprecated /review"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
