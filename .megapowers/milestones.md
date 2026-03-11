# Milestones

> Operational roadmap after backlog reset.
> Legacy non-UX issues are no longer treated as active commitments unless reaffirmed by fresh planning.

---

## Historical Foundations — shipped

These are major capabilities already in place and now form the platform:
- workflow state machine
- feature + bugfix workflows
- TDD enforcement
- direct primary-session implement flow
- plan/review loop
- artifact capture refactor
- git-based VCS integration
- issue management and command hub
- subagent/pipeline infrastructure

These are considered shipped foundations, not active milestone work.

---

## M0 — Structural Hardening

**Status:** Planned

**Theme:** Reduce architectural friction in the workflow core so UX and next-step workflow work can land cleanly.

**Purpose:**
This is a targeted cleanup milestone, not a general refactor pass.

### Goals
- unify duplicate/shadowed plan infrastructure
- remove deprecated review-approval drift
- make plan-loop behavior easier to reason about and change safely

### Definition of success
- one canonical plan entity/storage path
- no deprecated `review_approve` behavior exposed or instructed anywhere
- clearer ownership of plan-loop orchestration

### Fresh issues
- #123 — Canonicalize plan entity and storage infrastructure (P1, open)
- #124 — Remove deprecated review-approval path from product surface (P1, open)
- #125 — Consolidate plan-loop orchestration boundaries (P2, open)

---

## M1 — Workflow Clarity and Trust

**Status:** In progress

**Theme:** Make the workflow understandable and usable in-session without hidden behavior or confusing dead-ends.

### Active issues
| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| 122 | Phase entry UX — explicit kickoff instead of dummy first messages | 1 | open |
| 120 | Megapowers context visibility — show and inspect injected context | 2 | open |
| 121 | Megapowers operation feedback — progress, result summaries, and next-step clarity | 2 | open |

### Definition of success
A user can:
- enter a phase without needing a fake first message
- inspect what context was injected and why
- understand what a tool/action just did
- understand what they should do next

---

## Next Themes After M1

These are planning themes, not committed milestone issue lists.

### Theme A — Core loop coherence
Primary question:
How does Megapowers stay coherent over longer, messier, multi-step work?

Current strongest problem signal:
- large-work plan review does not converge reliably within the current loop budget

### Theme B — Verified non-code work
Primary question:
How should Megapowers support prompts, skills, docs, and other non-standard work inside its TDD philosophy?

### Theme C — Project operating system
Primary question:
How far should Megapowers expand beyond issue execution into project initialization, project memory, and project governance?

### Theme D — System integrity and auditability
Primary question:
How much structure should the system impose on artifacts and workflow data?

---

## Milestone sequencing

Current intended sequence:
1. **M0** — Structural Hardening
2. **M1** — Workflow Clarity and Trust
3. **Theme A** — Core loop coherence
4. **Theme B** — Verified non-code work
5. **Theme C** — Project operating system

This sequence may be refined after M0 and M1 based on fresh product learning.
