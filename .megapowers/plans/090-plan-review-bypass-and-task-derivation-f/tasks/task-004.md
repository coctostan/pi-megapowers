---
id: 4
title: Add plan_draft_done instruction to revise-plan.md prompt [no-test]
status: approved
depends_on: []
no_test: true
files_to_modify:
  - prompts/revise-plan.md
files_to_create: []
---

**Covers:** Fixed When #7 (revise-plan.md includes explicit instruction to call plan_draft_done), #8 (no plan-phase prompt mentions phase_next)
**Justification:** Prompt-only change — no runtime behavior to test. The runtime gate from Task 1 is the hard enforcement; this is the soft guidance to prevent the LLM from hitting the gate error.
**Files:**
- Modify: `prompts/revise-plan.md`
- Audit (read-only): `prompts/write-plan.md`, `prompts/review-plan.md`

**Step 1 — Read and audit all plan-phase prompts**

Read each of the three plan-phase prompt files to understand their current content and check for any misleading `phase_next` instructions:
1. `read prompts/write-plan.md` — verify it instructs the agent to call `plan_draft_done`, not `phase_next`
2. `read prompts/review-plan.md` — verify it instructs the reviewer to call `megapowers_plan_review`, not `phase_next`
3. `read prompts/revise-plan.md` — verify current content and identify where to add the `plan_draft_done` instruction
**Step 2 — Broad audit: grep ALL plan-phase templates for phase_next**

Grep for `phase_next` across all plan-phase prompt templates (not just the 3 main files) to satisfy Fixed When #8 robustly:
```bash
grep -r "phase_next" prompts/*plan*.md
```
Expected: no matches. If any `phase_next` mentions are found in any plan-phase template, remove them or replace with the correct action (`plan_draft_done` for draft/revise, `megapowers_plan_review` for review).

Also check the individual files:
```bash
grep -r "phase_next" prompts/write-plan.md prompts/revise-plan.md prompts/review-plan.md
```
Expected: no matches.

**Step 3 — Make the change**

Append to the end of `prompts/revise-plan.md`:

```markdown

## When Done

After all revisions are complete, call `megapowers_signal({ action: "plan_draft_done" })` to resubmit for review.
**Do NOT call `phase_next`** — the plan must pass review before advancing to implement.
```

**Step 4 — Verify**

1. Re-run the broad grep audit to confirm no `phase_next` mentions remain across all plan-phase templates:
```bash
grep -r "phase_next" prompts/*plan*.md
```
Expected: no matches
```bash
grep -r "plan_draft_done" prompts/write-plan.md prompts/revise-plan.md
```
Expected: matches in both files
