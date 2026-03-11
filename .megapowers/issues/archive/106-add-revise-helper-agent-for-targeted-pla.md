---
id: 106
type: feature
status: done
created: 2026-03-07T14:57:33.660Z
sources: [95]
milestone: M3
priority: 2
---
# Add revise-helper agent for targeted plan revision support
## Problem

Revise sessions tend to either reload the entire plan or make shallow fixes that do not address the root issue.

## Scope

Add a project-scoped `revise-helper` agent in `.pi/agents/revise-helper.md`.

The agent should:
- read the latest `revise-instructions-N.md`
- focus on only the affected task files
- propose concrete task-body replacements or edit snippets
- include a lightweight regression check for coverage/dependency fallout
- remain advisory only

## Acceptance criteria

1. `.pi/agents/revise-helper.md` exists with a narrow revise-support prompt.
2. The prompt tells the agent to avoid rewriting unaffected tasks.
3. The output format includes both local fixes and a short global sanity check.
4. The prompt explicitly states that the main session performs actual task edits and resubmission.
