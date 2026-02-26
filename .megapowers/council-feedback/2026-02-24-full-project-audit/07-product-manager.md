---
persona: Product Manager
date: 2026-02-24
topic: Full project audit — user journey and product gaps
---

# Product Manager — "The User Advocate"

## Value Proposition

Strong but buried. This tool answers a real problem: AI agents write sloppy code unless constrained. TDD enforcement and phased workflow are genuinely differentiated. But the product doesn't communicate this value — no onboarding, no getting-started flow, no "here's what you'll get" moment.

## Critical UX Gaps

1. **No on-ramp.** New users face: install extension → somehow create an issue in markdown with frontmatter → pick a workflow → navigate phases with undocumented slash commands. The activation energy is enormous. Need: a `/mega new` command that walks you through creating your first issue conversationally.

2. **The happy path breaks at "done."** Users who complete the full workflow hit a broken done phase (#065). The moment of maximum satisfaction — completing work — is the worst experience. Product malpractice.

3. **Backward transitions are a UX emergency** (#069). Users WILL need to go back. When they can't, they'll `/mega off` and never turn it back on. Every user who does that is a churned user. #1 priority, period.

4. **Rigid phase sequence alienates experienced developers.** A senior dev who already has a clear spec in their head doesn't want to brainstorm. They want to jump to plan or implement. Tool should have a "fast track" mode: let me start at any phase with the right artifacts pre-populated.

5. **No progressive disclosure.** Same interface for a 2-line typo fix and a 500-line feature. Small changes should have a lightweight path. Maybe a `quick-fix` workflow: reproduce → implement → verify → done.

6. **Feedback loops are too long.** Plan → review → rejection means full plan phase redo. The #066 iterative loop fix isn't just nice-to-have — it's fundamental to the interaction model. Users need tight loops with specific feedback, not binary accept/reject.

7. **No visibility into AI reasoning.** When the AI saves an artifact, a file appears. But user doesn't see reasoning, trade-offs considered, or alternatives rejected. Artifacts are outputs, not conversations. Matters for trust.

## Priority Stack

1. Backward transitions (#069) — existential for retention
2. Done phase (#065) — complete the happy path
3. Quick-start / onboarding flow — reduce activation energy
4. Lightweight workflow for small changes — expand addressable use cases
5. Plan/review iteration (#066) — tighten the core loop
6. Git push (#064) — connect to the real world
