# Handoff — #118 Replace brainstorm-as-summary with requirements gathering and traceable spec distillation

## Current status
We are still in the **brainstorm** phase for issue `118-replace-brainstorm-as-summary-with-requi`.

The key design decision is agreed:
- Keep the phase name `brainstorm` for now
- Reframe it to mean **discovery + requirements gathering**
- Treat `brainstorm.md` as a structured requirements artifact
- Make `spec.md` a **traceable distillation** of that artifact, not a vague reinterpretation

## Changes already made
Updated prompt files:
- `prompts/brainstorm.md`
- `prompts/write-spec.md`

Updated tests/docs:
- `tests/prompts.test.ts`
- `README.md`
- `.megapowers/CHANGELOG.md`
- `.megapowers/docs/118-replace-brainstorm-as-summary-with-requi.md`

## New prompt model
### brainstorm.md
Now requires:
- early mode triage: `Exploratory` vs `Direct requirements`
- explicit requirement buckets:
  - `R#` = must-have requirement
  - `O#` = optional / nice-to-have
  - `D#` = explicitly deferred
  - `C#` = constraint
  - `Q#` = open question
- preservation of reduced-scope items so they do not silently disappear

### write-spec.md
Now requires:
- **No silent drops**
- `Requirement Traceability`
- explicit mapping from brainstorm requirements into spec outputs
- visibility for reduced-scope / deferred items
- legacy handling for older unstructured brainstorm artifacts

## Validation already run
Passing:
- `bun test tests/prompts.test.ts`
- `bun test tests/prompts.test.ts tests/prompts-no-save-artifact.test.ts tests/prompt-inject.test.ts tests/bugfix-integration.test.ts`

## Important repo state
Current branch:
- `feat/118-replace-brainstorm-as-summary-with-requi`

There are unrelated issue-file changes in the working tree. If committing later, stage only the files relevant to #118.

## Recommended next step after restart
Resume the **brainstorm phase** and produce the actual structured `brainstorm.md` artifact for this issue using the new model.

Use this framing:
- Mode: likely `Direct requirements`
- Goal: fix the upstream process leak where user-stated requirements get compressed or lost between live discussion, brainstorm artifact, and spec

The artifact should contain exactly:
- `## Goal`
- `## Mode`
- `## Must-Have Requirements`
- `## Optional / Nice-to-Have`
- `## Explicitly Deferred`
- `## Constraints`
- `## Open Questions`
- `## Recommended Direction`
- `## Testing Implications`

## Likely must-have requirements to capture
- `R1` The `brainstorm` phase must preserve concrete user-stated requirements explicitly rather than folding them only into prose.
- `R2` The phase must start by deciding whether the work is exploratory or direct requirements capture.
- `R3` Reduced-scope ideas must remain visible as optional or deferred rather than disappearing.
- `R4` The saved `brainstorm.md` artifact must use explicit IDs (`R#`, `O#`, `D#`, `C#`, `Q#`).
- `R5` The `spec` prompt must map brainstorm requirements into acceptance criteria / out-of-scope / open questions with traceability.
- `R6` No workflow rename is required in this first pass.
- `R7` Prompt tests must lock in the new contract.

## Likely constraints
- `C1` Keep the external phase name `brainstorm` for now to avoid unnecessary workflow churn.
- `C2` Minimize scope to prompt/test/doc updates in this pass.
- `C3` Do not attempt the larger cross-project trace graph in this issue.

## Likely deferred items
- `D1` Renaming the `brainstorm` phase to `requirements` or `discovery`
- `D2` Removing the visible `review` phase / broader workflow UX cleanup
- `D3` Full cross-artifact traceability from code ↔ task ↔ AC ↔ requirement ↔ brainstorm ↔ issue

## Open question to answer on restart
Should optional/deferred items always appear in spec traceability, or only when they materially affect scope? Current leaning: include them when they materially affect scope.
