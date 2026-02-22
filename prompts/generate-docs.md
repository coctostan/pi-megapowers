You are generating a feature document for a completed issue. Produce a structured, durable document from the artifacts below.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Plan
{{plan_content}}

## Verification Results
{{verify_content}}

## Files Changed
{{files_changed}}

## Learnings Captured
{{learnings}}

## Output Format

Write the feature document in this structure:

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
