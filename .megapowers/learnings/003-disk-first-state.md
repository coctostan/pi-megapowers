# Learning: Disk-first state eliminates drift

## Context
Issue #021 described in-memory vs file state divergence. The extension held state in a module-level variable and wrote to `state.json`, but these drifted apart. Manual fixes to JSON were overwritten by stale in-memory state.

## Problem
The dual-source pattern (in-memory primary, file secondary) is a classic consistency bug:
- Event handlers read from memory but write to both
- Crash recovery reads from file, creating a third "source"
- Manual edits to the file are silently overwritten
- Session shutdown could overwrite more-advanced file state with stale memory (issue #004)

## Solution
Eliminate the module-level state variable entirely. Every handler calls `readState(cwd)` at the start and `writeState(cwd, state)` at the end. File is always authoritative.

## Trade-off
More disk I/O per handler (one read + one write per tool call). In practice this is <1ms for a small JSON file — negligible compared to LLM round-trips.

## Key insight
**For extension state that must survive across sessions, file-first with no caching is the simplest correct model.** The "performance optimization" of in-memory caching isn't worth the consistency bugs. Cache only when you can prove no other writer exists.
