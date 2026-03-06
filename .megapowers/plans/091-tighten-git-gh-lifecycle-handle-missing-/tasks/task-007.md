---
id: 7
title: Update done.md prompt with gh CLI checks, checkout main, and cleanup guidance
status: approved
depends_on: []
no_test: true
files_to_modify:
  - prompts/done.md
files_to_create: []
---

### Task 7: Update done.md prompt with gh CLI checks, checkout main, and cleanup guidance [no-test]

**Justification:** Prompt-only change — no observable behavior in code to test. The done prompt is a markdown template consumed by the LLM.

**Files:**
- Modify: `prompts/done.md`

**Step 1 — Make the change**

Replace the `### push-and-pr` section (lines 60-68) in `prompts/done.md` with:

```markdown
### push-and-pr
Push the feature branch and create a PR:

**Step 1 — Push the branch:**
```
bash("git push origin {{branch_name}}")
```

**Step 2 — Check GitHub CLI availability:**
```
bash("which gh && gh auth status")
```

- If `gh` is **not installed**: Ask the user if they'd like help installing it (e.g., `brew install gh`). If they decline, skip PR creation and tell them: "Push succeeded. Create your PR manually at the GitHub repo page."
- If `gh` is installed but **not authenticated**: Ask the user if they'd like to run `gh auth login`. If they decline, skip PR creation with the same message.
- If both checks pass: proceed to Step 3.

**Step 3 — Create the PR:**
```
bash("gh pr create --base {{base_branch}} --head {{branch_name}} --title '<issue title>' --body 'Resolves {{issue_slug}}'")
```

If `{{branch_name}}` is empty or the push fails, report the error and move on — do not block other actions.
After push+PR (or after any errors), tell the user:

> After your PR is merged on GitHub, run these cleanup commands:
> ```
> git checkout main && git pull && git branch -d {{branch_name}}
> ```
```

Replace the `### close-issue` section (lines 70-75) with:

```markdown
### close-issue
All other actions are complete. Before closing:
1. Run `git checkout main` to return to the base branch — do not leave the user on the feature branch.
2. Then call the close_issue signal:
```
megapowers_signal({ action: "close_issue" })
```
This resets the workflow state. Do NOT call phase_next — use close_issue.
```

**Step 2 — Verify**
Run: `bun test tests/prompt-inject.test.ts`
Expected: all passing — prompt template changes don't break injection tests since they test template interpolation, not content.

Also manually verify: `cat prompts/done.md` and confirm the `gh auth status`, cleanup guidance, and `git checkout main` instructions are present.
