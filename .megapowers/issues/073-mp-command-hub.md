---
id: 73
type: feature
status: open
created: 2026-02-25T18:50:00.000Z
milestone: M1
priority: 2
---

# /mp Command Hub

## Problem

Commands are scattered: `/mp on`, `/mp off`, `/mp status`, `/mp issues`, `/mp start`, etc. There's no discoverability — users have to know what exists. No help text. No grouping. Adding a new command means editing index.ts and hoping someone finds it.

## Proposed Solution

`/mp` with no args shows a command hub:
```
megapowers commands:
  workflow   status, phase, signal
  issues     list, start, create, archive
  config     on, off, tdd
  info       status, milestones, help
```

Each group is a submenu or can be accessed directly (`/mp issues list`). `/mp help <command>` shows usage.

Under the hood, commands register themselves with metadata (name, group, description, usage). The hub is generated from the registry.

## Acceptance Criteria

- [ ] `/mp` with no args shows grouped command listing
- [ ] Commands organized into logical groups
- [ ] `/mp help <command>` shows usage for any command
- [ ] Command registry pattern — commands self-register with metadata
- [ ] All existing commands still work at their current paths
- [ ] New commands can be added by registering, not editing hub code

## Notes

- Depends on #043 (extract slash commands) for the command extraction.
- The registry pattern also enables #043's goal of exposing commands as LLM tools.
