# Phase 5: Roadmap — Process Template

> **What we learned by doing this on megapowers, 2026-02-25**

---

## Purpose

Answer: **"In what order do we build it?"**

The roadmap takes the PRD's priorities and the architecture's migration path and sequences them into milestones that deliver value incrementally while respecting technical dependencies.

## Process Is The Same for Brownfield and Greenfield

Roadmap is about ordering work by priority and dependency. Whether the codebase exists or not doesn't change the process — you still have requirements, you still have dependencies, you still need to sequence.

---

## The Process

### Step 1: Map Dependencies

Before sequencing, draw the hard dependency graph. What blocks what?

For megapowers, the key insight was: **restructuring the codebase is a prerequisite for everything else.** You can't add features cleanly to a monolith. This made it M0 even though it delivers no user-visible value.

**How to find dependencies:**
- Architecture migration steps that must happen in order
- Features that use other features (plan/review loop needs the subagent system for the reviewer call)
- Shared infrastructure (generalized state machine needed by init, backward transitions, AND done phase)

### Step 2: LLM Produces First Pass

The LLM should:
1. Read the PRD priority ordering
2. Read the architecture migration path
3. Map each PRD priority to the architecture steps that deliver it
4. Sequence milestones respecting dependencies
5. For each milestone: list steps, risks, and a concrete gate

**What we learned:** The LLM can do this in one pass without much Q&A. The PRD and architecture doc are specific enough by this point. This is the most "autonomous" phase so far — less conversation, more synthesis.

### Step 3: Human Reviews Ordering

The human's priority ordering from the PRD is the primary input, but dependencies may force a different sequence. Call out where the milestone order differs from the priority order and explain why.

For megapowers: done phase is PRD priority #3 but milestone M4 (after plan/review at M3). Reason: plan/review depends on the subagent pipeline (M2), and it's more efficient to build M3 right after M2 while the subagent system is fresh. Done phase has no dependency on M2/M3 so it can slot in after.

---

## Milestone Anatomy

Each milestone needs:

1. **Theme** — one sentence describing the user-visible outcome
2. **Steps** — specific work items with risk ratings
3. **Gate** — concrete, testable condition for "this milestone is done"
4. **Dependencies** — which milestones must be complete first

### On Gates

Gates should be scenarios, not checkboxes. "A 3-task plan can be implemented via sequential subagent delegation with all tasks completing successfully" is better than "subagent tool works."

### On Risk

Rate each step. High-risk items should come early in their milestone so you hit problems fast, not at the end when you're supposedly "almost done."

---

## What We Learned

### Restructuring is always M0 for brownfield
If the codebase isn't organized well enough to build on, that's the first thing to fix. It delivers no user value but it's the prerequisite for everything. Don't skip it. Don't "refactor as you go" — do it once, cleanly, with tests passing.

### Post-M4 checkpoint matters
Identifying a "machine works" checkpoint in the middle of the roadmap is valuable. After M4 in megapowers, the full dev workflow works end-to-end. That's a meaningful milestone to celebrate and test heavily before adding the init system and polish.

### V1.1 milestones belong in the roadmap
Even though they're post-V1.0, listing them keeps them visible and prevents V1.0 scope creep. "That's V1.1" is easier to say when V1.1 has a concrete list.

---

## Gate

Roadmap is done when:
- Every PRD requirement maps to at least one milestone
- Dependencies are identified and the sequence respects them
- Each milestone has a theme, steps, and a concrete gate
- The human approves the ordering
- V1.1+ milestones are listed (even if loosely defined)

## What Comes Next

Issues phase takes each milestone and decomposes it into specific issues that enter the dev workflow. Milestones become the organizing structure for issues (priority, grouping, sequencing).
