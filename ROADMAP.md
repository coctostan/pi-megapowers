# pi-megapowers Roadmap

## Current Milestone: Component Designs

Remaining component designs from the architecture plan:

- [ ] **02: Feature Mode** — Prompts, brainstorm→done flow, output routing
- [ ] **03: Bugfix Mode** — Reproduce→done flow, regression test enforcement
- [ ] **04: TDD Enforcement** — tdd-guard as mechanical extension
- [ ] **05: Subagent Orchestration** — LLM-managed subagents, circuit breakers
- [ ] **06: Cross-cutting** — Learnings injection, living docs

## Completed Milestones

### Core Platform ✅

The foundational process engine, state machine, jj integration, TUI, and basic workflow for feature and bugfix modes.

**Tracking:** [docs/plans/2026-02-18-01-core-platform.md](docs/plans/2026-02-18-01-core-platform.md)

## Future Enhancements

### Richer Phase Prompts

Upgrade the prompt templates in `prompts/` to produce higher-quality, more constrained LLM output. Inspired by [GitHub's spec-kit](https://github.com/github/spec-kit) templates:

- **Spec prompts:** Prioritized user stories (P1/P2/P3), Given/When/Then acceptance criteria, explicit `[NEEDS CLARIFICATION]` markers, edge cases section
- **Plan prompts:** Technical context section, structured project layout decisions, complexity tracking per task
- **Task prompts:** Parallel markers `[P]`, user story grouping `[US1]`, phased execution (setup → foundational → per-story → polish), dependency graph, MVP-first delivery

This is a qualitative iteration — no structural code changes, just better markdown templates refined through usage.

### Project Constitution

A `.megapowers/constitution.md` file containing project-level architectural principles, coding standards, and constraints. Injected into every phase prompt alongside learnings. Ensures consistent output across sessions and contributors.

Spec-kit's insight: when the LLM knows the project's governing principles, every generated artifact respects them without per-prompt reminders.

### Clarify Sub-Phase

An optional phase between brainstorm and spec that systematically identifies ambiguity. The LLM reviews brainstorm output, marks items `[NEEDS CLARIFICATION]`, and resolves them through targeted questions before writing the spec.

Adds a new state to `FEATURE_TRANSITIONS` — the state machine already supports this.

### Cross-Artifact Analysis

An `/analyze` command that reads spec + plan + tasks and checks consistency:

- Do all spec user stories have corresponding plan tasks?
- Do task dependencies match the plan's ordering?
- Are there plan items with no spec coverage (scope creep)?

### Project Roadmap Awareness

The process engine should read and reference the project's `ROADMAP.md` during brainstorm and planning phases. When a user proposes work, the LLM should know where it fits in the project's larger trajectory and flag conflicts or dependencies with other roadmap items.

### TDD Guard Refinements

- Smarter test-to-implementation file mapping
- Language-aware detection (not just file patterns)
- Configurable strictness levels

### Advanced Subagent Strategies

- Parallel dispatch for independent plan tasks
- Specialized reviewer agents
- Chain-of-agents patterns
- Configurable strategy selection per project

### Living Documentation

- Auto-generate feature docs from specs
- Behavior docs from acceptance tests
- Changelog from completed issues
- Design when reaching Done phase implementation
