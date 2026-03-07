---
id: 98
type: feature
status: open
created: 2026-03-07T14:56:48.750Z
sources: [94]
milestone: M3
priority: 2
---
# Tighten prompts/revise-plan.md for narrow task revisions plus final global sanity pass
## Problem

Revision sessions currently oscillate between two bad modes: either they rewrite too much, or they fix only the local complaint and accidentally break coverage/dependencies elsewhere.

## Scope

Improve `prompts/revise-plan.md` so revise sessions stay narrow without losing global correctness.

Desired changes:
- keep the instruction to modify only `needs_revision` tasks unless explicitly told otherwise
- add a lightweight final sanity pass for global coverage and dependency regressions
- emphasize that approved tasks should be referenced, not rewritten
- make the root-cause-vs-surface-fix guidance more operational

## Acceptance criteria

1. `prompts/revise-plan.md` clearly distinguishes local task fixes from final whole-plan sanity checks.
2. The prompt explicitly asks the reviser to check for new coverage gaps or forward references introduced by edits.
3. The prompt still prefers surgical edits to task bodies over rewriting the entire plan.
4. Prompt tests are updated if needed.
