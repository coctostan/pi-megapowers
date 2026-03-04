# Roadmap

## Completed

- **M0: Restructure** — Directory reorganization (#070), slash command extraction (#043)
- **Core platform** — State machine (#071), TUI, feature + bugfix workflows
- **TDD enforcement** — Blocks production writes until tests written and failing
- **Phase transition UX** — Killed popup (#072), backward transitions (#069)
- **Subagent pipeline** — Workspace squash (#067), per-task implement→verify→review chain (#076)
- **Plan-review loop** — Iterative draft/review/revise with entity parser (#066, #085); bypass bug fixed (#088, #089 via #090)
- **Done phase** — Artifact capture refactor (#065), save_artifact removed (#041, #063)
- **Agent context & awareness** — Prompt quality, TDD edge cases (#050)
- **Prompt/skill audit** — Workflow type for non-code work (#062)
- **M4: VCS integration** — Comprehensive git branching & PR workflow (#083), jj removal → git worktrees (#091)
- **M1 partial** — /mp command hub & issue management UX (#073); done-phase bugs resolved (#081, #082, #083, #084)
- **M2: Subagent pipeline** — Pipeline reliability & structured handoff (#086 batch: #085 squash fix, #074 TUI visibility panel)
- **M3 partial** — Reviewer-authored revise-instructions handoff (#082)

## Current: M1 — UX Foundation (2 remaining)

| Issue | Pri | Status | Description |
|-------|-----|--------|-------------|
| #051  | P2  | open   | UX feedback, visibility & transparency (absorbs #042) |
| #073  | P2  | ✅ done | /mp command hub & issue management UX (absorbs #058) |
| #087  | P2  | open   | push-and-pr done action fails when not on feature branch |

## Next: M3 — Workflow Iteration Quality (2 remaining)

| Issue | Pri | Status | Description |
|-------|-----|--------|-------------|
| #082  | P1  | ✅ done | Reviewer-authored revise-instructions handoff |
| #059  | P2  | open   | Context management and plan-review versioning |
| #088  | P2  | open   | Use individual task files instead of plan.md |

## Later: M5–M6

| Issue | Milestone | Description |
|-------|-----------|-------------|
| #068  | M5  | `[prompt-test]` task type — TDD for prompts and skills |
| #077  | M5  | Issue priority, archiving, and list UI |
| #089  | M5  | Add Zod frontmatter schemas to phase artifact files |
| #078  | M6  | Init workflow system — doc audit, greenfield templates, workflow engine (absorbs #081, #082) |
| #079  | M6  | Foundation doc lifecycle — inject, update, audit |
| #080  | M6  | Clean context windows |
| #052  | M6  | Project lifecycle management — onboarding, roadmap, branching |
