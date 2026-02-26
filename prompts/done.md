You are executing wrap-up actions for a completed issue. Execute each selected action in order.

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

Execute the following wrap-up actions in order:

{{done_actions_list}}

## Action Instructions

For each action listed above:

### generate-docs
Generate a feature document summarizing what was built and why. Write it to `docs/features/{{issue_slug}}.md` (create the directory if needed). Use the spec, plan, verify artifacts and inspect actual changed files via `jj diff` or `git diff` to get the real file list.

### generate-bugfix-summary
Generate a bugfix summary document. Write it to `docs/bugfixes/{{issue_slug}}.md`. Include: root cause, fix approach, files changed, how to verify the fix.

### write-changelog
Append a changelog entry to `CHANGELOG.md`. Format:
```
## [Unreleased]
### <Added|Fixed|Changed>
- <description> (#<issue-number>)
```
Use `bash` to append or a write tool to update the file.

### capture-learnings
Reflect on the implementation: what was learned, what was surprising, what to do differently. Write 3–7 bullet-point learnings. Save via:
```
megapowers_save_artifact({ phase: "learnings", content: "<markdown bullet list>" })
```

### squash-task-changes
Run `jj squash --into @-` via bash to consolidate per-task jj changes into the phase change. Confirm the squash completed without error.

### close-issue
All other actions are complete. Report the full list of completed wrap-up actions to the user. Inform them the issue is ready to close — they can run `/issue close` or select a new issue to continue.

---

Only execute the actions listed in **Selected Wrap-up Actions**. Skip any action not in that list.

## Learnings from Prior Work
{{learnings}}
