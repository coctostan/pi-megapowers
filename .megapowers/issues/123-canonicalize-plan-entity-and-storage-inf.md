---
id: 123
type: feature
status: done
created: 2026-03-11T16:58:57.645Z
milestone: M0
priority: 1
---
# Canonicalize plan entity and storage infrastructure
Structural hardening issue.

The codebase currently contains duplicate or shadowed implementations of core plan infrastructure (notably `plan-store`, `entity-parser`, and `plan-schemas`) with differing APIs, file conventions, and semantics. This creates architectural drift in the planning workflow and makes changes harder to reason about.

## Goal
Establish one canonical implementation path for plan entities and plan storage.

## Scope
- identify all duplicate/shadow plan infrastructure modules
- choose one canonical implementation for each responsibility
- migrate consumers to the canonical path
- remove or retire duplicate implementations once callers are moved
- preserve existing behavior and compatibility where needed

## Acceptance criteria
- only one canonical plan entity/storage path remains in active use
- all plan task / plan review callers use the same plan infrastructure
- tests cover the canonicalized behavior and any compatibility expectations
- no duplicate module remains that could plausibly diverge again unnoticed

## Notes
This is targeted structural hardening, not a broad refactor. The focus is reducing drift in the workflow core so later UX and plan-loop work can land safely.
