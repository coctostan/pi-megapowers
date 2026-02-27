## Test Suite Results

**Command:** `bun test`
**Output:** 679 pass, 0 fail across 34 files [381ms]

All tests pass cleanly.

---

## Per-Criterion Verification

### Criterion 1: `buildInjectedPrompt()` returns non-null content when `state.megaEnabled` is true and `state.activeIssue` is null.
**Evidence:** `tests/prompt-inject.test.ts` — `buildInjectedPrompt — idle mode > returns non-null when megaEnabled is true and no active issue (AC1)` — PASS (0.51ms). Implementation confirmed in `extensions/megapowers/prompt-inject.ts`: `if (!state.megaEnabled) return null; if (!state.activeIssue || !state.phase) { return buildIdlePrompt(cwd, store); }`.
**Verdict:** pass

### Criterion 2: `buildInjectedPrompt()` returns null when `state.megaEnabled` is false, regardless of whether an active issue exists.
**Evidence:** Two tests pass: `returns null when megaEnabled is false with no active issue (AC2)` and `returns null when megaEnabled is false with active issue (AC2)`. Code path: first line of `buildInjectedPrompt` — `if (!state.megaEnabled) return null;`.
**Verdict:** pass

### Criterion 3: The idle-mode prompt content includes the base protocol section (loaded from `megapowers-protocol.md`).
**Evidence:** Test `includes protocol section with tool names (AC3)` passes. `buildIdlePrompt` calls `loadPromptFile("megapowers-protocol.md")` and pushes it first. File exists at `prompts/megapowers-protocol.md`.
**Verdict:** pass

### Criterion 4: The idle-mode prompt content includes a list of open issues showing each issue's id, title, milestone, and priority.
**Evidence:** Test `includes open issues list with id, title, milestone, and priority (AC4)` passes. Implementation in `buildIdlePrompt` formats each issue as `- #NNN title (milestone: ..., priority: ...)`. Secondary test `does not include done issues in idle prompt` also passes.
**Verdict:** pass

### Criterion 5: The idle-mode prompt content includes available slash commands with short descriptions (at minimum `/issue new`, `/issue list`, `/triage`, `/mega on|off`).
**Evidence:** Test `includes slash command hints (AC5)` passes. `buildIdlePrompt` explicitly pushes a "## Available Commands" section listing all four commands.
**Verdict:** pass

### Criterion 6: The idle-mode prompt content includes a reference to `ROADMAP.md` and `.megapowers/milestones.md`.
**Evidence:** Test `includes roadmap and milestones reference (AC6)` passes. `buildIdlePrompt` pushes `"See \`ROADMAP.md\` and \`.megapowers/milestones.md\` for what's next."` as its final part.
**Verdict:** pass

### Criterion 7: `renderDashboardLines` in idle mode (no active issue) includes hint lines for `/issue new`, `/issue list`, `/triage`, and `/mega on|off`.
**Evidence:** Tests `includes /triage command hint (AC7)` and `includes /mega on|off command hint (AC7)` both pass. `ui.ts` lines 76–79 push all four hint lines. `/issue new` and `/issue list` covered by the existing `shows no-issue message with commands` test.
**Verdict:** pass

### Criterion 8: `renderDashboardLines` in idle mode includes a line referencing `ROADMAP.md` and `.megapowers/milestones.md`.
**Evidence:** Inspected `extensions/megapowers/ui.ts` lines 71–82 — the idle branch pushes exactly 5 lines (dim "No active issue.", then 4 command hints) and immediately `return lines;`. No `ROADMAP.md` or `.megapowers/milestones.md` reference is present. Grep confirms: `grep -n "ROADMAP\|milestones" extensions/megapowers/ui.ts` returns no output. No test for this criterion exists in `tests/ui.test.ts`.
**Verdict:** fail — `renderDashboardLines` idle mode is missing the ROADMAP/milestones reference line. The idle prompt (`buildIdlePrompt`) includes it, but the dashboard widget does not.

### Criterion 9: `renderDashboardLines` with an active issue is unchanged (no regression).
**Evidence:** Test `shows issue, phase, and task progress` passes; active-issue tests in `ui.test.ts` all pass (63 pass, 0 fail).
**Verdict:** pass

### Criterion 10: `megapowers-protocol.md` lists `phase_back` as an available signal action with description covering backward transitions (verify→implement, code-review→implement, review→plan).
**Evidence:** `cat prompts/megapowers-protocol.md` shows:
```
- `{ action: "phase_back" }` — Go back one phase using workflow-defined backward transitions (review→plan, verify→implement, code-review→implement)
```
All three backward transitions named. The protocol header in this verify prompt itself is sourced from this file.
**Verdict:** pass

### Criterion 11: `megapowers-protocol.md` lists `learnings` as a valid artifact phase in the `megapowers_save_artifact` section.
**Evidence:** `cat prompts/megapowers-protocol.md` shows:
```
- Valid phases: `brainstorm`, `spec`, `plan`, `reproduce`, `diagnosis`, `verify`, `code-review`, `learnings`
```
`learnings` is present.
**Verdict:** pass

### Criterion 12: `review-plan.md` section numbering is sequential — the duplicate "### 5." is corrected to "### 6.".
**Evidence:** `grep -n "### [0-9]\." prompts/review-plan.md` returns:
```
18:### 1. Coverage
21:### 2. Ordering & Dependencies
24:### 3. TDD Completeness
34:### 4. Granularity
40:### 5. No-Test Validity
49:### 5. Self-Containment
```
Two occurrences of "### 5." on lines 40 and 49. Line 49 "Self-Containment" was not corrected to "### 6.".
**Verdict:** fail — duplicate "### 5." still present at line 49.

### Criterion 13: `review-plan.md` "After Review" section references `megapowers_signal({ action: "phase_back" })` for going back to plan.
**Evidence:** `grep -A5 "After Review" prompts/review-plan.md` shows:
```
If the plan needs revision, present specific feedback to the user. When confirmed, the plan phase will need to be revisited.
```
No `megapowers_signal({ action: "phase_back" })` call is present in the needs-revision path. Only `megapowers_signal({ action: "review_approve" })` is shown (for the pass path).
**Verdict:** fail

### Criterion 14: `implement-task.md` "Execution Mode" section is tightened to reduce verbosity while retaining all information.
**Evidence:** `cat prompts/implement-task.md` — the "Execution Mode" section is two concise subsections: "Work inline (default)" (1 sentence) and "Delegate to subagent (when available)" with structured bullet lists for how-subagents-work, how-to-invoke, after-dispatching, and do-not-delegate conditions. No redundant prose. [no-test] criterion — verified by inspection.
**Verdict:** pass

### Criterion 15: `verify.md` references `megapowers_signal({ action: "phase_back" })` instead of `/phase implement` or `/phase plan`.
**Evidence:** `grep -n "phase_back\|/phase implement\|/phase plan" prompts/verify.md` returns:
```
prompts/verify.md:80:- If any criterion fails: explain what's missing and recommend next steps. Use `megapowers_signal({ action: "phase_back" })` to return to implement for fixes. If planning is fundamentally wrong, call this out explicitly and recommend continuing backward through review→plan as needed.
```
Correct signal action used; no `/phase` commands present.
**Verdict:** pass

### Criterion 16: `code-review.md` references `megapowers_signal({ action: "phase_back" })` instead of `/phase implement` or `/phase plan` in "needs-fixes" and "needs-rework" sections.
**Evidence:** `grep -n "phase_back\|/phase implement\|/phase plan" prompts/code-review.md` returns:
```
prompts/code-review.md:112:3. Present the recommendation to the user — they will need to use `/phase implement` or `/phase plan` to transition back
```
The "needs-rework" section at line 112 still references `/phase implement` or `/phase plan`. No `megapowers_signal({ action: "phase_back" })` is present in the needs-fixes or needs-rework sections.
**Verdict:** fail

---

## Overall Verdict

**fail**

4 criteria failed:

- **AC8**: `renderDashboardLines` idle mode is missing the ROADMAP.md / milestones.md reference line. The `buildIdlePrompt` function (prompt injection) includes it, but the dashboard widget (`ui.ts`) does not. No test covers this.
- **AC12**: `review-plan.md` still has a duplicate "### 5. Self-Containment" at line 49 — should be "### 6.".
- **AC13**: `review-plan.md` "After Review" section does not reference `megapowers_signal({ action: "phase_back" })` for going back to plan. The needs-revision path says "the plan phase will need to be revisited" with no signal call.
- **AC16**: `code-review.md` "needs-rework" section at line 112 still says `use /phase implement or /phase plan to transition back` — should reference `megapowers_signal({ action: "phase_back" })`.

Recommending `megapowers_signal({ action: "phase_back" })` to return to implement for targeted fixes to the 4 failing criteria.
