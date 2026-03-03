---
id: 1
title: Update revise-plan.md to use {{revise_instructions}} template variable
status: approved
depends_on: []
no_test: true
files_to_modify:
  - prompts/revise-plan.md
files_to_create: []
---

### Task 1: Update revise-plan.md to use {{revise_instructions}} template variable [no-test]

**Justification:** Prompt-only change — replaces manual file-reading instruction with a template variable that will be populated by prompt-inject.ts.

**Covers:** AC8 — `revise-plan.md` contains the `{{revise_instructions}}` template variable in its "Reviewer's Instructions" section

**Files:**
- Modify: `prompts/revise-plan.md`

**Step 1 — Make the change**

Replace lines 8-9 of `prompts/revise-plan.md`:

```
## Reviewer's Instructions
Read the review artifact in `.megapowers/plans/{{issue_slug}}/`. Look for `revise-instructions-*.md` — this contains the reviewer's specific, per-task feedback. Read it before proceeding.
```

With:

```
## Reviewer's Instructions
{{revise_instructions}}
```

This replaces the manual file-discovery instruction with a template variable. When `buildInjectedPrompt` populates `vars.revise_instructions` (Task 4), the reviser will see the reviewer's full instructions inline rather than having to discover and read the file manually.

**Step 2 — Verify**
Run: `bun test tests/prompt-inject.test.ts`
Expected: all 27 tests pass (existing tests don't check for the old instruction text; the template variable renders as literal `{{revise_instructions}}` until Task 4 adds the injection logic)
