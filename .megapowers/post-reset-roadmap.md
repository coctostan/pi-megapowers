# Post-Reset Roadmap Draft

## Purpose

This document resets the roadmap around a fresh product view instead of inheriting stale issue definitions.

It is intentionally **theme-first, not issue-first**.

The goal is to:
- preserve valid insights from older backlog items
- retire stale framing and accidental commitments
- finish the current UX tranche cleanly
- create a better basis for collaborative planning afterward

---

## Product Thesis

pi-megapowers is a structured development workflow layer for Pi.

Its core job is to make issue-driven work feel:
- guided
- inspectable
- artifact-backed
- stateful
- disciplined

The product is strongest when a user can move through a workflow with clarity about:
- what phase they are in
- what the system is doing
- what artifacts matter
- what the next step is
- how completion is determined

---

## Current Reality

The project already has substantial foundations in place:
- workflow state machine
- feature + bugfix flows
- TDD enforcement
- artifact capture
- plan/review loop
- direct primary-session implementation flow
- git-based workflow integration
- pipeline/subagent infrastructure
- issue management and command UX

This means the project is no longer at the stage where old ad hoc issues should automatically define the roadmap.

Some older issues still contain useful observations, but many are:
- stale
- overlapping
- framed around outdated assumptions
- too broad to function as healthy current commitments

So the backlog should be reset.

---

## Active Work Kept Intact

The only currently trusted active implementation issues are the fresh UX issues:
- #122 — Phase entry UX — explicit kickoff instead of dummy first messages
- #120 — Megapowers context visibility — show and inspect injected context
- #121 — Megapowers operation feedback — progress, result summaries, and next-step clarity

These remain active because they are recent, specific, and aligned with current product understanding.

---

## Reset Decision

Outside the current UX tranche, legacy open issues should be treated as **source material, not roadmap commitments**.

That means:
- do not assume their scope is still correct
- do not assume their sequencing is still correct
- do not treat their wording as product truth
- do preserve any valid underlying insights for re-synthesis

This reset is meant to reduce fake clarity and create a healthier planning surface.

---

## Roadmap Themes

## Theme 1 — Workflow clarity and trust

**Core question:**
How does the workflow feel understandable and trustworthy while the user is inside it?

**Includes:**
- explicit phase kickoff
- visible injected context
- visible tool progress
- result summaries
- next-step clarity
- less hidden behavior

**Why it matters:**
If users cannot tell what the system is doing, the workflow feels magical in the wrong way.

**Current status:**
Actively represented by #119 / #120 / #121.

**Success signal:**
A user can always tell:
- where they are
- what just happened
- why it happened
- what they should do next

---

## Theme 2 — Core loop coherence

**Core question:**
How does Megapowers stay coherent over longer, messier, multi-step work instead of decaying into prompt sludge and historical noise?

**Includes:**
- context boundaries between phases and tasks
- what should persist vs reset
- relationship between state, artifacts, and conversation history
- plan/review iteration continuity and lineage
- workflow gate reliability
- artifact trustworthiness

**Why it matters:**
This is the difference between a workflow that demos well and a workflow that remains usable over real projects.

**Success signal:**
Longer work still feels structured, scoped, and explainable.

**Important note:**
This theme likely contains the valid core of several older issues, but it should be redefined from current product understanding rather than inherited directly from stale tickets.

---

## Theme 3 — Verified non-code work

**Core question:**
How should Megapowers support prompts, skills, docs, and other non-standard work inside its TDD philosophy?

**Includes:**
- prompt changes
- skill edits
- documentation-oriented tasks
- scenario-based verification
- constrained write rules for non-code work
- reviewable evidence of improvement

**Why it matters:**
In this repo, prompts and workflow behavior are product code.

If Megapowers only works cleanly for conventional code tasks, it does not fully support its own codebase.

**Success signal:**
A user can change prompts or skills with a repeatable, inspectable verification loop that feels principled, even if it is not identical to unit-test-driven code work.

---

## Theme 4 — Project operating system

**Core question:**
How far should Megapowers expand beyond issue execution into project initialization, project memory, and project governance?

**Includes:**
- init workflows
- brownfield onboarding
- greenfield setup/process scaffolding
- foundation docs
- doc update proposals
- drift analysis
- roadmap/project governance support

**Why it matters:**
This is a potential second product surface: not just guiding individual issues, but helping define and maintain the project itself.

**Risk:**
This is easy to over-expand before the core loop is fully mature.

**Success signal:**
Megapowers can help establish and maintain project operating context without weakening the quality of the core issue workflow.

---

## Sequence Guidance

The roadmap should currently be approached in this order:

1. **Finish Theme 1** — workflow clarity and trust
2. **Reassess and likely move into Theme 2** — core loop coherence
3. **Then consider Theme 3** — verified non-code work
4. **Only after that decide whether to invest in Theme 4** — project operating system expansion

This ordering follows the principle:

> stabilize the core workflow before broadening the kinds of work or the scope of the product

---

## What Is Not Yet Committed

The following are explicitly **not** active commitments until they are freshly redefined:
- legacy non-UX backlog items
- project initialization flows
- foundation doc lifecycle automation
- broad project lifecycle/governance work
- stale milestone sequencing inherited from older issues

These may return later as fresh issues, but not under automatic continuity from the old backlog.

---

## Planning Principles

When creating fresh issues after the UX tranche, prefer:
1. current product understanding over inherited ticket wording
2. artifact-backed clarity over hidden prompt accumulation
3. small, crisp implementation slices over broad umbrella features
4. inspectable mechanisms over over-automation
5. clear user-visible outcomes over internally convenient abstractions

---

## How Legacy Issues Should Be Handled

Recommended treatment for older non-UX issues:
- close or archive them as stale/superseded/reframing-needed
- preserve any useful ideas in planning notes or handoff docs
- do not keep them open simply because they contain partially valid thoughts

Suggested closing rationale:

> Closing during roadmap reset. The underlying ideas may still matter, but this issue no longer represents a current-enough framing to keep as an active roadmap commitment.

---

## Collaborative Planning Questions

After the current UX tranche, planning should focus on answering a small number of high-value questions together:

### For Theme 2 — Core loop coherence
- What is the canonical memory of the system: state, artifacts, conversation, or some layered combination?
- What context should carry between phases, and what should be aggressively dropped?
- How should review/revise rounds be represented so they feel iterative rather than reset-based?
- Which parts of the workflow feel least trustworthy today?

### For Theme 3 — Verified non-code work
- What kinds of non-code work matter enough to become first-class?
- What is the smallest credible verification model for prompts/skills/docs?
- What evidence should count as a pass/fail or meaningful regression check?

### For Theme 4 — Project operating system
- Do we really want Megapowers to own project initialization, or just assist it?
- What are the minimum foundation docs worth formalizing?
- How much project governance belongs in-product versus in normal repository conventions?

---

## Proposed Planning Output After UX

Once the current UX work is complete, the next planning step should be to collaboratively produce:
- a short product reassessment
- selection of the next roadmap theme
- 1–3 fresh issues only
- explicit non-goals for the next tranche

That planning pass should be treated as a fresh synthesis, not a revival of the old backlog.

---

## Status of This Document

This is a working draft to support roadmap reset and collaborative planning.

It is intentionally higher level than an issue list.

Its job is to create a better planning frame, not to lock in implementation commitments prematurely.
