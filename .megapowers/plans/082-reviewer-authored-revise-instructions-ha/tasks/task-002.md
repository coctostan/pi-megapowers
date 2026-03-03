---
id: 2
title: Update review-plan.md to use {{plan_iteration}} template variable
status: approved
depends_on: []
no_test: true
files_to_modify:
  - prompts/review-plan.md
files_to_create: []
---

### Task 2: Update review-plan.md to use {{plan_iteration}} template variable [no-test]

**Justification:** Prompt-only change — replaces plain-text `{iteration}` references with a template variable that will be populated by prompt-inject.ts.

**Covers:** AC9 — `review-plan.md` contains `{{plan_iteration}}` in its revise-instructions handoff section and "After Review" section

**Files:**
- Modify: `prompts/review-plan.md`

**Step 1 — Make the change**

In `prompts/review-plan.md`, replace three occurrences of `{iteration}` with `{{plan_iteration}}`:

**Line 76** (Revise-Instructions Handoff section):
```
When your verdict is `revise`, you MUST write a `revise-instructions-{{plan_iteration}}.md` file to the plan directory BEFORE calling the tool. This file is injected directly into the reviser's prompt — it is their primary guide.
```

**Line 78** (Save it to):
```
Save it to: `.megapowers/plans/{{issue_slug}}/revise-instructions-{{plan_iteration}}.md` (where `{{plan_iteration}}` is the current plan iteration number).
```

**Line 124** (After Review section):
```
First, write `revise-instructions-{{plan_iteration}}.md` as described above. Then:
```

**Step 2 — Verify**
Run: `bun test tests/prompt-inject.test.ts`
Expected: all 27 tests pass (existing review-plan tests check for "You are reviewing an implementation plan" which is unaffected; the `{iteration}` → `{{plan_iteration}}` change only affects template variable rendering)
