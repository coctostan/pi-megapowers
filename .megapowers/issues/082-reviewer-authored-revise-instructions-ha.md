---
id: 82
type: feature
status: closed
created: 2026-03-03T13:49:33.763Z
milestone: M3
priority: 1
---
# Reviewer-authored revise-instructions handoff for plan revision sessions
## Problem

When the plan reviewer sends a plan back for revision, a new session starts and the reviser loses the reviewer's reasoning context. The `revise-plan.md` template tells the reviser to "read the latest review artifact" but this requires an extra file-reading hop that models frequently skip or do poorly. The review feedback parameter from `megapowers_plan_review` is a compressed summary that loses fidelity compared to the reviewer's full chain-of-thought.

This results in revisers not making the corrections the reviewer asked for, or making superficial changes that don't address the root issues.

## Solution

Have the reviewer author a `revise-instructions-{iteration}.md` file as a direct handoff document for the reviser, then auto-inject its content into the revise prompt via a `{{revise_instructions}}` template variable.

### Flow

1. Reviewer evaluates tasks, forms detailed feedback
2. Reviewer saves `revise-instructions-{iteration}.md` to `.megapowers/plans/<slug>/` — a focused, prescriptive document written specifically for the next LLM session
3. Reviewer calls `megapowers_plan_review({ verdict: "revise", ... })`
4. New revise session starts; `revise-plan.md` template auto-injects `{{revise_instructions}}` from that file
5. Reviser sees actionable instructions immediately, no file-reading hop needed

### What goes in revise-instructions

- Which tasks need revision and exactly what to fix
- Code snippets showing what the corrected version should look like
- Explicit "do NOT touch tasks X, Y — they're approved"
- Reasoning behind rejections (not just "Step 2 is vague" but "Step 2 needs the specific TypeError message")

### Changes needed

- `prompts/review-plan.md` — instruct reviewer to write `revise-instructions-{iteration}.md` before submitting verdict
- `prompts/revise-plan.md` — add `{{revise_instructions}}` template variable
- `extensions/megapowers/prompt-inject.ts` — load `revise-instructions-{iteration}.md` and populate the variable when `planMode === "revise"`
- `extensions/megapowers/tools/tool-plan-review.ts` — validate the file exists before accepting a `revise` verdict (gate)
- Also tighten `write-plan.md` — move "Common Mistakes" to the top, add pre-submit checklist
