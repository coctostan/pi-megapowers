---
id: 40
type: feature
status: done
created: 2026-02-23T23:30:00.000Z
---

# Review all injected prompts for accuracy and completeness

The `prompts/` directory contains 13 prompt templates that are loaded and injected into the LLM's context by `buildInjectedPrompt()` in `prompt-inject.ts`. These were written during the initial architecture phase and have not been systematically reviewed since the 030 state source-of-truth refactor introduced tool-first, disk-first semantics and new custom tools (`megapowers_signal`, `megapowers_save_artifact`).

## Prompt inventory

```
prompts/
  megapowers-protocol.md      — base protocol always injected
  brainstorm.md               — feature brainstorm phase
  write-spec.md               — spec phase
  write-plan.md               — plan phase (shared feature+bugfix via aliasing)
  review-plan.md              — review phase
  implement-task.md           — implement phase (per-task vars)
  verify.md                   — verify phase
  code-review.md              — code-review phase
  reproduce-bug.md            — bugfix: reproduce phase
  diagnose-bug.md             — bugfix: diagnose phase
  generate-docs.md            — done: generate feature doc
  generate-bugfix-summary.md  — done: bugfix summary
  write-changelog.md          — done: changelog entry
  capture-learnings.md        — done: capture learnings
  triage.md                   — triage command context
```

## What to review for each prompt

1. **Accuracy** — does it correctly describe the current tool API (`megapowers_signal`, `megapowers_save_artifact` with correct params)?
2. **Phase correctness** — does it accurately describe what this phase produces and what comes next?
3. **Template variable coverage** — are all `{{var}}` placeholders actually populated by `buildInjectedPrompt()`? Unpopulated vars render as literal `{{var_name}}` in the injected text, confusing the LLM.
4. **Consistency** — do all prompts use the same terminology, formatting, and signal conventions?
5. **Completeness** — is anything missing that would help the LLM do the right thing (e.g. the TDD cycle description in `implement-task.md`, the gate conditions in `review-plan.md`)?
6. **Brevity** — are there prompts that could be shorter without losing signal? Injected tokens have a cost.

## Deliverable

- Edited prompt files where issues are found
- A brief audit summary noting what was found/fixed per file
- Any new `{{vars}}` needed (with corresponding changes to `buildInjectedPrompt()` to populate them)

## Affected files
- All files in `prompts/`
- Possibly `extensions/megapowers/prompt-inject.ts` if template vars need updating
