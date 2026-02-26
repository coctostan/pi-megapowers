# Phase 4: Architecture — Process Template

> **What we learned by doing this on megapowers, 2026-02-25**

---

## Purpose

Answer: **"What does the system look like today, and what needs to change?"**

For brownfield: the LLM reads the codebase and documents the current architecture first, then proposes changes in a separate document. For greenfield: the LLM asks "how do you want to accomplish the PRD?" and designs from scratch.

## Critical Process Rule: Current Before Proposed

**For brownfield, document what EXISTS before proposing what SHOULD exist.** These are two separate documents:

1. **Current architecture** — as-built, based on reading actual code. Module map, state model, data flow, strengths, weaknesses.
2. **Proposed architecture** — how to evolve the current system to deliver the PRD. Design decisions, migration path, open questions.

**Why separate:** The current architecture doc is a reference that stays accurate as long as the code hasn't changed. The proposed architecture is a design document that will be debated, revised, and partially implemented. Mixing them makes both worse.

**What we learned:** The first draft combined current and proposed in one document. The human correctly called this out: "it should probably be the current architecture, not proposed." Proposed is fine but belongs in a separate doc.

---

## Brownfield Process

### Step 1: LLM Reads the Codebase

The LLM should read:
- Entry point(s) — understand the wiring
- Core modules — state management, configuration, types
- The largest files — these are usually where complexity lives
- Test files — understand what's tested and how

For megapowers, the key reads were: `index.ts` (870 lines — the monolith), `state-machine.ts` (the engine), `ui.ts` (573 lines — the second largest), `gates.ts`, `write-policy.ts`, `prompt-inject.ts`, `store.ts`, `tool-signal.ts`, and the subagent files.

**How much to read:** `wc -l *.ts | sort -n` gives you the size distribution. Read the top 5-8 files fully. Skim the rest by reading exports and function signatures.

### Step 2: Document Current Architecture

Produce a document with these sections:

1. **Overview** — size, structure, key patterns
2. **Module map** — every file, its purpose, its size, its key functions
3. **State model** — what's stored, where, what format
4. **Artifact storage** — directory structure, what goes where
5. **Workflow sequences** — phase progressions, backward transitions
6. **Hook/lifecycle pipeline** — how the system responds to events
7. **Strengths** — what works well (preserve these)
8. **Weaknesses** — what doesn't work (these drive the proposed changes)
9. **Technical constraints** — what the platform gives you and limits you to
10. **Open questions** — things you need answered to design the V1 architecture

### Step 3: Propose Architecture (Separate Doc)

The proposed architecture addresses every weakness listed in the current doc. It should include:
- Module structure (where files go)
- Design decisions with rationale
- Migration path (restructure, not rewrite)
- Open questions that block implementation

### Step 4: Human Reviews and Clarifies

The human reviews both documents. Questions to ask:
- "Is the module map accurate?"
- "Did I miss any strengths or weaknesses?"
- "Which open questions can you answer now?"
- "Is the proposed migration path realistic?"

---

## Greenfield Process

For greenfield, skip steps 1-2. Instead:

1. LLM asks: "The PRD says we need X, Y, Z. How do you want to architect this?"
2. Human describes their preferences (monolith vs microservices, framework choices, etc.)
3. LLM proposes architecture based on PRD + human preferences
4. Iterate until the human approves

---

## What We Learned

### The LLM should read code, not ask the human to explain it
The first attempt started with questions: "How does the state machine work? How does prompt injection work?" The human correctly redirected: "For brownfield, the LLM should make the first pass." The codebase IS the truth. Read it.

### The largest files tell you where the problems are
`index.ts` at 870 lines and `ui.ts` at 573 lines were the two biggest files. They were also the two biggest architectural problems (monolith entry point, mixed rendering/mutation). `wc -l | sort -n` is your friend.

### Strengths are as important as weaknesses
It's tempting to focus on what's wrong. But documenting what works well prevents the proposed architecture from accidentally breaking good patterns. "Disk-first state" and "pure core functions" were strengths that the proposed architecture explicitly preserves.

### Open questions are the most valuable output
The architecture doc produced 5 open questions that each block a different design decision. These questions become the first things to resolve before implementation begins. Without them, you'd discover these blockers mid-implementation.

---

## Gate

Architecture phase is done when:
- Current architecture is documented (module map, state model, strengths, weaknesses)
- Proposed architecture exists as a separate document
- Open questions are identified and listed
- The human has reviewed both and confirmed accuracy

## What Comes Next

Roadmap takes the proposed architecture's migration path and breaks it into ordered milestones. Each milestone becomes a set of issues. The open questions from architecture should be resolved before or during roadmap planning.
