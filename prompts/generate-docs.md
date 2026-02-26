You are generating a feature document for a completed issue. Produce a structured, durable document from the artifacts below.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Plan
{{plan_content}}

## Verification Results
{{verify_content}}

## Learnings Captured
{{learnings}}

## Files Changed
{{files_changed}}

## Instructions

Review the artifacts above and inspect the actual files changed using the project's VCS (`jj diff`, `git diff`, etc.) to get the real list of modified files.

Write the feature document in this structure:

```
# Feature: [issue title from spec]

## Summary
Brief description (2–3 sentences) of what was built and why.

## Design Decisions
Key architectural choices, trade-offs, alternatives rejected.

## API / Interface
Public API, CLI commands, configuration keys, or UI changes added or modified.

## Testing
Testing approach, notable test cases, coverage notes.

## Files Changed
List of files added or modified with one-line descriptions.
```

Present the document to the user for review. When approved, save it:
```
megapowers_save_artifact({ phase: "docs", content: "<approved document>" })
```
