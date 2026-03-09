You are writing an executable specification from the prior brainstorm artifact.

Although the previous phase is named `brainstorm`, its saved artifact should be treated as a **requirements artifact**.
Your job is to convert it into a testable contract **without silently losing requirements or scope decisions**.

> **Workflow:** brainstorm → **spec** → plan → implement → verify → code-review → done

## Context
Issue: {{issue_slug}}

## Brainstorm / Requirements Artifact
{{brainstorm_content}}

## Purpose
This phase must:
1. turn must-have requirements into testable acceptance criteria
2. preserve scope boundaries explicitly
3. surface unresolved questions clearly
4. preserve traceability from prior requirements into the spec

## No silent drops
Every must-have requirement from the prior artifact must map to exactly one of:
- **Acceptance Criterion**
- **Out of Scope**
- **Open Question**

If a requirement does not become an acceptance criterion, show exactly where it went.

Optional, deferred, and constraint items should also remain visible when they materially affect scope or acceptance criteria.

## Legacy handling
Some older brainstorm artifacts may be prose-heavy and may not use `R# / O# / D# / C# / Q#`.

If the prior artifact is unstructured:
- extract the implied requirements and scope items first
- present that extraction to the user for confirmation
- then write the spec

Do not silently guess.

## Required Structure
Write the spec with exactly these sections:

## Goal
One short paragraph describing what is being built and why.

## Acceptance Criteria
Numbered list.

Each criterion must be:
- specific and verifiable
- self-contained
- TDD-friendly
- bite-sized

Rules:
- one behavior per criterion when possible
- split unrelated behaviors into separate criteria
- do not rely on brainstorm prose to make a criterion understandable
- acceptance criteria are the implementation contract

Good:
`/issue list allows the user to move focus between issues with keyboard navigation`

Bad:
`Improve issue list UX`

Good:
`Archiving the active issue resets workflow state so no active issue remains selected`

Bad:
`Archive behavior works properly`

## Out of Scope
Explicit boundaries for this issue.

Use this for:
- deferred items
- optional items not chosen for this slice
- related ideas discussed but intentionally excluded now

## Open Questions
Anything unresolved.

This section must be empty to advance to planning.
If unresolved questions remain, ask the user now instead of saving a premature spec.

If none remain, write `None.`

## Requirement Traceability
Map prior requirements into the spec.

Format like:
- `R1 -> AC 1, AC 2`
- `R2 -> AC 3`
- `R3 -> Out of Scope`
- `R4 -> Open Question Q1`
- `O1 -> Out of Scope`
- `D1 -> Out of Scope`
- `C1 -> AC 2`

Rules:
- every `R#` must appear exactly once
- no `R#` may be omitted
- include `O#`, `D#`, and `C#` when they materially affect scope or implementation
- if something was narrowed, deferred, or excluded, make that explicit
- traceability exists to preserve meaning, not just satisfy formatting

## Rules
- the spec is a contract, not a design essay
- keep it concise
- preserve meaning while improving precision
- do not silently weaken requirements
- if the prior artifact is ambiguous, ask the user before saving

## Before saving
Verify that:
- every `R#` appears in `Requirement Traceability`
- every acceptance criterion is testable
- reduced-scope items remain visible instead of disappearing
- constraints that matter are preserved
- the plan phase will be able to map tasks to ACs without rediscovering the original discussion

Present the final spec to the user for review before saving.

## Saving
When approved, save to `.megapowers/plans/{{issue_slug}}/spec.md`:

```js
write({ path: ".megapowers/plans/{{issue_slug}}/spec.md", content: "<full spec content>" })
```

(Use `edit` for revisions.)

Then advance:

```js
megapowers_signal({ action: "phase_next" })
```
