## Test Suite Results

```
bun test v1.3.9 (cf6cdbbb)

 905 pass
 0 fail
 2121 expect() calls
Ran 905 tests across 86 files. [1413.00ms]
```

No regressions. All existing tests pass.

---

## Per-Criterion Verification

### Criterion 1: A project agent file exists at `.pi/agents/revise-helper.md`
**Evidence:** `test -f .pi/agents/revise-helper.md` → exit 0  
**Verdict:** pass

### Criterion 2: `.pi/agents/revise-helper.md` instructs the agent to read the latest `revise-instructions-N.md`
**Evidence:** `grep -n 'revise-instructions-N.md' .pi/agents/revise-helper.md`  
Line 12: `- read the latest .megapowers/plans/<issue-slug>/revise-instructions-N.md first.`  
**Verdict:** pass

### Criterion 3: `.pi/agents/revise-helper.md` instructs the agent to read only the affected `tasks/task-NNN.md` files by default
**Evidence:** `grep -n 'read only the affected task files' .pi/agents/revise-helper.md`  
Line 13: `- Then read only the affected task files under .megapowers/plans/<issue-slug>/tasks/ that those revise instructions identify.`  
**Verdict:** pass

### Criterion 4: `.pi/agents/revise-helper.md` instructs the agent not to rewrite unaffected tasks
**Evidence:** `grep -n 'Do not rewrite unaffected tasks' .pi/agents/revise-helper.md`  
Line 14: `- Do not reread or rewrite unaffected task files by default.`  
Line 69: `- Do not rewrite unaffected tasks.`  
**Verdict:** pass

### Criterion 5: `.pi/agents/revise-helper.md` instructs the agent to write an advisory artifact named `revise-proposal.md`
**Evidence:** `grep -n 'revise-proposal.md' .pi/agents/revise-helper.md`  
Line 35: `.megapowers/plans/<issue-slug>/revise-proposal.md`  
Line 71: `Treat revise-proposal.md as advisory only`  
**Verdict:** pass

### Criterion 6: `.pi/agents/revise-helper.md` defines an output format that includes task-local replacements or edit snippets
**Evidence:** `grep -n 'Task-Local Fixes\|edit snippet\|replacement' .pi/agents/revise-helper.md`  
Line 20: `What concrete task-body replacements or edit snippets would fix the affected tasks.`  
Line 44: `## Task-Local Fixes`  
Lines 49, 55: `[exact replacement section or edit snippet]`  
Line 68: `Prefer exact replacement text or edit snippets over broad advice.`  
**Verdict:** pass

### Criterion 7: `.pi/agents/revise-helper.md` defines an output format that includes a short global sanity check for coverage or dependency fallout
**Evidence:** `grep -n 'Global Sanity Check' .pi/agents/revise-helper.md`  
Line 58: `## Global Sanity Check`  
Lines 59–60: coverage fallout / dependency fallout fields  
**Verdict:** pass

### Criterion 8: `.pi/agents/revise-helper.md` states that prior review artifacts must not be read unless the revise instructions reference a coverage or dependency concern or name those artifacts directly
**Evidence:** `grep -n 'Do not read prior review artifacts unless' .pi/agents/revise-helper.md`  
Line 15: `- Do not read prior review artifacts unless the revise instructions reference a coverage or dependency concern or name those artifacts directly.`  
**Verdict:** pass

### Criterion 9: `.pi/agents/revise-helper.md` states that the main session performs the actual task edits and resubmission
**Evidence:** `grep -n 'main session performs the actual task edits and resubmission' .pi/agents/revise-helper.md`  
Line 31: `- The main session performs the actual task edits and resubmission.`  
**Verdict:** pass

### Criterion 10: `.pi/agents/revise-helper.md` states that the agent is advisory only
**Evidence:** `grep -n 'advisory only' .pi/agents/revise-helper.md`  
Line 25: `You are advisory only.`  
**Verdict:** pass

### Criterion 11: `.pi/agents/revise-helper.md` does not instruct the agent to call `megapowers_plan_task`
**Evidence:** `grep 'megapowers_plan_task' .pi/agents/revise-helper.md | grep -v 'Do not call'` → no output (exit 1)  
Only occurrence is the prohibition: `- Do not call megapowers_plan_task.`  
**Verdict:** pass

### Criterion 12: `.pi/agents/revise-helper.md` does not instruct the agent to call `megapowers_plan_review`
**Evidence:** same pattern; only occurrence is `- Do not call megapowers_plan_review.`  
**Verdict:** pass

### Criterion 13: `.pi/agents/revise-helper.md` does not instruct the agent to call `megapowers_signal`
**Evidence:** only occurrence is `- Do not call megapowers_signal.`  
**Verdict:** pass

### Criterion 14: A project chain file exists at `.pi/agents/draft-assist.chain.md`
**Evidence:** `test -f .pi/agents/draft-assist.chain.md` → exit 0  
**Verdict:** pass

### Criterion 15: `.pi/agents/draft-assist.chain.md` has chain frontmatter with both `name` and `description`
**Evidence:**  
`grep '^name:' .pi/agents/draft-assist.chain.md` → `name: draft-assist`  
`grep '^description:' .pi/agents/draft-assist.chain.md` → `description: Run plan-scout then planner for bounded draft assistance`  
Both present in frontmatter block (lines 1–4).  
**Verdict:** pass

### Criterion 16: `.pi/agents/draft-assist.chain.md` defines a `plan-scout` step
**Evidence:** `grep '^## plan-scout$' .pi/agents/draft-assist.chain.md`  
Line 6: `## plan-scout`  
**Verdict:** pass

### Criterion 17: `.pi/agents/draft-assist.chain.md` defines a later planner step that consumes scout output
**Evidence:**  
Line 12: `## planner`  
Line 13: `reads: context.md` (consumes the artifact produced by plan-scout's `output: context.md`)  
planner step appears after plan-scout step.  
**Verdict:** pass

### Criterion 18: `.pi/agents/draft-assist.chain.md` uses the bounded artifact name `context.md`
**Evidence:** `grep -n 'context.md' .pi/agents/draft-assist.chain.md`  
Lines 7, 9, 13, 17: `context.md` used consistently across both steps.  
**Verdict:** pass

### Criterion 19: `.pi/agents/draft-assist.chain.md` describes an advisory planning flow only
**Evidence:** `grep -n 'advisory' .pi/agents/draft-assist.chain.md`  
Line 10: `Stay advisory only and do not create canonical plan task state.`  
Line 17 context: advisory planning draft only.  
**Verdict:** pass

### Criterion 20: `.pi/agents/draft-assist.chain.md` does not instruct any step to create canonical plan task files
**Evidence:** `grep -n 'Do not create canonical plan task files' .pi/agents/draft-assist.chain.md`  
Line 19: `Do not create canonical plan task files.`  
No affirmative instruction to create canonical task files anywhere in file.  
**Verdict:** pass

### Criterion 21: `.pi/agents/draft-assist.chain.md` does not instruct any step to call `megapowers_plan_task`
**Evidence:** `grep 'megapowers_plan_task' .pi/agents/draft-assist.chain.md | grep -v 'Do not call'` → no output  
Only: `Do not call megapowers_plan_task.`  
**Verdict:** pass

### Criterion 22: `.pi/agents/draft-assist.chain.md` does not instruct any step to call `megapowers_plan_review`
**Evidence:** same pattern; only: `Do not call megapowers_plan_review.`  
**Verdict:** pass

### Criterion 23: `.pi/agents/draft-assist.chain.md` does not instruct any step to call `megapowers_signal`
**Evidence:** only: `Do not call megapowers_signal.`  
**Verdict:** pass

### Criterion 24: A project documentation file exists under `.megapowers/docs/` that describes the reusable review-fanout planning pattern
**Evidence:** `test -f .megapowers/docs/115-review-fanout-pattern.md` → exit 0  
File found. Title: `# Review fan-out planning pattern`  
**Verdict:** pass

### Criterion 25: The review-fanout documentation names `coverage-reviewer`, `dependency-reviewer`, and `task-quality-reviewer`
**Evidence:** `grep -n 'coverage-reviewer\|dependency-reviewer\|task-quality-reviewer' .megapowers/docs/115-review-fanout-pattern.md`  
Lines 8, 9, 10: all three agent names present.  
Lines 17, 18, 19: all three named again with their bounded output paths.  
**Verdict:** pass

### Criterion 26: The review-fanout documentation names the bounded artifacts `coverage-review.md`, `dependency-review.md`, and `task-quality-review.md`
**Evidence:** `grep -n 'coverage-review.md\|dependency-review.md\|task-quality-review.md' .megapowers/docs/115-review-fanout-pattern.md`  
Line 17: `coverage-reviewer writes .../coverage-review.md`  
Line 18: `dependency-reviewer writes .../dependency-review.md`  
Line 19: `task-quality-reviewer writes .../task-quality-review.md`  
**Verdict:** pass

### Criterion 27: The review-fanout documentation states that the review-fanout outputs are advisory artifacts
**Evidence:** `grep -n 'advisory artifacts' .megapowers/docs/115-review-fanout-pattern.md`  
Line 22: `- These outputs are advisory artifacts only.`  
**Verdict:** pass

### Criterion 28: The review-fanout documentation states that the main review session synthesizes the focused review outputs
**Evidence:** `grep -n 'main review session reads and synthesizes the focused review outputs' .megapowers/docs/115-review-fanout-pattern.md`  
Line 23: exact match.  
**Verdict:** pass

### Criterion 29: The review-fanout documentation states that final `megapowers_plan_review` submission remains in the main session
**Evidence:** `grep -n 'Final.*megapowers_plan_review' .megapowers/docs/115-review-fanout-pattern.md`  
Line 24: `- Final megapowers_plan_review submission remains in the main session.`  
**Verdict:** pass

---

## Overall Verdict
**pass**

All 29 acceptance criteria verified by direct file inspection and grep evidence in this session. Full test suite ran fresh: 905 pass, 0 fail, 86 files. No regressions introduced.
