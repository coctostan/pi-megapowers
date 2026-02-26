# Handoff: Init Phases 0–7 Complete

> **Date:** 2026-02-25
> **Session:** Phases 3–7 completed in this session. Phases 0-2 completed in prior session.

---

## What's Done

| Phase | Deliverable | Process Template |
|-------|------------|-----------------|
| 0. Audit | `init/megapowers/00-audit.md` | `init/process/00-audit.md` |
| 1. Discovery | `init/megapowers/01-discovery.md` | `init/process/01-discovery.md` |
| 2. Vision | `init/megapowers/02-vision.md` | `init/process/02-vision.md` |
| 3. PRD | `init/megapowers/03-prd.md` | `init/process/03-prd.md` |
| 4. Architecture | `init/megapowers/04-architecture.md` (current) + `04-architecture-proposed.md` (V1 design) | `init/process/04-architecture.md` |
| 5. Roadmap | `init/megapowers/05-roadmap.md` | `init/process/05-roadmap.md` |
| 6. Conventions | `init/megapowers/06-conventions.md` + `.megapowers/TESTING.md` + `.megapowers/IMPLEMENTATION.md` | `init/process/06-conventions.md` |
| 7. Issues | `init/megapowers/07-issues.md` + `.megapowers/milestones.md` + 11 new issues (070–080) | `init/process/07-issues.md` |

## What's Next

1. **Foundation doc audit** — check all init docs for info in wrong spots, gaps, overwrites, redundancy (user requested this explicitly)
2. **Greenfield variants** — derive greenfield process templates from the brownfield set
3. **Enter dev workflows** — start working issues using megapowers

---

## V1.0 Milestone Summary

| Milestone | Theme |
|-----------|-------|
| M0 | Restructure codebase (dirs, extract index.ts, generalize state machine) |
| M1 | UX Foundation (phase transitions, /mp hub, prompt overhaul) |
| M2 | Subagent Pipeline (fix squash, rich UI, per-task chain) |
| M3 | Plan/Review Loop (merge phases, Momus loop, reviewer subagent) |
| M4 | Done Phase (automated sequence, VCS close) |
| M5 | Backward Transitions + TDD Flexibility + Issue Management |
| M6 | Init System + Clean Context Windows |

**Checkpoint:** After M4, full dev workflow works end-to-end.

## Key Decisions Made This Session

### Phase 3 (PRD):
- Two systems (init + dev), four flavors (greenfield, brownfield, feature, bugfix)
- Priority ordering: UX → subagents → done → plan/review → backward transitions → TDD → issues
- Plan/review is one phase with Momus-style loop, separate models for planner/reviewer
- TDD default-on, overridable per-task
- Done phase automates VCS (local merge or push/PR)
- Knowledge flywheel is V1.1, not V1.0

### Phase 4 (Architecture):
- Current architecture documented separately from proposed
- One subagent system for everything (reviewer, verify, code-review, implementation)
- Clean context windows via `pi.sendUserMessage()` → command → `ctx.newSession()`
- Same state machine engine for init + dev, different configs
- Shared state.json with system discriminator
- Keep jj workspaces for V1, fix squash

### Phase 5 (Roadmap):
- 6 milestones, M0 (restructure) is prerequisite for all
- M1-M2 can potentially overlap (UX + subagents share no dependencies)
- After M4 = "machine works" checkpoint

### Phase 6 (Conventions):
- Injectable convention docs: TESTING.md and IMPLEMENTATION.md (both under 1KB)
- Loaded into phase-specific prompts, not the full conventions doc
- Bare minimum, no fluff — they are context-eaters

## Process Lessons (Cumulative)

- Questions first, document last
- The human's language > LLM's language
- Never assume priorities — always ask
- For brownfield architecture, read the code first
- Current before proposed (separate docs)
- Roadmap is the most autonomous phase — less Q&A, more synthesis
- Brownfield conventions write themselves from reading the code
- Injectable docs must be tiny — they go into prompts
- Always ask "what did I miss?" — you WILL miss something (init system, injectable docs)
