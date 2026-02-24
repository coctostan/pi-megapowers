---
id: 44
type: bugfix
status: open
created: 2026-02-24T15:06:17.000Z
---

# Write policy is too strict in done/early phases (blocks docs, roadmap, issue capture)

The current phase write-policy blocks useful non-code updates in phases where users still need to maintain project artifacts.

## Problem

- In **done** phase, source/documentation writes are blocked, but done-phase workflows need to update files like:
  - `README.md`
  - `CHANGELOG.md`
  - docs files generated during wrap-up
- In earlier phases (especially **brainstorm**), users sometimes intentionally ask the LLM to:
  - add/refine issue files
  - update `ROADMAP.md`

These legitimate maintenance actions are currently blocked or awkward, which creates friction and encourages bypass behavior.

## Desired behavior

- Allow safe/documentation-oriented writes in **done** phase (at minimum README/changelog/docs updates).
- Add controlled flexibility in non-implement phases so project-management artifacts (e.g., roadmap/issue metadata) can be updated when explicitly requested.
- Preserve TDD and production-code safety guarantees during implement while relaxing policy where risk is low.

## Likely affected areas

- `extensions/megapowers/write-policy.ts`
- `extensions/megapowers/tool-overrides.ts`
- tests for phase-based write enforcement and allowlist behavior (`tests/tool-overrides.test.ts`, `tests/write-policy*` if present)
