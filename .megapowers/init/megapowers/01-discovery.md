# Phase 1: Discovery — Megapowers

> **Date:** 2026-02-25

---

## Who Is The Customer?

**The vibe coder who wants to build real software.**

They could be technical (experienced developer using AI to move faster) or non-technical (product person, founder, designer who can now build things). What unites them:

- They're using AI coding tools (Claude Code, Cursor, pi, Copilot, etc.) to build software
- They've experienced the failure mode: AI produces code fast, but it breaks, it's untested, it's unmaintainable, it accumulates debt
- They want the speed of vibe coding with the robustness of real engineering
- They don't want to manually enforce discipline — they want the system to enforce it

**Who they are NOT:**
- They are NOT someone who wants a prototype/demo machine. They want production software.
- They are NOT a team (yet). This is a single-developer tool today.
- They are NOT someone who wants to go slower. They want to go fast *and* not pay for it later.

---

## What Problem Do They Have?

**Vibe coding makes quick garbage.**

The core failure mode of AI-assisted development:

1. **AI skips steps.** It writes code without thinking about requirements, without writing tests, without reviewing its own work, without documenting decisions. It does what you ask, not what you need.

2. **The human skips steps too.** When AI makes things feel fast, the human loses discipline. "I'll add tests later." "I'll document this tomorrow." "It works, ship it." The speed is intoxicating and corrosive.

3. **The debt compounds silently.** Unlike traditional tech debt which accumulates over months, AI-generated debt accumulates in hours. A single session can produce hundreds of lines of untested, undocumented code that no one — human or AI — fully understands.

4. **There's no proof of process.** When something breaks, there's no trail of why decisions were made, what was considered, what was tested. You can't debug the decision, only the code.

The result: vibe coding is a prototype machine. It can build demos, MVPs, and throwaway scripts incredibly fast. But it cannot build software that lasts, grows, and is maintained by others (including future AI sessions).

**The gap:** There is no way to enforce real software engineering discipline ON the AI itself. Humans have code review, CI, testing requirements, and professional standards. AI has... whatever you put in the system prompt, which it'll ignore when inconvenient.

---

## What Do They Use Today?

### 1. Raw Vibe Coding (the default)
Just talk to the AI and ship what comes out. No process, no artifacts, no enforcement. Fast, fragile, dominant.

### 2. Prompt-Based Guardrails (Cursor Rules, CLAUDE.md, AGENTS.md)
Write instructions in a file that the AI reads at session start. "Always write tests." "Follow TDD." "Think before you code." The AI sees these as suggestions. It follows them when convenient, ignores them when the task gets complex or the context window fills up. **Zero enforcement.**

### 3. pi-superpowers-plus (closest pi ecosystem competitor)
12 workflow skills + 3 runtime extensions. Same workflow shape as megapowers (brainstorm → plan → execute → verify → review → finish). Key differences:
- **Advisory, not enforcing.** TDD violations produce warnings injected into tool output, but don't block writes. The agent can (and does) ignore them.
- **Skills-first.** Behavior is guided by prompt content (SKILL.md files), not state machine transitions.
- **No issue management.** No concept of issues, batches, or project lifecycle.
- **Heuristic tracking.** Workflow phase detected from skill invocations and file writes, not explicit state transitions.
- **Good README, good onboarding.** This is where they're ahead of us.

### 4. Compound Engineering Plugin (closest cross-tool competitor)
Plan → Work → Review → Compound. From Every Inc, works across Claude Code, Cursor, OpenCode, Pi, Gemini, Copilot, Kiro. Key differences:
- **Knowledge flywheel.** The "compound" step — documenting learnings so each task makes the next easier — is the unique insight. This is the one thing megapowers doesn't have a structured answer for.
- **Pure prompt commands.** Zero runtime enforcement. Commands are markdown files, not code.
- **Extremely lightweight.** Takes ~1 hour to implement. (Will Larson's assessment.)
- **Cross-platform.** Works with 7+ tools. Megapowers is pi-only.
- **80/20 philosophy.** 80% planning and review, 20% execution. Good framing.

### 5. Agent Swarms (CrewAI, AutoGen, Faire-style)
Multi-agent parallelism. Throw specialized agents at a problem (architect, coder, reviewer, tester). Focus on throughput, not process. No structured engineering discipline — just "more agents = more output." The 60%+ enterprise deployment failure rate (per Augment) suggests this approach has fundamental issues.

### 6. Manual Discipline
The developer enforces process themselves. Works, but exhausting and first thing skipped under time pressure. Doesn't scale to non-technical vibe coders who don't know what "real engineering" even looks like.

---

## Key Insight

**Everyone else in this space chose soft enforcement because hard enforcement is hard to get right.**

Superpowers-plus warns but doesn't block. Compound engineering suggests but doesn't enforce. Cursor rules hope but don't verify. Agent swarms parallelize but don't discipline.

Megapowers is the only tool that:
- **Blocks writes** that violate the current phase's policy
- **Gates transitions** on artifact existence and completeness  
- **Requires failing tests** before allowing production code (TDD enforcement)
- **Produces artifacts** at every phase (spec, plan, diagnosis — not just code)
- **Tracks issues** through a complete lifecycle

The bet: **the market will come to us.** 2025 was "vibe coding is magic." 2026 is "vibe coding produced a mountain of garbage." The correction creates demand for exactly what megapowers provides — structure that the AI can't skip.

The positioning: **Megapowers turns vibe coding into vibe engineering.** You still talk to the AI. You still move fast. But the system enforces that every step produces real engineering artifacts — specs, plans, tests, reviews — not just code.

---

## Project Scale Spectrum

The customer isn't building one type of thing. The range:

```
Scripts ←──── CLI tools ←──── APIs ←──── SaaS apps ←──── Enterprise platforms
  (skip)        (light)       (medium)      (full)          (beyond us)
```

- **Left edge (scripts, one-offs):** No process needed. Not our customer.
- **Right edge (Google-scale, regulated enterprise):** They have their own processes. Not our customer.
- **The middle 80%:** CLI tools, web apps, APIs, libraries, SaaS platforms, internal tools, mobile apps. This is where megapowers lives.

The implication for init: **a CLI tool and a SaaS platform can't go through the same ceremony.** A CLI tool might need discovery (1 paragraph) + a light PRD + issues. A SaaS platform needs the full flow with architecture, FAQ, risk analysis.

This means the init flow must be **telescoping** — the same phases exist, but each phase's depth scales with project complexity. The structure is consistent; the weight is variable.

The solution: **four doors at init time.**

| Tier | Flow | For |
|------|------|-----|
| **Light** | Discovery → Issues | CLI tools, small libraries, scripts-that-grew |
| **Standard** | Discovery → PRD → Roadmap → Issues | APIs, web apps, internal tools |
| **Full** | Discovery → Vision → PRD + FAQ → Architecture → Roadmap → Issues | SaaS platforms, complex systems, multi-service apps |
| **Help me decide** | LLM asks questions, picks the tier | Non-technical vibe coders, anyone unsure |

"Help me decide" is the default for new users. A few questions (What are you building? Who's it for? Does it have auth? External integrations? Multiple user types?) and the LLM recommends a tier. The user can always override.

This also means the per-issue workflows might need scaling too. Full 8-phase ceremony for a complex feature is right. Same ceremony for "add a --verbose flag to the CLI" is overkill. (This connects to the "quick-fix workflow" that's been mentioned but never designed.)

---

## Open Questions (to resolve in Vision/PRD)

1. **pi-only or cross-platform?** Compound Engineering works with 7 tools. We're pi-only. Is that a strength (deep integration) or a limitation (small market)?
2. **Should we steal the "compound" step?** CE's knowledge flywheel is the one thing we don't have a structured answer for. Megapowers captures learnings but doesn't feed them back into future sessions systematically.
3. **Technical vs non-technical customer?** The audit revealed no onboarding. A technical user can figure it out. A non-technical vibe coder cannot. Who do we optimize for?
4. **How heavy is too heavy?** CE takes 1 hour to set up. Megapowers takes... longer. Is the full state machine the right answer for everyone, or do we need a lightweight mode?
5. **Does the per-issue workflow need tiers too?** Init has Light/Standard/Full. Should the per-issue workflow have the same? Full 8-phase for complex features, lighter flow for "add a --verbose flag"? This is the quick-fix workflow question.
