You are executing wrap-up actions for a completed issue. Execute ALL selected actions in a SINGLE turn using your tools, then close the issue.

> **Workflow:** ... → verify → code-review → **done**

## Context
Issue: {{issue_slug}}

## Spec / Diagnosis
{{spec_content}}

## Plan
{{plan_content}}

## Verification Results
{{verify_content}}

## Files Changed
{{files_changed}}

## Selected Wrap-up Actions

Execute the following wrap-up actions in order using your tools:

{{done_actions_list}}

## Action Instructions

For each action listed above, execute it directly using your tools:

### generate-docs
Generate a feature document summarizing what was built and why. Use the spec, plan, and verify artifacts. Inspect actual changed files via `bash("git diff --stat")` when needed.
Write the document directly:
```
write({ path: ".megapowers/docs/{{issue_slug}}.md", content: "<feature document>" })
```

### generate-bugfix-summary
Generate a bugfix summary document including root cause, fix approach, files changed, and how to verify the fix.
Write it directly:
```
write({ path: ".megapowers/docs/{{issue_slug}}.md", content: "<bugfix summary>" })
```

### write-changelog
Generate a changelog entry and append it directly:
```
edit({ path: ".megapowers/CHANGELOG.md", edits: [{ insert_after: { anchor: "<last-line-anchor>", new_text: "\n## [Unreleased]\n### <Added|Fixed|Changed>\n- <description> (#<issue-number>)\n" } }] })
```
Or if the file doesn't exist:
```
write({ path: ".megapowers/CHANGELOG.md", content: "## [Unreleased]\n### <Added|Fixed|Changed>\n- <description> (#<issue-number>)\n" })
```

### capture-learnings
Reflect on the implementation: what was learned, what was surprising, what to do differently. Write 3–7 bullet-point learnings directly:
```
write({ path: ".megapowers/plans/{{issue_slug}}/learnings.md", content: "<markdown bullet list>" })
```

### push-and-pr
Ship the current issue through the code-owned VCS lifecycle helper. Do not run raw `git push` or `gh pr create` commands yourself.

Run:
```bash
bun extensions/megapowers/vcs/ship-cli.ts
```

Interpret the JSON result from that command as follows:
- if finalization blocks suspicious files, stop and report the blocked file list
- if push fails, do not attempt PR creation
- if PR is skipped because `gh` is unavailable, report that push succeeded and PR must be created manually
- after a successful ship result, print the cleanup reminder

After your PR is merged on GitHub, run these cleanup commands:
```
git checkout main && git pull && git branch -d {{branch_name}}
```
### close-issue
All other actions are complete. Before closing:
1. Run `git checkout main` to return to the base branch — do not leave the user on the feature branch.
2. Then call the close_issue signal:
```
megapowers_signal({ action: "close_issue" })
```
This resets the workflow state. Do NOT call phase_next — use close_issue.

---

**Important:** Execute ALL actions listed above in THIS turn. Do not wait for user messages between actions. After completing all actions, the final action should always be calling `megapowers_signal({ action: "close_issue" })`.

Only execute the actions listed in **Selected Wrap-up Actions**. Skip any action not in that list.

## Learnings from Prior Work
{{learnings}}
