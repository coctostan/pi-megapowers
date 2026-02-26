## Test Suite Results

Command:
- `bun test`

Result (from this session):
- `659 pass, 0 fail` (Ran 659 tests across 32 files)

## Per-Criterion Verification

### Criterion 1: `megapowers_signal({ action: "phase_back" })` resolves the first `backward: true` transition from the current phase and advances to that target
**Identify:** Unit test of `handleSignal("phase_back")` + code inspection of backward transition resolution.

**Run:**
- `bun test tests/tool-signal.test.ts --test-name-pattern "phase_back"`

**Evidence (test output excerpt):**
- `(pass) handleSignal > phase_back > transitions review → plan (AC1, AC2)`
- `(pass) handleSignal > phase_back > transitions verify → implement (AC3)`
- `(pass) handleSignal > phase_back > transitions code-review → implement (AC4)`

**Evidence (code):** `extensions/megapowers/tools/tool-signal.ts`
- Chooses first backward transition via `.find(...)`:
  - lines 267-270: `config.transitions.find((t) => t.from === state.phase && t.backward === true)`

**Verdict:** pass

### Criterion 2: `phase_back` from `review` transitions to `plan` and clears `reviewApproved` to `false`
**Identify:** Unit tests + code inspection.

**Run:**
- `bun test tests/tool-signal.test.ts --test-name-pattern "phase_back"`

**Evidence (test output excerpt):**
- `(pass) handleSignal > phase_back > transitions review → plan (AC1, AC2)`
- `(pass) handleSignal > phase_back > clears reviewApproved when going back to plan (AC2)`

**Evidence (code):** `extensions/megapowers/tools/tool-signal.ts`
- lines 278-281: when `backwardTransition.to === "plan"` → `writeState(... reviewApproved: false)`

**Verdict:** pass

### Criterion 3: `phase_back` from `verify` transitions to `implement`
**Identify:** Unit test.

**Run:**
- `bun test tests/tool-signal.test.ts --test-name-pattern "phase_back"`

**Evidence (test output excerpt):**
- `(pass) handleSignal > phase_back > transitions verify → implement (AC3)`

**Verdict:** pass

### Criterion 4: `phase_back` from `code-review` transitions to `implement`
**Identify:** Unit test.

**Run:**
- `bun test tests/tool-signal.test.ts --test-name-pattern "phase_back"`

**Evidence (test output excerpt):**
- `(pass) handleSignal > phase_back > transitions code-review → implement (AC4)`

**Verdict:** pass

### Criterion 5: `phase_back` returns an error when no backward transition exists for the current phase (e.g., from `brainstorm`, `spec`, `plan`, `implement`)
**Identify:** Unit tests.

**Run:**
- `bun test tests/tool-signal.test.ts --test-name-pattern "phase_back"`

**Evidence (test output excerpt):**
- `(pass) ... returns error from brainstorm — no backward transition (AC5)`
- `(pass) ... returns error from spec — no backward transition (AC5)`
- `(pass) ... returns error from plan — no backward transition (AC5)`
- `(pass) ... returns error from implement — no backward transition (AC5)`

**Verdict:** pass

### Criterion 6: `phase_back` returns an error when called from any bugfix workflow phase (no backward transitions defined in bugfix config)
**Identify:** Unit test.

**Run:**
- `bun test tests/tool-signal.test.ts --test-name-pattern "phase_back"`

**Evidence (test output excerpt):**
- `(pass) ... returns error for bugfix workflow phases (AC6)`

**Verdict:** pass

### Criterion 7: `phase_next` default target resolution skips transitions marked `backward: true`
**Identify:** Unit tests + code inspection of default target resolution.

**Run:**
- `bun test tests/phase-advance.test.ts --test-name-pattern "skip backward|AC7"`

**Evidence (test output excerpt):**
- `(pass) ... from verify, default target is code-review (skips backward implement)`
- `(pass) ... from code-review, default target is done (skips backward implement)`
- `(pass) ... from review, default target is implement (skips backward plan)`

**Evidence (code):** `extensions/megapowers/policy/phase-advance.ts`
- lines 32-37: `forwardTransition = ...find(t => t.from === state.phase && !t.backward)` then `target = forwardTransition?.to ...`

**Verdict:** pass

### Criterion 8: Existing `phase_next` behavior is preserved (gates evaluated, jj operations fire, forward transitions work)
**Identify:** Unit tests that exercise gate failures and jj integration.

**Run:**
- `bun test tests/phase-advance.test.ts --test-name-pattern "AC8|gate|jj integration"`

**Evidence (test output excerpt):**
- `(pass) ... spec → plan gate still rejects without spec.md`
- `(pass) ... review → implement gate still rejects without reviewApproved`
- `(pass) ... jj integration > returns ok when jj is provided...`
- `(pass) ... jj integration > squashes task changes when advancing to done...`

**Verdict:** pass

### Criterion 9: `onAgentEnd` no longer calls `handlePhaseTransition` (no blocking `ctx.ui.select()` popup)
**Identify:** Code inspection + grep for removed handler.

**Run:**
- `rg -n "handlePhaseTransition" extensions/megapowers || echo "no matches"`

**Evidence:** output: `no matches`

**Evidence (code):** `extensions/megapowers/hooks.ts`
- lines 110-144: `onAgentEnd(...)` only does done-phase artifact capture + `ui.renderDashboard(...)`.
- line 140 comment: `// Refresh dashboard after agent turn (AC9, AC10 — no blocking popup)`

**Verdict:** pass

### Criterion 10: `onAgentEnd` no longer calls `handleDonePhase` (no blocking done-phase menu)
**Identify:** Code inspection + grep.

**Run:**
- `rg -n "handleDonePhase" extensions/megapowers || echo "no matches"`

**Evidence:** output: `no matches`

**Evidence (code):** `extensions/megapowers/hooks.ts` lines 110-144 (no done-phase menu UI calls).

**Verdict:** pass

### Criterion 11: Entering `done` phase shows a checklist widget via `ctx.ui.custom()` with wrap-up actions
**Identify:** Wiring in `register-tools.ts` (trigger on `phase_next` → done) + checklist UI implementation.

**Evidence (code):**
- `extensions/megapowers/register-tools.ts` lines 41-47: after successful `phase_next`, if `currentState.phase === "done"` → `await showDoneChecklist(ctx, ctx.cwd)`
- `extensions/megapowers/ui.ts` lines 89-104: `showDoneChecklist()` calls `showChecklistUI(...)`
- `extensions/megapowers/ui-checklist.ts` line 32: `return ctx.ui.custom(...)`

**Evidence (test output excerpt):** from `bun test tests/ui.test.ts --test-name-pattern "getDoneChecklistItems|showDoneChecklist|doneActions API cleanup"`
- `(pass) showDoneChecklist (AC11, AC13, AC14) ...`

**Verdict:** pass

### Criterion 12: All done-checklist items default to checked
**Identify:** Unit tests for `getDoneChecklistItems`.

**Run:**
- `bun test tests/ui.test.ts --test-name-pattern "getDoneChecklistItems"`

**Evidence (test output excerpt):**
- `(pass) getDoneChecklistItems (AC12) > feature workflow: ... all defaultChecked`

**Verdict:** pass

### Criterion 13: Submitting the done checklist stores selected action keys as `doneActions: string[]` in state
**Identify:** Unit test + code inspection.

**Evidence (test output excerpt):**
- `(pass) showDoneChecklist (AC11, AC13, AC14) > stores all default-checked keys ... (AC13)`

**Evidence (code):** `extensions/megapowers/ui.ts`
- lines 95-104: `selectedKeys = await showChecklistUI(...)` then `doneActions = selectedKeys ?? []` then `writeState(... doneActions)`

**Verdict:** pass

### Criterion 14: Dismissing the done checklist stores `doneActions: []`
**Identify:** Unit test + code inspection.

**Evidence (test output excerpt):**
- `(pass) showDoneChecklist (AC11, AC13, AC14) > stores empty doneActions when ctx.ui.custom resolves with null (Escape) (AC14)`

**Evidence (code):** `extensions/megapowers/ui.ts` lines 101-104 (`selectedKeys ?? []`).

**Verdict:** pass

### Criterion 15: `doneMode` replaced with `doneActions: string[]` (default `[]`)
**Identify:** Type definition + grep.

**Run:**
- `rg -n "doneMode" extensions/megapowers || echo "no matches"`

**Evidence:** output: `no matches`

**Evidence (code):** `extensions/megapowers/state/state-machine.ts`
- line 52: `doneActions: string[];`
- lines 70-86: `createInitialState()` initializes `doneActions: []`

**Verdict:** pass

### Criterion 16: Done-phase prompt template reads `doneActions` and instructs sequential execution
**Identify:** Unit tests for prompt injection + code inspection.

**Run:**
- `bun test tests/prompt-inject.test.ts --test-name-pattern "done phase — doneActions"`

**Evidence (test output excerpt):**
- `(pass) done phase — doneActions prompt injection (AC16, AC17) > injects done template listing selected actions ...`

**Evidence (code):** `extensions/megapowers/prompt-inject.ts`
- lines 111-119: builds `vars.done_actions_list` from `state.doneActions` and injects `done` template.

**Evidence (template):** `prompts/done.md`
- line 1: `Execute each selected action in order.`
- lines 20-25: includes `{{done_actions_list}}`

**Verdict:** pass

### Criterion 17: Done actions are agent-driven based on `doneActions`
**Identify:** Done prompt contains explicit action instructions + prompt injection tests cover required instructions.

**Evidence (template):** `prompts/done.md`
- lines 28-59: action-specific instructions (generate docs, write changelog, capture learnings via `megapowers_save_artifact`, squash via bash, close issue).

**Evidence (tests):** `tests/prompt-inject.test.ts` doneActions prompt injection cases include instruction checks:
- `(pass) ... instructs capture-learnings to use megapowers_save_artifact with phase learnings (AC17)`
- `(pass) ... instructs close-issue with explicit steps (AC17)`

**Verdict:** pass

### Criterion 18: `megapowers-protocol.md` documents `phase_back`
**Identify:** File inspection.

**Evidence:** `prompts/megapowers-protocol.md` line 8 documents `{ action: "phase_back" }`.

**Verdict:** pass

### Criterion 19: `verify.md` instructs calling `megapowers_signal({ action: "phase_back" })`
**Identify:** File inspection.

**Evidence:** `prompts/verify.md` line 80.

**Verdict:** pass

### Criterion 20: `code-review.md` instructs calling `phase_back` (no `/phase implement` or `/phase plan` references)
**Identify:** File inspection + grep for `/phase`.

**Run:**
- `rg -n "\\/phase" prompts/code-review.md || echo "no matches"`

**Evidence:** output: `no matches`

**Evidence:** `prompts/code-review.md` line 111: `Call megapowers_signal({ action: "phase_back" })`.

**Verdict:** pass

### Criterion 21: `review-plan.md` instructs using `phase_back` when plan needs rework
**Identify:** File inspection.

**Evidence:** `prompts/review-plan.md` line 85.

**Verdict:** pass

### Criterion 22: `handlePhaseTransition` removed from `ui.ts` and `MegapowersUI`
**Identify:** Grep + interface inspection.

**Run:**
- `rg -n "handlePhaseTransition" extensions/megapowers || echo "no matches"`

**Evidence:** output: `no matches`

**Evidence:** `extensions/megapowers/ui.ts` `MegapowersUI` interface (lines 216-235) has no `handlePhaseTransition`.

**Verdict:** pass

### Criterion 23: `handleDonePhase` removed from `ui.ts` and `MegapowersUI`
**Identify:** Grep + interface inspection.

**Run:**
- `rg -n "handleDonePhase" extensions/megapowers || echo "no matches"`

**Evidence:** output: `no matches`

**Evidence:** `extensions/megapowers/ui.ts` `MegapowersUI` interface (lines 216-235) has no `handleDonePhase`.

**Verdict:** pass

### Criterion 24: `DONE_MODE_LABELS` constant removed from `ui.ts`
**Identify:** Grep.

**Run:**
- `rg -n "DONE_MODE_LABELS" extensions/megapowers || echo "no matches"`

**Evidence:** output: `no matches`

**Verdict:** pass

### Criterion 25: No remaining references to `doneMode` in extension code (replaced by `doneActions`)
**Identify:** Grep restricted to extension source.

**Run:**
- `rg -n "doneMode" extensions/megapowers || echo "no matches"`

**Evidence:** output: `no matches`

**Verdict:** pass

## Overall Verdict

pass

All acceptance criteria are met, and the full test suite passes (659/659).