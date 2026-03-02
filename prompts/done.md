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
Generate a feature document summarizing what was built and why. Use the spec, plan, and verify artifacts, and inspect actual changed files via `jj diff` or `git diff` when needed. Present the full document in your response; the system persists it to `.megapowers/docs/{{issue_slug}}.md`.

### generate-bugfix-summary
Generate a bugfix summary document including root cause, fix approach, files changed, and how to verify the fix. Present the full summary in your response; the system persists it to `.megapowers/docs/{{issue_slug}}.md`.

### write-changelog
Generate a changelog entry intended for `.megapowers/CHANGELOG.md`. Format:
```
## [Unreleased]
### <Added|Fixed|Changed>
- <description> (#<issue-number>)
```
Return only the entry block; the system appends it automatically.

### capture-learnings
Reflect on the implementation: what was learned, what was surprising, what to do differently. Write 3–7 bullet-point learnings to `.megapowers/plans/{{issue_slug}}/learnings.md`:
```
write({ path: ".megapowers/plans/{{issue_slug}}/learnings.md", content: "<markdown bullet list>" })
```
(Use `edit` for incremental revisions.)

### squash-task-changes
Run `jj squash --into @-` via bash to consolidate per-task jj changes into the phase change. Confirm the squash completed without error.

### close-issue
All other actions are complete. Report the full list of completed wrap-up actions to the user. Inform them the issue is ready to close — they can run `/issue close` or select a new issue to continue.

---

Only execute the actions listed in **Selected Wrap-up Actions**. Skip any action not in that list.

## Learnings from Prior Work
{{learnings}}
