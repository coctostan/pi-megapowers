---
id: 70
type: feature
status: open
created: 2026-02-25T18:50:00.000Z
milestone: M0
priority: 1
---

# Directory Restructure

## Problem

All 30+ source files live flat in `src/`. Finding anything requires grepping or memorizing filenames. Related modules (jj ops, prompt templates, UI widgets, parsers) sit next to unrelated ones. This makes onboarding painful and refactoring risky — you can't see module boundaries.

`index.ts` is a monolith: hook handlers, tool handlers, command handlers, registration — all in one file. #043 covers extracting slash commands; everything else (tool_call hook, agent_end hook, tool registration) still needs extraction.

## Proposed Solution

Create directory structure:
```
src/
  core/          # state.ts, transitions.ts, types.ts, config.ts
  workflows/     # feature.ts, bugfix.ts, WorkflowConfig definitions
  hooks/         # tool-call.ts, agent-end.ts, session-start.ts
  tools/         # megapowers-signal.ts, megapowers-save-artifact.ts
  prompts/       # all prompt/template files
  parsers/       # markdown parsers, frontmatter
  ui/            # widgets, formatters, notification
  jj/            # jj operations, workspace, bookmark
  subagent/      # subagent spawn, handoff, tracking
  init/          # init workflow (future, empty for now)
  index.ts       # thin — registration + wiring only
```

Move files, update imports, verify all 546 tests pass.

## Acceptance Criteria

- [ ] Source files organized into subdirectories by concern
- [ ] index.ts reduced to registration and wiring (< 100 lines of logic)
- [ ] Hook handlers extracted to hooks/
- [ ] Tool handlers extracted to tools/
- [ ] All existing tests pass without modification (import paths updated)
- [ ] No behavior change — pure restructure

## Notes

- Depends on nothing. Unblocks everything.
- #043 (slash command extraction) can be done before or after this, but this is broader.
- Must be a single atomic commit to avoid merge hell.
