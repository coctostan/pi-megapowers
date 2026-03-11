---
id: 8
title: Update internal agent and review prompts after legacy subagent removal
status: approved
depends_on:
  - 4
  - 5
  - 6
no_test: true
files_to_modify:
  - .pi/agents/implementer.md
  - prompts/code-review.md
  - prompts/verify.md
files_to_create: []
---

### Task 8: Update internal agent and review prompts after legacy subagent removal [no-test] [depends: 4, 5, 6]

**Justification:** prompt/documentation-only change.

**Files:**
- Modify: `.pi/agents/implementer.md`
- Modify: `prompts/code-review.md`
- Modify: `prompts/verify.md`

**Step 1 — Make the change**
Rewrite internal prompt content that still assumes the removed legacy pipeline/subagent execution path.

Required edits:
- In `.pi/agents/implementer.md`, remove the sentence that says the pipeline runner will audit tool-call history and pass that report to the reviewer. Keep strict TDD instructions, but describe direct task execution rather than pipeline-runner auditing.
- In `prompts/code-review.md`, replace wording like “If subagents implemented some tasks” with wording that does not assume a legacy delegated implementation path.
- In `prompts/verify.md`, remove the verification red flag that talks about trusting a subagent’s reported status for task completion; replace it with language about independently verifying any preserved advisory/review outputs if they were used.

Do not remove legitimate references to preserved `pi-subagents` review fan-out elsewhere in the repo.

**Step 2 — Verify**
Run: `grep -nE 'pipeline runner|If subagents implemented|Subagent completed task' .pi/agents/implementer.md prompts/code-review.md prompts/verify.md || true; bun test`
Expected: those legacy delegated-execution phrases are gone or rewritten to reflect direct primary-session implementation, any retained wording is clearly about preserved non-legacy review/advisory usage, and the full test suite passes.
