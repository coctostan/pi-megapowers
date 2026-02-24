---
id: 49
type: feature
status: open
created: 2026-02-24T19:05:00.000Z
---

# Project onboarding workflow for greenfield and brownfield projects

## Problem

When megapowers is first used on a project, there's no structured onboarding process. The agent jumps straight into issue-driven workflows without understanding the project's architecture, goals, conventions, or existing state. For brownfield projects this means the agent lacks critical context about what already exists. For greenfield projects there's no guidance for establishing foundational docs and architecture before diving into features.

## Desired Behavior

### Onboarding process

A new `/onboard` command (or automatic first-run detection) that walks through project discovery and document scaffolding:

**Brownfield (existing project):**
1. Analyze the codebase — languages, frameworks, structure, dependencies, test setup
2. Generate/update foundational docs: `ARCHITECTURE.md`, `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `CHANGELOG.md`
3. Capture conventions — naming, patterns, test strategy, branching model
4. Populate `.megapowers/` with project context the agent can reference in future sessions

**Greenfield (new project):**
1. PRD-style discovery process — gather requirements, constraints, target users, success criteria
2. Architecture decision phase — tech stack, project structure, key design decisions
3. Scaffold foundational docs from PRD output
4. Create initial issues/roadmap from the PRD

### PRD (Product Requirements Document) process

A structured thinking-through phase before jumping to implementation:
- **Problem statement** — what are we building and why
- **User stories / use cases** — who uses it and how
- **Requirements** — functional, non-functional, constraints
- **Architecture decisions** — tech choices with rationale (ADR-style)
- **Scope boundaries** — explicit in/out of scope
- **Success criteria** — how we know it's done

This could be a new workflow type (`onboard`) or a pre-workflow phase that feeds into the existing feature/bugfix workflows.

### Higher-level project docs

Megapowers currently reads `ROADMAP.md` and appends to `CHANGELOG.md` but doesn't manage or generate:
- `ARCHITECTURE.md` — system design, component relationships, data flow
- `README.md` — project overview, setup, usage
- `CONTRIBUTING.md` — dev workflow, PR process, conventions
- `ADR/` — architecture decision records

These should be:
1. Generated during onboarding
2. Kept accessible to the agent as context during brainstorm/plan phases
3. Updated as the project evolves (e.g., after major features ship)

### Integration with existing workflows

- **Brainstorm/plan phases** — inject project architecture context so the agent designs within established patterns
- **Implement phase** — agent knows project conventions (naming, test patterns, file organization)
- **Done phase** — prompt to update `ARCHITECTURE.md` or `CHANGELOG.md` when the feature changes system design
- **New issue creation** — agent can reference PRD and architecture to scope issues properly

## Context

- `store.ts` already reads `ROADMAP.md` and appends to `CHANGELOG.md`
- `prompts.ts` injects `learnings` and `roadmap` vars during brainstorm/plan phases
- The `generate-docs` done-phase action exists but only handles per-issue docs
- No current mechanism to analyze and understand an existing codebase holistically

## Open Questions

- Should onboarding be a separate workflow type or a one-time setup command?
- How much of the PRD process should be automated vs. interactive with the user?
- Should architecture docs live in `.megapowers/` or project root?
- How do we detect greenfield vs. brownfield — empty repo check, or always ask?
