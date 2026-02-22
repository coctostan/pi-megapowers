# pi-megapowers Roadmap

## Completed Milestones

### 01: Core Platform ✅

The foundational process engine, state machine, jj integration, TUI, and basic workflow for feature and bugfix modes.

**Tracking:** [docs/plans/2026-02-18-01-core-platform.md](docs/plans/2026-02-18-01-core-platform.md)

### 02: Feature Mode ✅

Full brainstorm→done flow with phase gates, prompt injection, and artifact routing.

**Tracking:** [docs/plans/2026-02-18-02-feature-mode-design.md](docs/plans/2026-02-18-02-feature-mode-design.md)

### 04: TDD Enforcement ✅

tdd-guard as a mechanical extension — blocks production file writes until tests are written and passing. Includes satellite TDD for subagent sessions.

**Tracking:** [docs/plans/2026-02-19-04-tdd-enforcement-design.md](docs/plans/2026-02-19-04-tdd-enforcement-design.md)

### 05: Task Coordination ✅

Per-task jj change tracking, satellite TDD enforcement for subagent sessions, task-level state management.

**Tracking:** [docs/plans/2026-02-19-05-task-coordination-design.md](docs/plans/2026-02-19-05-task-coordination-design.md)

### 06: Cross-Cutting Concerns ✅

Project learnings persistence with attribution, roadmap awareness in brainstorm/plan prompts, done-phase actions (generate feature docs, capture learnings, write changelog).

**Tracking:** [docs/plans/2026-02-19-06-cross-cutting-design.md](docs/plans/2026-02-19-06-cross-cutting-design.md)

## Remaining Component Designs

- [ ] **03: Bugfix Mode** — Reproduce→done flow, regression test enforcement

## Future Enhancements

### Richer Phase Prompts

Upgrade the prompt templates in `prompts/` to produce higher-quality, more constrained LLM output. Inspired by [GitHub's spec-kit](https://github.com/github/spec-kit) templates:

- **Spec prompts:** Prioritized user stories (P1/P2/P3), Given/When/Then acceptance criteria, explicit `[NEEDS CLARIFICATION]` markers, edge cases section
- **Plan prompts:** Technical context section, structured project layout decisions, complexity tracking per task
- **Task prompts:** Parallel markers `[P]`, user story grouping `[US1]`, phased execution (setup → foundational → per-story → polish), dependency graph, MVP-first delivery

### Project Constitution

A `.megapowers/constitution.md` file containing project-level architectural principles, coding standards, and constraints. Injected into every phase prompt alongside learnings.

### Clarify Sub-Phase

An optional phase between brainstorm and spec that systematically identifies ambiguity. The LLM reviews brainstorm output, marks items `[NEEDS CLARIFICATION]`, and resolves them through targeted questions before writing the spec.

### Cross-Artifact Analysis

An `/analyze` command that reads spec + plan + tasks and checks consistency:

- Do all spec user stories have corresponding plan tasks?
- Do task dependencies match the plan's ordering?
- Are there plan items with no spec coverage (scope creep)?

### TDD Guard Refinements

- Smarter test-to-implementation file mapping
- Language-aware detection (not just file patterns)
- Configurable strictness levels

### Advanced Subagent Strategies

- Parallel dispatch for independent plan tasks
- Specialized reviewer agents
- Chain-of-agents patterns
- Configurable strategy selection per project
