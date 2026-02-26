# Phase 2: Vision — Process Template

> **What we learned by doing this on megapowers, 2026-02-25**

---

## Purpose

Answer: **"What does success look like?"**

The vision is the north star document. It declares what this thing IS, what it ISN'T, where it's going, and how you'll know it worked. Everything downstream — PRD, roadmap, issues — derives from this.

## Critical Process Rule: This Phase Is Collaborative

**The LLM does NOT write the vision solo and ask for feedback.** That's backwards.

The correct flow:
1. LLM proposes framing / asks questions
2. Human reacts, corrects, adds their actual intent
3. LLM synthesizes
4. Repeat until the human says "that's it"
5. Write it down

We got this wrong on the first pass. The LLM wrote a complete vision doc, presented it, and asked "what's off?" The human had to correct fundamental assumptions (motivation, audience, future arc) that should have been surfaced through questions first.

**Why this matters:** The vision captures the builder's intent. The LLM doesn't know the builder's intent — it can only infer it from prior context. Inference is not the same as asking.

---

## The Sections

### 1. North Star
One or two sentences. The tagline. If you can't say it in a sentence, you don't know what you're building yet.

**What we learned:** The north star often comes from the human, not the LLM. "Vibe coding is dead... long live Vibe Engineering" came from the human. The LLM's version was more generic. Listen for the human's language — they'll say the right thing before the LLM figures it out.

### 2. Press Release (Amazon Working Backwards style)
- Problem paragraph (from the customer's perspective)
- Solution paragraph (what the product does, specifically)
- How to get started

Keep it short. This isn't marketing copy — it's a forcing function for clarity. If you can't explain the problem and solution in a few paragraphs, you don't understand them yet.

**What we learned:** The PR format works but don't overthink it. The value is in forcing "problem → solution" sequencing, not in writing polished copy.

### 3. What This Is / Is NOT
Explicit boundaries. The "is NOT" list is more important than the "is" list — it prevents scope creep and strategic drift.

**What we learned:** The human will have strong opinions here that the LLM can't predict. "NOT a product for the market — built for the builder" was a fundamental correction that changed the entire framing. Ask, don't assume.

### 4. Vision Arc (time horizons)
Where is this going beyond v1? Not a detailed roadmap — a directional sketch. V1 / V2 / V3 with one-paragraph descriptions.

**What we learned:** This section surfaced a future we hadn't discussed — agent orchestrators using megapowers to enforce process on sub-agents. The human knew this was part of the long-term vision but hadn't mentioned it until the vision phase forced the conversation. The vision arc is where latent ambitions surface.

### 5. Strategic Decisions
Resolve (or explicitly defer) each open question from Discovery. Each decision gets a one-line rationale.

### 6. Success Criteria
How do you know this worked? Not vanity metrics. The real test.

**What we learned:** When the motivation isn't market adoption, traditional metrics (installs, retention, NPS) are meaningless. The success criteria must match the builder's actual motivation. "Does this make ME better at shipping software?" is a valid success criterion.

---

## How Long Should This Take?

Collaborative session: 30-60 minutes of back-and-forth, then 15 minutes to write it down.

The biggest risk is the LLM going off and writing a complete document alone. That produces a plausible-sounding vision that misses the builder's actual intent. Force the conversation first.

## Gate

Vision is done when:
- North star exists (one sentence)
- What this IS and IS NOT are explicit
- All open questions from Discovery are resolved or explicitly deferred
- The builder reads it and says "yes, that's what I'm building"

## What Comes Next

PRD takes the vision and turns it into specific requirements. The press release becomes user stories. The strategic decisions become constraints. The vision arc's V1 scope becomes the PRD's scope boundary.
