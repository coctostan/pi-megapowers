You are writing a changelog entry for a completed issue. The entry should be user-facing — describe what changed and why it matters, not implementation details.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Verification Results
{{verify_content}}

> **Bugfix note:** In bugfix workflows, "Spec" above is the **diagnosis**. Frame the changelog entry as a fix: what was broken, what's fixed now.

## Instructions

Write a concise changelog entry suitable for a project CHANGELOG.md. Format:

```
## [date] — [feature title or bugfix description]

- [User-facing change 1]
- [User-facing change 2]
- [Breaking changes, if any, clearly marked with ⚠️]
```

Keep it to 3–5 bullets. Focus on what users or developers consuming this project will observe, not on internal implementation choices.

Present the entry to the user for review. When approved, save it to `.megapowers/plans/{{issue_slug}}/changelog.md`:
```
write({ path: ".megapowers/plans/{{issue_slug}}/changelog.md", content: "<approved entry>" })
```
(Use `edit` for incremental revisions.)
