# Roadmap

## Completed

- **Core platform** — State machine, jj integration, TUI, feature + bugfix workflows
- **TDD enforcement** — Blocks production writes until tests written and failing
- **Task coordination** — Per-task jj changes, satellite TDD for subagents
- **Issue triage & batching** — LLM-driven grouping of related issues
- **State refactor** — Disk-first architecture, derived data from artifacts
- **Subagent robustness** — jj prerequisite checks, agent optimization, phase-aware context (#060)
- **Agent context & awareness** — Prompt quality, TDD edge cases, baseline context (#050)
- **Generalized state machine** — WorkflowConfig-driven phases and transitions (#071)
- **Phase transition UX** — Killed popup, streamlined transitions (#072)
- **Subagent pipeline** — Workspace squash, structured handoff, rich UI, per-task chains (#067, #074, #075, #076)
- **Codebase restructure** — Directory reorganization, command extraction, LLM tool exposure (#070, #043)
- **UX foundation** — jj dialog fix, save_artifact versioning, interactive UX, feedback & visibility (#041, #042, #051, #061)
- **Backward phase transitions** — LLM tools and slash commands for phase rollback (#069)
- **Prompt-test task type** — TDD for prompts and skills (#068)
- **Prompt/skill audit workflow** — New workflow type for non-code work (#062)

## Current: M1 (1 remaining) + M3 + M4

| Issue | Milestone | Description |
|-------|-----------|-------------|
| #073 | M1 | /mp command hub — unified entry point for all commands |
| #066 | M3 | Merge plan + review into iterative loop (absorbs #059 plan versioning) |
| #087 | M4 | Done phase + VCS — artifact capture, squash, and push (#065 + #083) |

## Later: M5 Issue Management + M6 Init System

| Issue | Milestone | Description |
|-------|-----------|-------------|
| #084 | M5 | Issue management — create, list, sort, archive, priority (#058 + #077) |
| #085 | M6 | Foundation content — doc audit + greenfield templates (#081 + #082) |
| #086 | M6 | Init engine — workflow system + doc lifecycle (#078 + #079) |
| #080 | M6 | Clean context windows (absorbs #059 context mgmt) |
