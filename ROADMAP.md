# Roadmap

## Completed

- **M0: Restructure** — Directory reorganization (#070), slash command extraction (#043)
- **Core platform** — State machine (#071), jj integration, TUI, feature + bugfix workflows
- **TDD enforcement** — Blocks production writes until tests written and failing
- **Phase transition UX** — Killed popup (#072), backward transitions (#069)
- **Subagent pipeline** — Workspace squash (#067), per-task implement→verify→review chain (#076)
- **Plan-review loop** — Iterative draft/review/revise with entity parser (#066, #085)
- **Done phase** — Artifact capture refactor (#065), save_artifact removed (#041, #063)
- **Agent context & awareness** — Prompt quality, TDD edge cases (#050)
- **Prompt/skill audit** — Workflow type for non-code work (#062)

## Current: M1 — UX Foundation

| Issue | Pri | Description |
|-------|-----|-------------|
| #061  | P1  | jj change mismatch dialog frozen — select widget doesn't accept input |
| #051  | P2  | UX feedback, visibility & transparency (absorbs #042) |
| #073  | P2  | /mp command hub & issue management UX (absorbs #058) |

## Next: M2–M4

| Issue | Milestone | Description |
|-------|-----------|-------------|
| #074  | M2  | Subagent structured handoff & rich UI (absorbs #075) |
| #059  | M3  | Workflow iteration quality — context management and plan-review versioning |
| #083  | M4  | Comprehensive VCS integration — git + jj (absorbs #064) |

## Later: M5–M6

| Issue | Milestone | Description |
|-------|-----------|-------------|
| #068  | M5  | `[prompt-test]` task type — TDD for prompts and skills |
| #077  | M5  | Issue priority, archiving, and list UI |
| #078  | M6  | Init workflow system — doc audit, greenfield templates, workflow engine (absorbs #081, #082) |
| #079  | M6  | Foundation doc lifecycle — inject, update, audit |
| #080  | M6  | Clean context windows |
| #052  | M6  | Project lifecycle management — onboarding, roadmap, branching |
