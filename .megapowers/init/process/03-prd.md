# Phase 3: PRD + FAQ — Process Template

> **What we learned by doing this on megapowers, 2026-02-25**

---

## Purpose

Answer: **"What specifically do we need to build, and what are the hard questions?"**

The PRD turns the vision into concrete requirements. The vision says what success looks like. The PRD says what you have to build to get there.

## Critical Process Rule: Questions First, Document Last

**Do NOT write a PRD draft and ask for feedback.** This was the Phase 2 lesson and it applies even more here. A PRD has specific, measurable requirements. Getting them wrong and fixing them is 10x harder than asking the right questions first.

The correct flow:
1. LLM asks focused questions in rounds (3-5 questions per round)
2. Human answers — often revealing things the LLM couldn't infer
3. LLM synthesizes understanding, asks follow-up questions
4. Repeat 4-6 rounds until scope, priorities, and hard edges are clear
5. Write the PRD from the conversation, not from inference

**Why rounds matter:** Batching questions (3-5 per round) is the sweet spot. One at a time is tedious and slow. Ten at a time overwhelms and gets shallow answers. Rounds let the human go deep on each topic while maintaining flow.

---

## The Question Progression

We found that PRD questions naturally fall into a progression. Each round builds on the previous.

### Round 1: Scope & Appetite
- What's the V1 boundary? What's in, what's deferred?
- How much time/effort are you willing to invest?
- What does "done enough" look like personally?

**Why start here:** Everything else is constrained by scope and appetite. No point asking about subagent architecture if subagents aren't V1.

**What we learned:** The human's first answer often reveals the real product structure. "These are all V1" told us V1 was bigger than expected. "A process that truly works" told us the bar was reliability, not features.

### Round 2: Workflow & Mechanics
- What workflows/modes exist? Are they distinct or variations of each other?
- What happens at the boundaries (start, end, error, backward)?
- What does "done" mean concretely?

**What we learned:** Ask "are these really separate, or are they flavors of the same thing?" The user thought refactor/hotfix might be separate workflows. Asking the question revealed they're just flavors of feature/bugfix. Saved an entire workflow design.

### Round 3: The Hard Edges
- What happens when things go wrong? (backward transitions, failures, partial completion)
- What's automated vs manual vs guided?
- What's the TDD/testing stance?

**What we learned:** The hard edges are where requirements get specific. "Going backward invalidates everything downstream" — that's a precise, implementable rule. It came from asking "what happens when you go back?" not from inferring behavior.

### Round 4: Pain Points & Priorities
- What's the single most frustrating thing about using it today?
- Ask the human to rank the priorities. Don't assume order.
- Dig into the top 2-3 priorities with follow-up questions.

**What we learned:** This is the most important round. The human's priority ordering was completely different from what the LLM would have guessed:
- LLM assumption: plan/review is #1 (it's the most architecturally interesting)
- Human reality: UX is #1 (it's the most painful day-to-day)

**Never assume priorities. Always ask.**

### Round 5: Reference Implementations & Analogies
- "What should X feel like?" / "Is there something that does Y well?"
- Follow the references — read them, understand them, extract the patterns

**What we learned:** The oh-my-opencode reference transformed the plan/review design from "binary gate" to "iterative loop with ruthless reviewer." The pi subagent example transformed subagent requirements from vague ("needs to work better") to specific ("show model, cost, duration, tool calls in collapsed view"). External references are worth more than internal brainstorming for UX and architecture.

### Round 6: What Did I Miss?
- "Is there anything I haven't asked about that belongs in the PRD?"
- "Does this playback match your understanding?"

**What we learned:** This round caught a critical omission. The LLM completely forgot the init system — the thing we were literally building. The human said "you completely missed the process we are presently working on." Always ask. You WILL miss something.

---

## The Sections

### 1. Scope
Define the product boundaries. For megapowers, this was "two systems, four flavors" — a structural definition, not just a feature list.

**What we learned:** A structural scope definition is better than a feature list. "Two interlocking systems with four flavors" communicates more about the product than a bullet list of 20 features.

### 2. Requirements — Priority Ordered
Not alphabetical. Not grouped by category. **Ordered by the human's stated priority.** Each requirement has:
- Current state (what exists today — be honest, even if it's "dogshit")
- V1 requirement (what must be true)
- Specific, implementable details

**What we learned:** "Current state" is essential for brownfield. It prevents the PRD from being aspirational fiction. When the current state is "absolute dogshit" (the user's words for done phase), that tells you more about priority than any framework.

### 3. Version Roadmap
V1.0, V1.1, V2, V3 — each with a theme and key capabilities. This comes from the vision arc but gets more specific in the PRD.

**What we learned:** Ask for the full version map explicitly. The user had clear ideas about V1.1 (wisdom accumulation, parallel subagents) and V2/V3 (polish vs agent-orchestratable) that only surfaced when asked directly. Note ambiguity honestly — "V2 and V3 may swap" is better than picking arbitrarily.

### 4. FAQ — External + Internal
External: How does it work? How do I get started?
Internal: Top 3 failure modes. What's technically hard. What assumptions must be true.

**What we learned:** The internal FAQ is where the PRD earns its keep. Anyone can write feature requirements. The hard part is articulating why this might fail and what must be true for it to succeed. Force yourself to write three failure modes with mitigations. If you can't, you don't understand the risks.

### 5. Appetite
How much are you willing to invest? What's the kill signal?

**What we learned:** Appetite isn't always a timebox. For a personal tool, the kill signal is "it's not effective" — qualitative, not temporal. That's valid. The point is having an explicit answer, not having a specific format.

---

## Typical PRD Sections We Deliberately Excluded

These are standard in corporate PRDs but overkill for a single-developer product:

- **User personas** — it's one user (the builder)
- **Non-goals (formal)** — covered by "What This Is NOT" in the vision
- **Dependencies & constraints** — known implicitly, not worth a formal section
- **Success metrics (quantitative)** — the metric is "does this make me better at shipping software?"
- **Migration/upgrade path** — one user, can handle manually
- **Competitive analysis** — done in Discovery, doesn't need repeating

**Note these, don't include them.** They add page count without adding clarity for this type of project. A 50-person team needs personas. A solo builder does not.

---

## How Long Should This Take?

For megapowers: ~1.5 hours of collaborative Q&A (6 rounds × 15 min each), then 30 minutes to write it up.

The Q&A is the work. The document is the receipt.

## Gate

PRD is done when:
- Requirements are priority-ordered (by the human, not the LLM)
- Each requirement has current state + V1 target + specific details
- Version roadmap exists (V1.0 through V3 at minimum)
- FAQ answers at least 3 external questions and 3 internal risk questions
- Appetite is stated with an explicit kill signal
- The human reads it and doesn't say "you missed X"

## What Comes Next

Architecture takes the PRD's requirements and designs the system to deliver them. The priority ordering from the PRD drives the architecture — solve the #1 priority's technical challenges first. The FAQ's "what's technically hard" section becomes the architecture's focus areas.
