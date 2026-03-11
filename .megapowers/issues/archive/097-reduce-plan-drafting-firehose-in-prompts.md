---
id: 97
type: feature
status: closed
created: 2026-03-07T14:56:48.748Z
sources: [94]
milestone: M3
priority: 2
---
# Reduce plan drafting firehose in prompts/write-plan.md with staged drafting guidance
## Problem

`prompts/write-plan.md` asks one session to ingest the full spec, codebase, and task set, then write the entire plan in one pass. For larger plans this creates a firehose effect: the drafter loses track of coverage, dependencies, and realism.

## Scope

Improve `prompts/write-plan.md` to encourage staged drafting and explicit intermediate audits.

Desired changes:
- tell the planner to build a compact working summary before writing tasks
- encourage drafting tasks in small batches, then checking coverage/dependencies before continuing
- require a final whole-plan pass after the last task is written
- preserve the strong requirement for copy-pasteable task bodies and real code/API references

## Acceptance criteria

1. `prompts/write-plan.md` explicitly recommends chunked planning instead of one giant uninterrupted dump.
2. The prompt instructs the drafter to maintain a compact acceptance-criteria/dependency summary while drafting.
3. The pre-submit checklist still enforces full-plan validation before `plan_draft_done`.
4. Existing task template and self-containment requirements remain intact.
