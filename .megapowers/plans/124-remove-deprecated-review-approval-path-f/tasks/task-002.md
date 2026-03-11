---
id: 2
title: Remove review_approve from the megapowers_signal tool surface
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

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
