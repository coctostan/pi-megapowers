---
id: 124
type: feature
status: done
created: 2026-03-11T16:59:05.024Z
milestone: M0
priority: 1
---
# Remove deprecated review-approval path from product surface
Structural hardening issue.

`review_approve` is deprecated, but traces of the old path still exist across the product surface. This includes command wiring, tool registration, signal handling, and workflow/tool instructions. That drift creates protocol confusion and risks teaching the model outdated behavior.

## Goal
Remove deprecated review-approval behavior end-to-end so the product consistently uses `megapowers_plan_review`.

## Scope
- find all remaining references to `review_approve`
- remove deprecated command / tool / instruction paths that still expose it
- ensure prompts, workflow instructions, and tool registration consistently point to `megapowers_plan_review`
- keep error messages and migration behavior clear where compatibility handling is still needed

## Acceptance criteria
- no active workflow instruction tells the model to use `review_approve`
- no command or registered tool surface advertises deprecated review approval as the expected path
- the plan review flow consistently points to `megapowers_plan_review`
- tests cover the updated product surface and guard against regression

## Notes
This is a product-coherence cleanup. The goal is to eliminate internal protocol drift, not to redesign the plan review loop itself.
