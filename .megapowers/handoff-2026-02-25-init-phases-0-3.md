# Handoff: Init Phases 0–3 Complete

> **Date:** 2026-02-25
> **Session:** Phase 3 (PRD) completed in continuation of Phases 0-2

---

## What's Done

| Phase | Deliverable | Process Template |
|-------|------------|-----------------|
| 0. Audit | `init/megapowers/00-audit.md` | `init/process/00-audit.md` |
| 1. Discovery | `init/megapowers/01-discovery.md` | `init/process/01-discovery.md` |
| 2. Vision | `init/megapowers/02-vision.md` | `init/process/02-vision.md` |
| 3. PRD | `init/megapowers/03-prd.md` | `init/process/03-prd.md` |

## What's Next: Phase 4 — Architecture

**Question:** "How do we build it?"

This is where the PRD's requirements become system design. Key inputs:
- The priority ordering (UX → subagents → done → plan/review → backward transitions → TDD → issues)
- The two-system structure (init + dev)
- The FAQ's "what's technically hard" section (jj workspace isolation, multi-model orchestration, foundation doc lifecycle)
- The existing audit (`project-audit-2026-02-24.md`) which mapped the current architecture in detail

**Key architecture questions to resolve:**
- How does the init system's state machine relate to the dev system's state machine? Same engine, different configs? Separate engines?
- How does multi-model orchestration work for plan/review? Who manages model selection, API routing, prompt dispatch?
- How does the subagent ↔ jj workspace ↔ squash pipeline actually work end-to-end?
- What's the UX architecture? How are prompts, choices, and feedback rendered? What pi APIs does this use?
- How do foundation docs get consulted during brainstorm and updated during done? What's the mechanism?

## Remaining Phases

| Phase | Status |
|-------|--------|
| 4. Architecture | **Next** |
| 5. Roadmap | Pending |
| 6. Issues → Workflows | Pending |

---

## Key Decisions Made in Phase 3

1. **Two systems, four flavors.** Init (green/brown) + Dev (feature/bugfix). Not three or four workflow types.
2. **Plan/review is one phase** with a Momus-style loop. Separate models for planner and reviewer.
3. **Subagents are V1-required** and must work reliably. Parallel is V1.1.
4. **Done phase automates VCS** — local merge or push/PR. User chooses at done time.
5. **Backward transitions invalidate downstream.** No skipping phases on the way back up.
6. **TDD is default-on, overridable** per-task by user or plan author.
7. **UX is priority #1.** Currently 2/10. Must be usable by someone who didn't build it.
8. **Init is V1 scope.** Foundation docs are living documents consulted during brainstorm and updated during done.
9. **Wisdom accumulation is V1.1**, not V1.0.
10. **V2/V3 may swap** — polish vs agent-orchestratable, depending on which need appears first.

## Process Lessons Learned

### Phase 3 specific:
- **Question rounds of 3-5 work best.** One at a time is slow. Ten at a time gets shallow answers.
- **Ask for priority ordering explicitly.** The LLM's assumed ordering was completely wrong — UX was #1, not plan/review.
- **Ask "what did I miss?" — you WILL miss something.** The LLM forgot the entire init system despite being in the middle of building it.
- **External references transform vague requirements into specific ones.** The oh-my-opencode Momus pattern and pi subagent example turned "needs to work better" into implementable specs.
- **Exclude corporate PRD sections that don't serve the product.** Personas, competitive analysis, migration paths — noted but not included. They add pages, not clarity.

### Cumulative (Phases 0-3):
- **Questions first, document last.** (Learned in Phase 2, reinforced in Phase 3)
- **The human's language is better than the LLM's.** Listen for their phrasing.
- **Current state honesty matters.** "Absolute dogshit" communicates more than "needs improvement."
- **Process templates are written AFTER doing, not before.** Each phase produces both the deliverable and the how-we-did-it guide.
