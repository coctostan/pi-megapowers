---
id: 73
type: feature
status: done
created: 2026-02-25T18:50:00.000Z
sources: [33, 46, 53, 58]
milestone: M1
priority: 2
---

# /mp Command Hub & Issue Management UX

## Problem

1. **Commands scattered** — `/mp on`, `/mp off`, `/mp status`, etc. with no discoverability, no help text, no grouping.
2. **Issue creation is manual** — no LLM tool for creating issues programmatically, `/issue new` uses manual TUI prompts instead of LLM-assisted drafting.
3. **Issue list is basic** — no colors, icons, sorting, or visual distinction between states.

## Proposed Solution

### Command hub
`/mp` with no args shows grouped command listing. Commands self-register with metadata (name, group, description, usage). `/mp help <command>` for usage.

### Issue management
- Register `create_issue` tool so LLM can create issues during any session
- LLM-assisted `/issue new` — agent drafts issue collaboratively using conversation context
- Enhanced issue list UI with colors, icons, sorting

## Acceptance Criteria

- [ ] `/mp` shows grouped command listing
- [ ] `/mp help <command>` shows usage
- [ ] Command registry pattern (self-registering)
- [ ] `create_issue` LLM tool registered
- [ ] LLM-assisted issue creation flow
- [ ] Issue list with colors, sorting, state indicators

## Notes
- Absorbs #058 (issue management UX).
