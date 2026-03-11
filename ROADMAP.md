# Roadmap

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

## Completed Foundations

Shipped foundations include:
- workflow state machine
- feature + bugfix workflows
- TDD enforcement
- direct primary-session implementation flow
- plan/review loop
- artifact capture refactor
- git-based VCS integration
- issue management and command hub
- subagent/pipeline infrastructure

These are now the platform we build on.

---

## Current Focus

## Phase 0 — Structural hardening

**Goal:** reduce architectural friction in the workflow core so near-term UX and planning work can land cleanly.

This is not a general cleanup phase. It is targeted structural work that directly enables roadmap progress.

### Focus areas
- unify duplicate/shadowed plan infrastructure
- remove deprecated review-approval drift
- reduce fragmentation in the plan/review loop

### Specific concerns observed
- duplicate plan entity infrastructure exists in multiple places (`plan-store`, `entity-parser`, `plan-schemas`)
- deprecated `review_approve` behavior is still wired into commands, tool registration, and tool-instruction generation
- plan/review behavior is spread across hooks, prompt injection, tools, state helpers, and workflow instructions

### Non-goals
- broad UI cleanup
- generic refactors without roadmap payoff
- init/foundation-doc architecture work
- speculative abstraction or folder churn

### Definition of success
- one canonical plan entity/storage path
- no deprecated review approval path taught or exposed by the product
- clearer ownership of plan-loop orchestration

---

## Phase 1 — Workflow clarity and trust

**Goal:** make the workflow understandable and usable in-session without hidden behavior or confusing dead-ends.

### Active issues
- #122 — Phase entry UX — explicit kickoff instead of dummy first messages
- #120 — Megapowers context visibility — show and inspect injected context
- #121 — Megapowers operation feedback — progress, result summaries, and next-step clarity

### Definition of success
A user can:
- enter a phase without needing a fake first message
- understand what context was injected and why
- understand what a tool/action just did
- understand what they should do next

---

## After Phase 1: Fresh planning, not legacy backlog inheritance

Outside the current UX tranche, older backlog items are no longer treated as roadmap commitments.

They may still contain useful observations, but many were created ad hoc and are no longer current enough to define the roadmap as written.

Their underlying ideas should be treated as **source material for re-synthesis**, not as automatically valid scope, sequencing, or problem framing.

---

## Product Themes Under Evaluation

## Theme A — Core loop coherence

**Core question:**
How does Megapowers stay coherent over longer, messier, multi-step work instead of decaying into prompt sludge and historical noise?

**Includes:**
- context boundaries across phases and tasks
- artifact vs state vs conversation as system memory
- review/revise iteration continuity
- workflow gate reliability
- artifact trustworthiness

**Current strongest problem signal:**
Large-work plan review does not converge reliably within the current loop budget. On bigger work, plan review can feel like whack-a-mole rather than a convergent process.

---

## Theme B — Verified non-code work

**Core question:**
How should Megapowers support prompts, skills, docs, and other non-standard work inside its TDD philosophy?

**Includes:**
- prompt changes
- skill edits
- documentation-oriented tasks
- scenario-based verification
- constrained write rules for non-code work
- reviewable evidence of improvement

---

## Theme C — Project operating system

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

---

## Theme D — System integrity and auditability

**Core question:**
How much structure should the system impose on artifacts and workflow data?

**Includes:**
- stronger artifact schemas
- machine-readable metadata
- safer gates
- backward compatibility for older artifacts

---

## Sequence Guidance

The roadmap should currently be approached in this order:

1. **Phase 0** — structural hardening
2. **Phase 1** — workflow clarity and trust
3. **Theme A** — core loop coherence
4. **Theme B** — verified non-code work
5. **Theme C** — project operating system

This ordering follows the principle:

> stabilize the core workflow before broadening the kinds of work or the scope of the product

---

## Roadmap Principles

We will prefer:
1. improving the core workflow before expanding scope
2. artifact-backed clarity over hidden prompt accumulation
3. simple, inspectable mechanisms over heavy automation
4. small, crisp issues over broad umbrella features
5. fresh problem statements over inherited stale tickets

---

## Issue Creation Policy

New issues should only be created when they are:
- based on current product understanding
- scoped to a concrete user-visible or workflow-visible improvement
- narrow enough to implement and review cleanly
- not thin wrappers around stale issue wording

Older issues may be closed, archived, or treated as historical notes when they no longer represent current product thinking.

---

## Near-Term Planning Approach

1. Finish Phase 0 definition and create a small number of targeted issues
2. Finish the current UX tranche
3. Reassess the workflow from fresh experience
4. Choose the next theme based on current product pain, not inherited backlog gravity
5. Create only a few fresh issues from that theme
