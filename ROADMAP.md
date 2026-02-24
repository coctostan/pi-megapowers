# pi-megapowers Roadmap

## Completed Milestones

### 01: Core Platform ✅

The foundational process engine, state machine, jj integration, TUI, and basic workflow for feature and bugfix modes.

**Tracking:** [docs/plans/2026-02-18-01-core-platform.md](docs/plans/2026-02-18-01-core-platform.md)

### 02: Feature Mode ✅

Full brainstorm→done flow with phase gates, prompt injection, and artifact routing.

**Tracking:** [docs/plans/2026-02-18-02-feature-mode-design.md](docs/plans/2026-02-18-02-feature-mode-design.md)

### 03: Bugfix Mode ✅

Full reproduce→done flow with regression test enforcement, diagnosis artifacts, and "Fixed When" acceptance criteria extraction.

**Tracking:** [docs/plans/2026-02-22-bugfix-mode-preflight.md](docs/plans/2026-02-22-bugfix-mode-preflight.md)

### 04: TDD Enforcement ✅

TDD guard as a mechanical extension — blocks production file writes until tests are written and failing. Includes satellite TDD for subagent sessions.

**Tracking:** [docs/plans/2026-02-19-04-tdd-enforcement-design.md](docs/plans/2026-02-19-04-tdd-enforcement-design.md)

### 05: Task Coordination ✅

Per-task jj change tracking, satellite TDD enforcement for subagent sessions, task-level state management.

**Tracking:** [docs/plans/2026-02-19-05-task-coordination-design.md](docs/plans/2026-02-19-05-task-coordination-design.md)

### 06: Cross-Cutting Concerns ✅

Project learnings persistence with attribution, roadmap awareness in brainstorm/plan prompts, done-phase actions (generate feature docs, capture learnings, write changelog).

**Tracking:** [docs/plans/2026-02-21-cross-cutting-concerns.md](docs/plans/2026-02-21-cross-cutting-concerns.md)

### 07: Issue Triage & Batching ✅

LLM-driven triage that groups related issues into batch issues. `create_batch` tool for the LLM, `/triage` command, batch-aware issue list.

### 08: State Source of Truth Refactor ✅

Disk-first, tool-first state architecture. `readState()`/`writeState()` with atomic temp-file-then-rename replaces in-memory state. Tasks and acceptance criteria derived on demand from artifact files. Parser fixes for "None" sentinel detection, review approval, and acceptance criteria extraction.

### 09: Cleanup — Remove Deprecated Fields & Dead Code ✅

Pure deletion refactor removing `planTasks`, `acceptanceCriteria` from state, `loadState`/`saveState` from store, `loadSatelliteState` from satellite, `buildPhasePrompt` from prompts, and dead task-coordinator exports. 406 tests, 0 failures.

---

## Current: Stabilization & Polish

Small focused fixes to make the existing workflow reliable and pleasant before adding new capabilities.

### Open bugfixes

| Issue | Description | Batch |
|-------|-------------|-------|
| #20 | TDD guard rejects compound commands (`&&`, `\|`, `;`) | standalone |
| #13 | `/mega` command may render nothing (needs smoke test) | #31 |
| #22 | Phase notifications don't include artifact filepath | #31 |
| #18 | Roadmap not auto-updated on completion | standalone |

### Open UX improvements

| Issue | Description | Batch |
|-------|-------------|-------|
| #33 | Issue list UI — colors, icons, sorting (in progress) | standalone |
| #38 + #39 | save_artifact: overwrite protection + user feedback | #41 |
| #36 + #37 | Multi-select done menu + prompt injection visibility | #42 |

---

## Next: Architecture & Extensibility

Structural changes that unlock new capabilities.

| Issue | Description | Batch |
|-------|-------------|-------|
| #35 | Extract slash command handlers from index.ts | #43 |
| #27 | Expose workflow commands as LLM-callable tools | #43 |
| #11 | Auto-create feature branches on issue start | standalone |

---

## Future: Advanced Capabilities

| Issue | Description | Batch |
|-------|-------------|-------|
| #25 | Package subagent tool within megapowers | #32 |
| #40 | Review and upgrade all injected prompt templates | standalone |

### Enhancements (no issues yet)

- **Richer Phase Prompts** — Prioritized user stories (P1/P2/P3), Given/When/Then acceptance criteria, `[NEEDS CLARIFICATION]` markers, edge cases sections. Inspired by [GitHub's spec-kit](https://github.com/github/spec-kit).
- **Project Constitution** — `.megapowers/constitution.md` with architectural principles and coding standards, injected into every phase prompt.
- **Clarify Sub-Phase** — Optional phase between brainstorm and spec that identifies ambiguity via `[NEEDS CLARIFICATION]` markers.
- **Cross-Artifact Analysis** — `/analyze` command checking spec↔plan↔task consistency.
- **Advanced Subagent Strategies** — Parallel dispatch, specialized reviewer agents, chain-of-agents patterns.
