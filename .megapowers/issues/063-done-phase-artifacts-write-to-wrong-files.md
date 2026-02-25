---
id: 63
type: bugfix
status: open
created: 2026-02-24T23:30:00.000Z
---

# Done-phase artifacts all overwrite the same `done.md` file

## Problem

The done phase has four sub-modes (`generate-docs`, `generate-bugfix-summary`, `write-changelog`, `capture-learnings`), each of which runs a separate prompt and produces a distinct artifact. But all of them end up writing to the same `done.md` file, with each subsequent save silently overwriting the previous one.

**Root cause 1 — vague generic instruction.** `PHASE_TOOL_INSTRUCTIONS.done` in `prompt-inject.ts` reads:

```
Use `megapowers_save_artifact` to save any done-phase outputs (docs, changelog, learnings).
```

This gives the LLM no guidance on *which* phase name to use. It always picks `"done"`, which always writes `done.md`.

**Root cause 2 — done-mode prompts lack specific save instructions.** `generate-docs.md`, `write-changelog.md`, `capture-learnings.md`, and `generate-bugfix-summary.md` none of them instruct the agent to call `megapowers_save_artifact` with a doneMode-appropriate phase name. The agent falls back to the generic instruction and uses `"done"` for all of them.

**Consequence with issue #041's overwrite guard (now live):** The first done-mode save succeeds (`done.md` is written). The second fails with "File already exists" because the guard correctly blocks the overwrite. The third also fails. The agent sees errors and may retry or skip, but the net result is only one of the three artifacts is persisted, and it's in a generic file with no semantic naming.

## Expected Behavior

Each done-mode sub-step should save to a distinct, semantically named file:

| `doneMode` | Phase argument to pass | File written |
|---|---|---|
| `generate-docs` | `"feature-doc"` | `.megapowers/plans/<slug>/feature-doc.md` |
| `generate-bugfix-summary` | `"bugfix-summary"` | `.megapowers/plans/<slug>/bugfix-summary.md` |
| `write-changelog` | `"changelog"` | `.megapowers/plans/<slug>/changelog.md` |
| `capture-learnings` | `"learnings"` | `.megapowers/plans/<slug>/learnings.md` |

## Affected Files

| File | Change needed |
|---|---|
| `prompts/generate-docs.md` | Add explicit save instruction: `megapowers_save_artifact` with `phase: "feature-doc"` |
| `prompts/generate-bugfix-summary.md` | Add explicit save instruction: `megapowers_save_artifact` with `phase: "bugfix-summary"` |
| `prompts/write-changelog.md` | Add explicit save instruction: `megapowers_save_artifact` with `phase: "changelog"` |
| `prompts/capture-learnings.md` | Add explicit save instruction: `megapowers_save_artifact` with `phase: "learnings"` |
| `extensions/megapowers/prompt-inject.ts` | Update `PHASE_TOOL_INSTRUCTIONS.done` to remove the vague generic instruction (the per-prompt instructions replace it) |

## Out of Scope

- Changing the auto-capture mechanism in `index.ts` (`store.writeFeatureDoc`, `store.appendChangelog`) — those write to different locations (`.megapowers/docs/` and `.megapowers/CHANGELOG.md`) and are unaffected
- Adding new doneMode values
- Changing the `tool-artifact.ts` implementation — the overwrite guard from #041 is correct and should remain
