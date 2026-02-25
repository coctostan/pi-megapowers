# Roadmap

## Completed

- **Core platform** — State machine, jj integration, TUI, feature + bugfix workflows
- **TDD enforcement** — Blocks production writes until tests written and failing
- **Task coordination** — Per-task jj changes, satellite TDD for subagents
- **Issue triage & batching** — LLM-driven grouping of related issues
- **State refactor** — Disk-first architecture, derived data from artifacts
- **Subagent robustness** — jj prerequisite checks, agent optimization, phase-aware context (#060)

## Current: Stability & UX

| Issue | Description |
|-------|-------------|
| #041 | save_artifact overwrite protection + user feedback |
| #050 | Agent context & awareness — prompt quality, TDD edge cases, baseline context |
| #051 | UX feedback & visibility — progress indicators, notifications |
| #061 | jj mismatch dialog frozen — select widget doesn't accept input |

## Next: Architecture & Features

| Issue | Description |
|-------|-------------|
| #043 | Extract slash commands from index.ts, expose workflow as LLM tools |
| #058 | Issue management UX — create tool, LLM-driven creation, list improvements |
| #062 | Prompt/skill audit workflow — new workflow shape for prompt engineering |

## Later

| Issue | Description |
|-------|-------------|
| #042 | Multi-select done menu + prompt injection visibility |
| #052 | Project lifecycle — onboarding, roadmap updates, branching |
| #059 | Workflow iteration — context management, plan-review versioning |
