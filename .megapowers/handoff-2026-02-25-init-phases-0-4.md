# Handoff: Init Phases 0–4 Complete

> **Date:** 2026-02-25
> **Session:** Phases 3 (PRD) and 4 (Architecture) completed

---

## What's Done

| Phase | Deliverable | Process Template |
|-------|------------|-----------------|
| 0. Audit | `init/megapowers/00-audit.md` | `init/process/00-audit.md` |
| 1. Discovery | `init/megapowers/01-discovery.md` | `init/process/01-discovery.md` |
| 2. Vision | `init/megapowers/02-vision.md` | `init/process/02-vision.md` |
| 3. PRD | `init/megapowers/03-prd.md` | `init/process/03-prd.md` |
| 4. Architecture | `init/megapowers/04-architecture.md` (current) + `04-architecture-proposed.md` (V1 design) | `init/process/04-architecture.md` |

## What's Next: Phase 5 — Roadmap

Take the proposed architecture's migration path and break it into ordered milestones. Each milestone becomes a set of issues.

**Key inputs:**
- PRD priority ordering: UX → subagents → done → plan/review → backward transitions → TDD → issues
- Proposed architecture migration path (9 steps, each independently testable)
- 5 open questions that need answers before/during roadmap

**The open questions to resolve:**
1. Can pi make direct model API calls from an extension?
2. Can pi programmatically start a new conversation?
3. Should V1 keep jj workspaces for sequential subagents? (Recommendation: yes)
4. Should init and dev share state.json? (Recommendation: yes)
5. Should the user see the reviewer's verdict during plan/review? (Transparency vs noise)

## Remaining Phases

| Phase | Status |
|-------|--------|
| 5. Roadmap | **Next** |
| 6. Issues → Workflows | Pending |
| Greenfield variants | Queued — derive from brownfield templates after Phase 6 |

---

## Key Decisions Made in Phase 4

1. **Current architecture documented as-is** — separate from proposed changes
2. **Proposed restructure:** flat → organized subdirectories (core/, workflows/, subagent/, ui/, hooks/, prompts/, parsers/, jj/, init/)
3. **`index.ts` becomes thin wiring** — ~150 lines, no business logic
4. **Generalized state machine** — `WorkflowConfig` type supports all four workflow flavors
5. **Plan/review loop** — one phase with internal Momus-style loop, multi-model (planner + reviewer)
6. **Subagent pipeline extracted** from index.ts, per-task chain (implement → verify → code-review)
7. **UX: `/mp` as single command hub** — replaces fragmented /issue, /phase, /done, /learn, /tdd, /task, /review
8. **Done phase: automated sequence** — one confirmation point, then VCS close
9. **Init system: same engine, simpler config** — shared state.json with system discriminator
10. **Migration is restructure, not rewrite** — existing 546 tests should pass through first 3 steps

## Process Lessons Learned

### Phase 4 specific:
- **For brownfield, read the code — don't ask the human to explain it.** The codebase is the truth.
- **Current before proposed. Separate documents.** Mixing them makes both worse.
- **`wc -l | sort -n` is your friend.** The largest files are usually the biggest problems.
- **Document strengths, not just weaknesses.** Prevents the proposed architecture from accidentally breaking good patterns.
- **Open questions are the most valuable output.** They prevent mid-implementation surprises.

### Cumulative (Phases 0-4):
- Questions first, document last
- The human's language is better than the LLM's
- Current state honesty matters
- Process templates are written AFTER doing, not before
- Never assume priorities — always ask
- External references transform vague requirements into specific ones
- Always ask "what did I miss?"
- For brownfield architecture, read the code first
