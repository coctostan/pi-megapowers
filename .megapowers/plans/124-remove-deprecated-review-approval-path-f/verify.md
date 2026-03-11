# Verification Report — Issue #124: Remove Deprecated review_approve Path

## Test Suite Results

```
799 pass
0 fail
1886 expect() calls
Ran 799 tests across 77 files. [957.00ms]
```

All tests pass. No failures, no skips.

## Per-Criterion Verification

### Criterion 1: Active workflow or prompt instruction generation does not tell the model to approve a plan by calling `megapowers_signal({ action: "review_approve" })`

**Evidence:**
- `grep "review_approve" prompts/` → only match is `prompts/megapowers-protocol.md:15` which says `Do **not** use { action: "review_approve" } (deprecated).` — this is a warning *against* using it, not an instruction *to* use it.
- `prompts/review-plan.md` (the active review template) contains no mention of `review_approve`; lines 116-129 direct approval through `megapowers_plan_review`.
- `grep "needsReviewApproval: true" extensions/megapowers/` → 0 matches. The dead code branch in `tool-instructions.ts:25` that would generate `review_approve` instructions is unreachable because no workflow phase sets `needsReviewApproval: true`.
- Test `workflow-configs.test.ts:291`: `"feature workflow has no review phase (no review_approve path)"` — passes.

**Verdict:** pass

### Criterion 2: Active prompt instruction generation directs approval through `megapowers_plan_review`

**Evidence:**
- `prompts/review-plan.md` lines 116, 119, 129 contain `megapowers_plan_review` — the active review template explicitly instructs using `megapowers_plan_review({ verdict: "approve", ... })` and `megapowers_plan_review({ verdict: "revise", ... })`.
- `prompts/megapowers-protocol.md:15` warns against `review_approve` and the protocol header describes `megapowers_plan_review` as the correct tool.
- Test `prompt-inject.test.ts` verifies review prompt routes through `megapowers_plan_review`.

**Verdict:** pass

### Criterion 3: The registered `megapowers_signal` tool schema does not include `review_approve` as an allowed action value

**Evidence:**
- `grep "review_approve" extensions/megapowers/register-tools.ts` → 0 matches.
- `register-tools.ts:21-28` defines the action union as: `task_done`, `phase_next`, `phase_back`, `tests_failed`, `tests_passed`, `plan_draft_done`, `close_issue` — no `review_approve`.
- `register-tools.ts:19` description string does not mention `review_approve`.
- Test `tool-signal.test.ts:711-715`: `"does not advertise review_approve while the low-level deprecation error remains"` — asserts `toolsSource` does not contain `Type.Literal("review_approve")` or `"Note: review_approve is deprecated"`. Passes.

**Verdict:** pass

### Criterion 4: The active review command surface does not support `/review approve`

**Evidence:**
- `grep "review.*approve" extensions/megapowers/commands.ts` → 0 matches.
- Test `mp-existing-commands.test.ts:16-19`:
  - `expect(indexSource).not.toContain('pi.registerCommand("review"')` — passes
  - `expect(indexSource).not.toContain("handleReviewCommand")` — passes
  - `expect(commandsSource).not.toContain("export async function handleReviewCommand")` — passes
  - `expect(commandsSource).not.toContain('handleSignal(ctx.cwd, "review_approve")')` — passes

**Verdict:** pass

### Criterion 5: Calling `handleSignal(cwd, "review_approve")` still returns a deprecation error

**Evidence:**
- `tool-signal.ts:232-237` contains the deprecation handler returning: `"❌ review_approve is deprecated. Plan review is now handled by the megapowers_plan_review tool within the plan phase."`
- Test `tool-signal.test.ts:252-255`: `"review_approve deprecation"` test calls `handleSignal(tmp, "review_approve")` and verifies error response. Passes.
- Test `tool-signal.test.ts:717`: Also calls `handleSignal(tmp, "review_approve")` and verifies the deprecation error still works. Passes.

**Verdict:** pass

### Criterion 6: Automated tests cover active instruction surface, tool registration surface, command surface, and low-level deprecation path

**Evidence:**
- **Instruction surface:** `workflow-configs.test.ts:291` — verifies no review phase exists in feature workflow (so `review_approve` instructions are never generated).
- **Tool registration surface:** `tool-signal.test.ts:711-715` — verifies `register-tools.ts` source doesn't contain `Type.Literal("review_approve")`.
- **Command surface:** `mp-existing-commands.test.ts:16-19` — verifies no `/review` command registered, no `handleReviewCommand` exported, no `handleSignal(ctx.cwd, "review_approve")` in commands.
- **Low-level deprecation:** `tool-signal.test.ts:252-255` — verifies `handleSignal(cwd, "review_approve")` returns deprecation error.
- **Prompt routing:** `prompt-inject.test.ts` — verifies review prompt uses `megapowers_plan_review`.
- All 167 tests in the 4 relevant test files pass with 0 failures.

**Verdict:** pass

## Overall Verdict

**PASS**

All 6 acceptance criteria are met with direct evidence from code inspection and test execution. The deprecated `review_approve` path has been removed from all active surfaces (tool schema, prompt templates, command wiring) while the low-level deprecation error is preserved for stale callers. Comprehensive regression tests cover all surfaces. 799/799 tests pass.
