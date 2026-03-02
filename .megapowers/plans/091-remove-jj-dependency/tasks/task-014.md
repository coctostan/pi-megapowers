---
id: 14
title: Update AGENTS.md and prompt files to remove jj references
status: approved
depends_on:
  - 13
no_test: true
files_to_modify:
  - AGENTS.md
  - prompts/brainstorm.md
  - prompts/megapowers-protocol.md
  - prompts/implement-task.md
  - prompts/done.md
  - prompts/capture-learnings.md
  - prompts/generate-docs.md
  - prompts/generate-bugfix-summary.md
  - prompts/code-review.md
files_to_create: []
---

### Task 14: Update AGENTS.md and prompt files to remove jj references [no-test] [depends: 13]

**Justification:** Docs/prompt wording only.

**Step 1 — Apply exact doc/prompt edits**

Update `AGENTS.md`:
- `pipeline` and `subagent` descriptions: replace "isolated jj workspace" with "isolated git worktree" / "isolated workspace"
- remove "Async jj fire-and-forget" known issue entry
- ensure any remaining VCS guidance references git, not jj

Update prompt files (exact paths):
- `prompts/brainstorm.md`
- `prompts/megapowers-protocol.md`
- `prompts/implement-task.md`
- `prompts/done.md`
- `prompts/capture-learnings.md`
- `prompts/generate-docs.md`
- `prompts/generate-bugfix-summary.md`
- `prompts/code-review.md`

Required wording changes:
- remove jj-as-required-VCS language
- replace "jj workspace" with "git worktree" or neutral "isolated workspace"
- where prompts mention diff commands, keep `git diff` guidance (drop `jj diff` references)

**Step 2 — Verify**

Run:

```bash
grep -R "\bjj\b\|Jujutsu" AGENTS.md prompts --include="*.md"
```

Expected: no jj/Jujutsu references in these top-level docs/prompts.

Then run:
- `bun test`

Expected: PASS.
