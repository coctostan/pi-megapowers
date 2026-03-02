---
id: 82
type: feature
status: done
created: 2026-02-25T19:15:00.000Z
milestone: M6
priority: 1
---

# Greenfield Process Templates

## Problem

The brownfield process templates exist (8 phases, proven on this project). Greenfield variants don't. A user starting a new project from scratch can't use the init system because the templates assume an existing codebase to analyze.

Greenfield skips audit and discovery (no codebase) and needs different prompts for the remaining 5 phases: vision, PRD, architecture, roadmap, conventions.

## Proposed Solution

Derive greenfield variants from the brownfield templates. For each phase, identify what changes:

### Phase differences

| Phase | Brownfield | Greenfield |
|-------|-----------|------------|
| 0. Audit | Analyze existing codebase | **Skip** |
| 1. Discovery | Interview about existing project | **Skip** |
| 2. Vision | "Where should this project go?" (has context) | "What do you want to build?" (from scratch) |
| 3. PRD | Constrained by existing users, APIs, tech debt | Unconstrained — pure requirements |
| 4. Architecture | Migration path from current → proposed | Design from scratch, no constraints |
| 5. Roadmap | Includes restructuring, migration milestones | Pure feature sequencing, no migration |
| 6. Conventions | Read existing code, document patterns | Choose conventions from scratch |
| 7. Issues | Map existing issues + fill gaps | All new issues from roadmap |

### Deliverables

- `init/process/02-vision-greenfield.md` (or unified with brownfield flag)
- `init/process/03-prd-greenfield.md`
- `init/process/04-architecture-greenfield.md`
- `init/process/05-roadmap-greenfield.md`
- `init/process/06-conventions-greenfield.md`
- `init/process/07-issues-greenfield.md`

### Open question: separate files or unified with flags?

Option A: Separate files per variant (clear, but duplicates shared content).
Option B: Single file per phase with brownfield/greenfield sections (DRY, but longer).

Decide during planning. Brownfield templates already use "Brownfield Process" / "Greenfield Process" sections in some phases (e.g., 06-conventions). Could standardize that pattern.

## Acceptance Criteria

- [ ] Greenfield variants exist for phases 2–7
- [ ] Each greenfield variant produces a usable output when no codebase exists
- [ ] Vision phase works from a user description, not codebase analysis
- [ ] Architecture phase designs from scratch, not migration
- [ ] Roadmap phase sequences features without restructuring milestones
- [ ] Conventions phase prompts for choices rather than reading existing patterns
- [ ] Issues phase creates all-new issues (no existing issue mapping)

## Notes

- Depends on #081 (foundation doc audit) — clean brownfield templates before deriving greenfield.
- Some brownfield templates already have greenfield notes (06-conventions has a "Greenfield Process" section). Extend this pattern.
- The greenfield templates can't be validated the way brownfield ones were (by running them on this project). Consider testing on a small throwaway project.
