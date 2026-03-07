## Task 1: Add project plan-scout agent definition

Add an explicit acceptance-criteria mapping line to the task body so reviewers and implementers can see coverage without inferring it from the prose. Right after the justification, add:

`**Covers:** AC1, AC2, AC3, AC4, AC5`

Keep the existing file content block, but make the bounded output path formatting exact in the agent content. Replace:

```
` .megapowers/plans/<issue-slug>/context.md `
```

with:

```
`.megapowers/plans/<issue-slug>/context.md`
```

That avoids accidental whitespace in the documented output contract.

## Task 2: Document context.md handoff and planning-subagent experiment rules

Add an explicit acceptance-criteria mapping line to the task body. Right after the justification, add:

`**Covers:** AC6, AC7, AC8, AC9`

The task currently adds a v1 rollout note that says `plan-scout` writes `.megapowers/plans/<issue-slug>/context.md` at the plan directory root, but it also tells the implementer to keep the existing `Artifact Layout` section intact. That leaves the design doc with two conflicting locations for the same artifact:

Current existing layout in `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`:

```text
.megapowers/plans/<issue-slug>/
  subagents/
    draft/
      context.md
```

Revise Step 1 so it explicitly reconciles this. The document should either:

1. update the layout to show the v1 root-level handoff, e.g.

```text
.megapowers/plans/<issue-slug>/
  context.md
  subagents/
    review/
      coverage-review.md
      dependency-review.md
      task-quality-review.md
    revise/
      revise-proposal.md
```

or

2. keep the broader future layout but add a sentence directly under `## Artifact Layout` that makes the version split explicit, for example:

`For the v1 scout rollout, the draft handoff lives at the plan root as .megapowers/plans/<issue-slug>/context.md; the subagents/draft/ layout is reserved for future expanded chains.`

Do not leave both locations in the doc without an explicit scoping sentence.

Also make the verification command check for that clarification, not just the new rollout heading. Add a grep for either the explicit root-path note under `## Artifact Layout` or the updated root-level layout block.

## Task 3: Clarify implement prompt guidance so planning scout is not contradicted

Add an explicit acceptance-criteria mapping line to the task body. Right after the justification, add:

`**Covers:** AC10`

Keep the prompt replacement itself, but tighten the verification so it proves the repository guidance is narrowed rather than merely changed in one line. In Step 2, keep the existing grep checks and also assert that the old blanket wording is gone from `prompts/implement-task.md` exactly as written.

The current command already checks that; keep that part. No additional code changes are required beyond the AC coverage annotation unless you choose to add a short note in the task description that this is the implement-phase-only restriction.