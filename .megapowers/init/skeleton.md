# `/mp init` — Project Initialization Flow

> **Status:** Draft skeleton. Phases will be fleshed out as we execute them on megapowers itself.
> The process templates (`process/`) are written AFTER completing each phase, not before.

---

## Brownfield Flow

For existing codebases. Start with what exists, figure out where it should go.

### Phase 0: Audit
**Question:** "What do we have?"
- Codebase health (tests, coverage, dead code, tech debt)
- Architecture (dependencies, boundaries, coupling)
- Documentation state (what exists, what's stale)
- Feature completeness (what works, what's half-built, what's broken)
- User experience (what's it like to actually use this today?)
- Prior art (existing issues, feedback, reviews)

**Gate:** Audit document exists with findings across all categories.

### Phase 1: Discovery
**Question:** "Who is this for and what problem does it solve?"
- Customer definition (specific, not generic)
- Problem statement (from the customer's perspective)
- Current alternatives (what do they use today? what's the competitive landscape?)
- Key insight (why does this need to exist?)

**Gate:** Discovery document answers all four questions. No hand-waving on customer definition.

### Phase 2: Vision
**Question:** "What does success look like?"
- North star (one sentence)
- Press release format (Amazon Working Backwards style)
- What this is NOT (explicit scope boundaries)
- Success metrics (how do we know it worked, 3-6 months out?)

**Gate:** Vision document. A stranger could read it and understand what we're building and why.

### Phase 3: PRD + FAQ
**Question:** "What specifically do we need to build, and what are the hard questions?"
- Requirements (functional, non-functional)
- User stories / jobs to be done
- FAQ — External (how does it work? how do I get started?)
- FAQ — Internal (what are the top 3 reasons this fails? what's technically hard? what assumptions must be true?)
- Appetite (how much are we willing to invest before we kill/pivot?)

**Gate:** PRD exists with requirements AND FAQ section. Hard questions have answers, not just questions.

### Phase 4: Architecture
**Question:** "How do we build it?"
- System design (current state for brownfield, proposed for greenfield)
- Key technical decisions (ADRs)
- Constraints and dependencies
- Migration path (brownfield: how do we get from here to there?)

**Gate:** Architecture document with decisions made, not deferred.

### Phase 5: Roadmap
**Question:** "In what order?"
- Sequenced milestones with clear deliverables
- Dependencies between milestones
- Risk-ordered (highest risk / highest learning first)
- Each milestone decomposable into issues

**Gate:** Roadmap with milestones that can be turned into megapowers issues.

### Phase 6: Conventions & Standards
**Question:** "How do we write code on this project?"
- Test protocol (runner, naming, what gets tested, coverage expectations)
- Naming conventions (files, issues, artifacts, types, functions)
- Code patterns (error handling, imports, module structure)
- Commit conventions (change descriptions, branch naming)
- Optional: populate README.md and/or AGENTS.md if missing or stale

**Scope:** Only what the dev workflow actually needs to reference. Concise. Not a style guide — a cheat sheet.

**Gate:** Conventions doc exists. Subagents and dev phases can reference it for consistent output.

### Phase 7: Issues → Megapowers Workflows
**Question:** "Let's build."
- Map existing issues to roadmap milestones (brownfield)
- Identify gaps — roadmap steps without issues
- Create new issues for gaps
- Assign milestone + priority to all issues
- Archive stale issues
- Enter standard megapowers workflows (feature/bugfix)

---

## Greenfield Flow

Same phases, minus the audit. Discovery starts from scratch.

0. ~~Audit~~ (nothing to audit)
1. Discovery
2. Vision
3. PRD + FAQ
4. Architecture
5. Roadmap
6. Conventions & Standards
7. Issues → Megapowers Workflows

---

## Meta Rules

1. **Process templates are written AFTER doing, not before.** Each phase produces two artifacts: the deliverable and the template.
2. **Phases are gates, not bureaucracy.** If a phase is trivially obvious, the document can be short. But it must exist.
3. **The FAQ is non-negotiable.** Every project must answer "what are the top 3 reasons this fails?" before building.
4. **Appetite is non-negotiable.** Every project must state how much it's willing to invest. Open-ended commitment is not allowed.
5. **Conventions are concise.** Only what the process needs. They are context for subagents and dev phases, not documentation for documentation's sake.
