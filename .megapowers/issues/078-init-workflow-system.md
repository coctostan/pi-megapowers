---
id: 78
type: feature
status: open
created: 2026-02-25T18:50:00.000Z
milestone: M6
priority: 1
---

# Init Workflow System

## Problem

The init phases (audit → discovery → vision → PRD → architecture → roadmap → conventions) were run manually for this project. There's no workflow engine driving them — no phase tracking, no gates, no enforcement. A new project would require the same manual orchestration.

## Proposed Solution

Create two WorkflowConfigs (depends on #071):

**init-brownfield:**
```
audit → discovery → vision → prd → architecture → roadmap → conventions
```

**init-greenfield:**
```
vision → prd → architecture → roadmap → conventions
```

Greenfield skips audit and discovery (no existing codebase to analyze).

Each phase has:
- Phase-specific prompt template (brownfield templates exist from this project, greenfield variants needed)
- Gate conditions (artifact must exist, no open questions)
- Output location (`.megapowers/init/<project>/`)

`/mp init [brownfield|greenfield]` starts the workflow. Phase tracking in state.json just like feature/bugfix.

### Greenfield templates needed

Greenfield variants of each phase template that don't reference existing code:
- Vision: starts from user's idea/description, not codebase analysis
- PRD: derives from vision without audit findings
- Architecture: designed from scratch, not constrained by existing patterns
- Roadmap: builds from zero, no "existing state" column
- Conventions: establishes from scratch, no "current conventions" to document

## Acceptance Criteria

- [ ] init-brownfield WorkflowConfig defined with all 7 phases
- [ ] init-greenfield WorkflowConfig defined with 5 phases (skip audit, discovery)
- [ ] `/mp init brownfield` starts brownfield workflow
- [ ] `/mp init greenfield` starts greenfield workflow
- [ ] Phase tracking works (state.json tracks init workflow phase)
- [ ] Greenfield prompt templates created for all 5 phases
- [ ] Brownfield prompt templates verified (exist from this project's init)
- [ ] Gate conditions enforced per phase
- [ ] Output artifacts land in `.megapowers/init/<project>/`

## Notes

- Hard depends on #071 (WorkflowConfig) — can't build init workflows without the generalized engine.
- Brownfield templates already exist at `.megapowers/init/megapowers/` — they need to be generalized (remove project-specific references).
- Greenfield is the bigger design effort — how do you prompt "describe your vision" without an existing codebase to analyze?
