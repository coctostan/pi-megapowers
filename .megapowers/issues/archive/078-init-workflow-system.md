---
id: 78
type: feature
status: archived
created: 2026-02-25T18:50:00.000Z
archived: 2026-03-11T17:02:47Z
sources: [81, 82]
milestone: M6
priority: 1
---

# Init Workflow System

## Problem

The init phases (audit → discovery → vision → PRD → architecture → roadmap → conventions) were run manually. No workflow engine, no phase tracking, no enforcement. Templates need auditing, and greenfield variants don't exist.

## Scope

### 1. Foundation doc audit (from #081)
- Review all brownfield process templates and project deliverables for misplaced content, gaps, redundancy, stale references
- Verify cross-references between docs
- Fix issues in-place, document findings

### 2. Greenfield templates (from #082)
- Derive greenfield variants for phases 2–7 (skip audit + discovery)
- Vision from user description (not codebase analysis), architecture from scratch (not migration), roadmap without restructuring milestones, conventions chosen fresh

### 3. Workflow engine
- Two WorkflowConfigs: init-brownfield (7 phases) and init-greenfield (5 phases)
- `/mp init [brownfield|greenfield]` starts the workflow
- Phase tracking in state.json, gate conditions enforced per phase
- Output artifacts in `.megapowers/init/<project>/`
- Phase-specific prompt templates with gates (artifact must exist, no open questions)

## Acceptance Criteria

- [ ] Brownfield templates audited and cleaned
- [ ] Greenfield variants created for phases 2–7
- [ ] init-brownfield WorkflowConfig with all 7 phases
- [ ] init-greenfield WorkflowConfig with 5 phases
- [ ] `/mp init` command works
- [ ] Phase tracking and gate enforcement functional
- [ ] Output artifacts land in correct location

## Notes
- Absorbs #081 (foundation doc audit) and #082 (greenfield templates).
- Brownfield templates exist at `.megapowers/init/megapowers/` — need generalization.
- Hard depends on generalized state machine (already shipped in #071).
