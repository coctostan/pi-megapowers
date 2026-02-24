---
id: 29
type: bugfix
status: done
created: 2026-02-23T15:50:00.000Z
---

# Task state source of truth disconnect

The runtime's in-memory `planTasks` array and file-based `state.json` frequently fall out of sync with the actual plan artifact (`plan.md`). Issues observed:

1. When state.json is written manually or recovered from crash, `planTasks` is empty even though `plan.md` has tasks.
2. The plan parser (`plan-parser.ts`) extracts tasks from `plan.md` but this only happens at specific moments — if that moment is missed (e.g., session restart, manual state edit), tasks are never populated.
3. The LLM writing "Task complete" doesn't reliably advance `currentTaskIndex` because detection depends on fragile regex matching (related to #028).
4. There's no reconciliation step that re-derives `planTasks` from `plan.md` when entering implement phase or on session start.

The plan artifact (`plan.md`) should be the source of truth. On implement phase entry and session recovery, `planTasks` should be re-parsed from the plan file if the array is empty but the plan file exists.
