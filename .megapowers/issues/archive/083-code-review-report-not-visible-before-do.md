---
id: 83
type: bugfix
status: done
created: 2026-03-03T13:52:48.657Z
milestone: M3
priority: 1
---
# Code-review report not visible before done-phase checklist fires
## Problem

When the code-review phase completes, the `code-review.md` prompt instructs the LLM to: (1) write the review report file, then (2) call `megapowers_signal({ action: "phase_next" })`. In practice, the LLM often calls `phase_next` before (or without) writing the report. 

The `phase_next` handler in `register-tools.ts` (line 49-53) synchronously triggers `showDoneChecklist(ctx, cwd)` inside the tool call when it detects the new phase is `done`. This shows the TUI checklist to the user **while the LLM response is still streaming**. The user selects wrap-up actions and commits to the done phase before ever seeing the code-review findings.

Then the LLM continues streaming, writes `code-review.md`, and the done-phase prompt (injected because `doneActions` is now populated) tells it to execute wrap-up actions. The LLM conflates writing the code-review report with the "generate-docs" wrap-up action, so feature docs are never actually generated.

### Consequences

1. **User never sees code-review feedback before committing to done** — the checklist fires instantly on `phase_next`, before the review report is written
2. **Feature doc / bugfix summary actions are skipped** — the LLM treats writing `code-review.md` as the doc-generation action
3. **No opportunity to go back** — by the time the user reads the review, they've already selected done-phase actions

### Root Cause

`showDoneChecklist` is called synchronously inside the `megapowers_signal` tool's `execute()` function (register-tools.ts:52), which runs during the tool-call response before the LLM finishes its turn. The code-review prompt's instruction ordering (write report → then phase_next) is not enforced — it's just a suggestion in the prompt.

### Potential Fixes

1. **Gate: require `code-review.md` exists before allowing `phase_next` from code-review** — add an artifact check in `handlePhaseNext` or the gate evaluator. This ensures the review is written before the phase advances.
2. **Defer checklist**: Instead of showing the checklist inside the tool call, set a flag and show it on the next idle event or next session start. This decouples the checklist from the streaming response.
3. **Separate the review write from phase advance**: Make the code-review prompt more explicit — "You MUST write code-review.md FIRST. Only after confirming the file exists, call phase_next."

Fix 1 (artifact gate) is the most robust since it's enforced by the system, not by prompt compliance.
