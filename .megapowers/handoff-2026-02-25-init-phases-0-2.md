# Handoff: `/mp init` Process Design — Phases 0-2 Complete

> **Date:** 2026-02-25
> **Session:** ~2 hours, Max + Claude collaborative
> **Next step:** Phase 3 — PRD + FAQ (collaborative)

---

## What Happened

We're building two things simultaneously:
1. **The `/mp init` process itself** — a structured project initialization flow that will become a megapowers feature
2. **Megapowers' own strategic foundation** — running that process on ourselves as the first test case

Each phase produces two artifacts: the **deliverable** (megapowers-specific) and the **process template** (generalizable, learned from doing it).

---

## What Exists

```
.megapowers/init/
  skeleton.md                        ← overall flow definition (6 phases + meta rules)
  process/
    00-audit.md                      ✅ how to do a brownfield audit (7 sections)
    01-discovery.md                  ✅ how to do discovery (4 sections + open questions)
    02-vision.md                     ✅ how to do vision (COLLABORATIVE — biggest process lesson)
  megapowers/
    00-audit.md                      ✅ megapowers audit (full systematic assessment)
    01-discovery.md                  ✅ megapowers discovery (customer, problem, landscape)
    02-vision.md                     ✅ megapowers vision (north star, PR, vision arc, decisions)
```

---

## Key Findings & Decisions

### From the Audit (Phase 0)
- **4,107 LOC, 30 modules, 574 passing / 3 failing tests** (failures are stale test expectations, not bugs)
- Architecture is clean: disk-first, pure functions, derived data, no mutable module state
- **Core workflows work end-to-end** for the happy path
- **Edges are incomplete:** done phase is hollow, backward transitions exist in tables but aren't wired, subagent squash is dead code, no onboarding, no measurement
- **One-sentence assessment:** "Megapowers proves the concept works but can't yet prove it to anyone who isn't already using it."

### From Discovery (Phase 1)
- **Customer:** The vibe coder who wants to build real software. Technical or non-technical. Wants speed AND robustness.
- **Problem:** Vibe coding makes quick garbage. AI skips steps, humans lose discipline, debt compounds in hours not months, no proof of process.
- **Competitive landscape mapped:**
  - **pi-superpowers-plus:** Same workflow shape, but advisory-only enforcement (warnings, not blocks). Skills-first. Better onboarding than us.
  - **Compound Engineering (Every):** Plan → Work → Review → Compound. Cross-platform (7 tools). Zero enforcement. Knowledge flywheel is the unique insight we should steal.
  - Raw vibe coding, prompt guardrails, agent swarms, manual discipline — all cataloged.
- **Key insight:** Everyone else chose soft enforcement because hard enforcement is hard. Megapowers is the only tool that actually blocks, gates, and requires.
- **Project scale spectrum:** Middle 80% (CLI tools through SaaS platforms, not scripts or Google-scale). Init flow must telescope.
- **Four doors at init:** Light / Standard / Full / "Help me decide" (LLM asks questions, recommends tier)

### From Vision (Phase 2)
- **North star:** "Vibe coding is dead... long live Vibe Engineering."
- **Not a product play.** Built as a personal weapon for winning at agentic coding. If others want it, they can have it.
- **pi-only.** Deep integration is the advantage. No cross-platform dilution.
- **Three-horizon vision arc:**
  - **V1 — Human Loop:** Single developer + megapowers + AI agent. Hard enforcement, artifacts, tiered init, knowledge flywheel.
  - **V2 — Multi-Agent Loop:** Agent orchestrators use megapowers to enforce process on sub-agents. Agents auditing agents. Decision provenance becomes machine-readable.
  - **V3 — Self-Improving Loop:** Cross-project pattern recognition. Process templates that evolve from outcomes. The engineering machine improves itself.
- **Steal the compound step.** Wire learnings into prompt injection as a feedback loop, not a new phase.
- **Three tiers + quick-fix workflow.** Structure scales with stakes.

---

## Process Lessons Learned

1. **Audit: run the tests yourself.** Prior audit said "3 failing tests." Running them revealed they're all stale expectations, not real bugs. The distinction matters for everything downstream.
2. **Discovery: search for competitors, don't just list from memory.** Found compound engineering plugin which reshaped the competitive landscape understanding.
3. **Vision: DO NOT write it solo and present for feedback.** The LLM wrote a complete vision, got 4 fundamental corrections from the human (motivation, tagline, future arc, market stance). Should have been questions-first, document-last. **This is the most important process lesson so far.**

---

## Next Step: Phase 3 — PRD + FAQ

The PRD turns the vision into specific requirements. Per the process lesson from Vision: **start with questions, build collaboratively, write it down last.**

Key inputs for PRD:
- Vision's V1 scope (human loop, hard enforcement, tiered init, knowledge flywheel, quick-fix workflow)
- Audit's half-built features (backward transitions, done phase, subagent squash)
- Audit's missing features (telemetry, audit log, onboarding, documentation)
- Discovery's competitive gaps (onboarding vs SP+, knowledge flywheel vs CE)
- The 17 open issues + 15 unfiled items from the prior council review

The FAQ section is non-negotiable per the skeleton's meta rules. Must answer:
- What are the top 3 reasons this fails?
- What's technically hard?
- What assumptions must be true?

---

## File References

| File | What It Is |
|------|-----------|
| `.megapowers/init/skeleton.md` | Overall `/mp init` flow — 6 phases, brownfield/greenfield, meta rules |
| `.megapowers/init/process/00-audit.md` | Process template: how to do a brownfield audit |
| `.megapowers/init/process/01-discovery.md` | Process template: how to do discovery |
| `.megapowers/init/process/02-vision.md` | Process template: how to do vision (collaborative lesson) |
| `.megapowers/init/megapowers/00-audit.md` | Megapowers audit: codebase health, architecture, features, UX |
| `.megapowers/init/megapowers/01-discovery.md` | Megapowers discovery: customer, problem, alternatives, key insight, scale spectrum |
| `.megapowers/init/megapowers/02-vision.md` | Megapowers vision: north star, PR, vision arc (V1/V2/V3), strategic decisions |
| `.megapowers/handoff-2026-02-25-mp-and-council.md` | Prior session handoff (council review + `/mp` command design) |
| `.megapowers/project-audit-2026-02-24.md` | Prior council-informed audit (22 findings, 6 categories) |
