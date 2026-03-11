# Canonicalize Plan Entity and Storage Infrastructure

**Issue:** #123  
**Type:** Feature (dead-code cleanup)  
**Status:** Done

## Summary

Removed three dead root-level plan infrastructure modules and their corresponding dead test files. The codebase now has a single, unambiguous active path for plan entity parsing, schema validation, and storage behavior — the canonical `extensions/megapowers/state/` implementation.

## What Was Removed

| Deleted File | Lines | Role |
|---|---|---|
| `extensions/megapowers/plan-store.ts` | 103 | Dead root-level store (duplicate of `state/plan-store.ts`) |
| `extensions/megapowers/entity-parser.ts` | 57 | Dead root-level parser (duplicate of `state/entity-parser.ts`) |
| `extensions/megapowers/plan-schemas.ts` | 41 | Dead root-level schemas (duplicate of `state/plan-schemas.ts`) |
| `tests/plan-store.test.ts` | 217 | Tests for the deleted root-level store |
| `tests/entity-parser.test.ts` | 96 | Tests for the deleted root-level parser |
| `tests/plan-schemas.test.ts` | 135 | Tests for the deleted root-level schemas |

**Net change:** −650 lines, 0 lines added.

## Why This Mattered

The codebase contained two parallel implementations of plan entity/storage infrastructure:
- **Root-level (dead):** `extensions/megapowers/plan-store.ts`, `entity-parser.ts`, `plan-schemas.ts` — not imported by any live module
- **Canonical (live):** `extensions/megapowers/state/plan-store.ts`, `state/entity-parser.ts`, `state/plan-schemas.ts` — the active path used by all tools and handlers

This ambiguity created architectural drift risk: future contributors could accidentally extend the wrong implementation, import from the dead path, or be misled by the dead test files into thinking they covered live behavior.

## What Was Not Changed

- The canonical `state/` implementations were not modified — they were already the sole active path
- No behavior, APIs, or file conventions were changed
- No refactoring of the runtime↔storage type boundary (`state-machine.ts` ↔ `state/plan-schemas.ts`) was performed — explicitly deferred as out of scope

## Verification

- Repository-wide `rg` scan confirmed zero remaining references to the deleted root-level module paths
- `git diff -- extensions/megapowers/state/` produced no output — canonical path untouched
- Test suite: **770 pass, 0 fail** (the 53-test reduction is fully accounted for by the 3 deleted dead test files)
