You are generating a bugfix summary for a completed issue. Produce a concise, durable document from the artifacts below.

## Context
Issue: {{issue_slug}}

## Reproduction
{{reproduce_content}}

## Diagnosis
{{diagnosis_content}}

## Plan
{{plan_content}}

## Learnings Captured
{{learnings}}

## Instructions

Review the artifacts above and inspect the actual files changed using the project's VCS (`jj diff`, `git diff`, etc.) to get the real list of modified files.

Write the bugfix summary in this structure:

```
# Bugfix: [short description from reproduction]

## Bug Description
Brief description (2–3 sentences) of what was broken and how it manifested.

## Root Cause
What was wrong and why. Reference specific code if helpful.

## Fix Applied
What was changed and why this approach was chosen.

## Regression Tests
What tests were added to prevent recurrence.

## Files Changed
List of files added or modified with one-line descriptions.
```

Present the summary to the user for review. When approved, save it:
```
megapowers_save_artifact({ phase: "bugfix-summary", content: "<approved summary>" })
```
