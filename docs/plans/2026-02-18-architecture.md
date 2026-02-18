# pi-megapowers Architecture

**Date:** 2026-02-18
**Status:** Draft

This is the master architecture document. Individual component designs live in separate docs and reference this for overall vision and principles.

## Overview

pi-megapowers is an opinionated pi package that turns software development into an extension-driven process. A deterministic state machine manages workflow phases (feature and bugfix modes), enforces TDD discipline, tracks issues and learnings, and handles source control via jj — while delegating the intellectual work (brainstorming, planning, coding, reviewing) to scoped LLM sessions. The user interacts with the process engine collaboratively: it proposes, you steer, the LLM executes.

## Design Principles

- **Extension directs, LLM performs.** The process engine owns orchestration, phase transitions, state, and UX. The LLM executes scoped tasks within phases.
- **No skills.** The extension replaces the skill-invocation model entirely. Users don't manually trigger workflow steps — the engine presents choices and drives transitions.
- **Opinionated defaults.** Configuration is added where needed, not upfront. The process enforces TDD, requires plans before implementation, and validates source control state.
- **Lightweight discipline.** Rigorous enough to enforce best practices, lightweight enough that it doesn't slow you down. This should feel like a good pair programmer, not a project manager.
- **Collaborative co-pilot.** The extension presents the current state and available actions. The user chooses. The LLM executes. The extension validates and advances. At any point the user can redirect, skip, or abort.
- **jj-native.** Source control is built directly against jj's model. No git abstraction layer.

## Grounding in Established Frameworks

pi-megapowers draws from several well-accepted software development practices:

- **Outside-In / Double-Loop TDD:** An outer acceptance test loop drives inner unit test loops. Implementation starts with a failing acceptance test, then TDD cycles make it pass. This provides a clear "done" signal.
- **ATDD (Acceptance Test-Driven Development):** The "Discuss → Distill → Develop → Demo" cycle formalizes brainstorm → spec → implement → verify, grounded in executable acceptance criteria.
- **Specification by Example / Living Documentation:** Tests double as documentation. Specs are executable. Docs are generated from real artifacts, not LLM memory.
- **Extreme Programming (XP):** TDD, continuous integration, small increments, pair programming (human + AI pair).

## Core Architecture

### Three Layers

1. **Process Engine** (pi extension) — A deterministic state machine that tracks workflow phases, enforces rules, manages persistent state, renders UI (widgets, status, menus), and injects scoped prompts into LLM sessions. This is the director.

2. **LLM Sessions** — Scoped tasks the process engine delegates to the LLM. Each session gets a tailored prompt, constrained scope, and a clear deliverable. The LLM never sees the full workflow — it gets one job at a time. During implementation, the LLM has creative freedom to manage subagents.

3. **Project Store** (`.megapowers/` on disk) — Persistent state: project config, issue list, current phase, plans, specs, learnings, session history. All plain files (markdown + JSON). Git-friendly. Survives any crash or session restart.

### Interaction Model

The extension presents the current state and available actions at phase boundaries. The user chooses. The LLM executes within the scoped phase. The extension validates the result and advances to the next phase.

The LLM never manages workflow. It never decides "what phase am I in" or "what should I do next." It receives a scoped task from the process engine and returns a result. The process engine decides what's next.

### Key Extension Mechanisms (pi)

- **Widgets / Status:** Render current phase, progress, issue info in the TUI
- **Tool interception** (`before_tool_call`): Enforce TDD (block impl writes without failing test)
- **Prompt injection** (`before_agent_start`): Inject phase-specific prompts so the LLM is scoped to the current task
- **State persistence** (`appendEntry`): Persist phase state across sessions
- **Message injection** (`steer`, `followUp`): Direct the LLM within a phase
- **Custom commands:** Workflow transitions, issue management

## Package Structure

```
pi-megapowers/
├── package.json              # pi package manifest
├── extensions/
│   ├── process-engine/       # The core state machine
│   │   ├── index.ts          # Extension entry point
│   │   ├── state-machine.ts  # Phase transitions, rules
│   │   ├── store.ts          # .megapowers/ persistence
│   │   ├── jj.ts             # jj integration
│   │   └── ui.ts             # Widgets, status, menus
│   ├── tdd-guard.ts          # Enforces test-before-impl
│   └── circuit-breaker.ts    # Token/loop limits for subagents
├── agents/                   # Subagent definitions
│   ├── implementer.md
│   ├── reviewer.md
│   └── diagnostician.md
├── prompts/                  # Scoped prompts per phase
│   ├── brainstorm.md
│   ├── write-spec.md
│   ├── write-plan.md
│   ├── review-plan.md
│   ├── diagnose-bug.md
│   └── generate-docs.md
└── docs/
    └── design.md
```

### Component Responsibilities

- **process-engine**: Owns the state machine, renders UI, intercepts input events to present workflow choices, injects phase-specific prompts via `before_agent_start`, persists state via `appendEntry`.
- **tdd-guard**: Intercepts `tool_call` events to enforce "no implementation without failing test." Mechanical enforcement, not prompt-based.
- **circuit-breaker**: Monitors subagent execution for loop count and token usage. Intervenes when limits are exceeded.
- **prompts/**: Injected by the process engine per-phase. The LLM sees "here's your job for this phase," not the whole development process. Reference superpowers-plus brainstorming and writing-plans skills for prompt quality.
- **agents/**: Used by the LLM during implementation for subagent delegation.

## Workflow Modes

### Feature Mode

Covers new features and refactors.

| Phase | Extension Does | LLM Does |
|-------|---------------|----------|
| **Brainstorm** | Opens phase, tracks that spec output exists when done | Collaborative dialogue with user to refine the idea |
| **Spec** | Persists spec to project store, offers plan review gate | Writes executable acceptance criteria from brainstorm |
| **Plan** | Stores plan, presents review option, blocks impl until plan exists | Breaks spec into ordered implementation tasks |
| **Review** *(optional)* | Presents plan to user or invokes reviewer subagent, gates on approval | Reviews plan for feasibility, gaps, risks |
| **Implement** | Enforces TDD (no impl without failing test), tracks task completion | Manages subagents, writes tests + code, outside-in TDD |
| **Verify** | Runs full test suite, checks acceptance criteria pass | Investigates any failures, proposes fixes |
| **Done** | Updates issue status, prompts for learnings capture, archives | Summarizes what was done, generates docs if configured |

### Bugfix Mode

Disciplined bugfix process. No spec doc, but requires a plan and starts with a regression test.

| Phase | Extension Does | LLM Does |
|-------|---------------|----------|
| **Reproduce** | Requires a failing test or reproduction script before advancing | Investigates the bug, writes a test that demonstrates it |
| **Diagnose** | Stores diagnosis, requires plan before advancing | Root cause analysis — traces through code |
| **Plan** | Stores plan, offers review gate | Short plan: what to fix, what might break, what to test |
| **Implement** | Enforces TDD — regression test must fail first, then pass after fix | Writes regression test, implements fix |
| **Verify** | Runs full suite, confirms regression test passes, no new failures | Investigates any collateral failures |
| **Done** | Same as feature | Same as feature |

## Subagent Architecture

### Control Boundary

The extension owns **process orchestration** (phase transitions, gating, state). The LLM owns **execution orchestration** (subagent delegation within a phase).

### Implementation Phase Freedom

During the Implement phase, the extension hands the LLM a plan with tasks and says "go." The LLM has creative freedom to:

- Work tasks sequentially itself
- Dispatch independent tasks to parallel subagents
- Use a test+implement split (one subagent writes tests, another implements)
- Chain subagents (one writes a component, the next integrates it)

### Extension Guardrails During Implementation

- **TDD enforcement:** No implementation file writes without a corresponding failing test (tdd-guard, mechanical)
- **Task tracking:** The extension monitors which plan tasks are marked complete
- **Circuit breakers:** If a subagent loops too long or burns too many tokens, the extension intervenes

### Extensibility

Subagent strategies are pluggable. A basic "do everything sequentially" strategy works out of the box. Advanced strategies (parallel dispatch, specialized reviewer agents, chain-of-agents) can be added without changing the core process engine.

## Source Control: jj Integration

### Why jj

jj solves the exact problems that made source control unreliable in superpowers-plus:

- **Working copy is always a commit.** No uncommitted changes, no dirty state ambiguity. The extension always sees a consistent snapshot.
- **Operation log.** Every operation is recorded and reversible. Full undo safety net.
- **Conflicts can be committed.** No commands fail because of merge conflicts. The extension can rebase freely.
- **Automatic rebasing of descendants.** Commit reorganization (squash, split) is safe and automatic.

### Lifecycle

**Session start — state validation:**
- What change are you on? Does it match the active issue?
- Is there conflict state? Surface it immediately.
- If no active issue, present the issue list.

Because jj auto-commits the working copy, there's no "dirty state" ambiguity. The extension always sees a consistent snapshot.

**Starting work on an issue:**
```
jj new main -m "mega(001): api-auth-refactor"
```
The extension creates a new change off main, described with the issue ID. The jj change ID is stored in the issue's state file.

**Phase transitions:**
```
jj describe -m "mega(001): spec complete"
jj new -m "mega(001): implementation"
```
Clean commit-per-phase history, handled mechanically by the extension at every transition.

**Implementation phase:**
The LLM and subagents work freely. jj's automatic working copy snapshots mean nothing is ever lost. If a subagent makes a mess, `jj undo` reverts the last operation cleanly.

**Done phase — cleanup options:**
- Squash all changes into one: `jj squash`
- Keep phase history as-is
- Push a bookmark: `jj bookmark set mega/001 && jj git push`

**The LLM never touches source control.** The extension handles it all.

## Cross-Cutting Features

### Issue List

A simple prioritized list in the project store. Each issue has: title, type (feature/bug), status, brief description. The extension presents issues when you start a session — "here's what's open, what do you want to work on?" Issues drive work selection. Lightweight — a TODO list, not Jira tickets. The LLM can propose new issues during work ("I noticed X is also broken, want to track that?") and the extension captures them.

### Project Learnings

Accumulated knowledge that persists across sessions. The extension prompts for learnings capture at the end of each completed workflow. The LLM proposes, the user approves or edits. Learnings are injected into relevant LLM task contexts automatically — e.g., if a learning says "the auth module requires mocking the token service," the extension includes that when scoping implementation tasks that touch auth.

### Living Documentation

Docs are generated from artifacts that already exist: specs become feature docs, acceptance tests become behavior docs, the issue list becomes a changelog source. The LLM generates/updates docs at the Done phase, but only from real artifacts. The extension triggers it; the LLM writes it.

### Session Persistence

The extension saves phase state on every transition. Close the terminal, come back tomorrow — it picks up exactly where you left off: "You were in Feature Mode, phase: Implement, task 3 of 7. Continue?"

## Plan Organization

Plans are linked to issues by ID and managed by the extension:

```
.megapowers/
├── issues/
│   ├── 001-api-auth-refactor.md
│   └── 002-fix-timeout-bug.md
├── plans/
│   ├── 001-api-auth-refactor/
│   │   ├── spec.md
│   │   ├── plan.md
│   │   └── review.md        (if review was taken)
│   └── 002-fix-timeout-bug/
│       ├── diagnosis.md
│       └── plan.md
├── learnings/
│   └── learnings.md
├── docs/
│   └── (generated living docs)
└── state.json                (current phase, active issue, etc.)
```

- Every plan directory is named by issue ID + slug — always traceable
- Feature issues get `spec.md` + `plan.md`. Bugfix issues get `diagnosis.md` + `plan.md`
- The extension creates these files at the right phase — no manual organization
- `state.json` tracks the active issue and phase across sessions
- Completed issues stay in place as project history

## What This Is Not

- **Not Jira.** The issue list is a lightweight TODO, not a ticket system.
- **Not a skill collection.** No user-invoked skills. The extension drives the process.
- **Not git-compatible.** Requires jj. Opinionated by design.
- **Not fully autonomous.** Collaborative co-pilot model. The extension proposes, the user steers.
- **Not framework-agnostic.** Built specifically for pi's extension system.

## Open Questions

- Exact TUI layout and widget design (iterative — build and refine)
- Circuit breaker thresholds (token limits, loop counts — tune through usage)
- Living documentation format and generation strategy (design when reaching Done phase implementation)
- Advanced subagent strategies beyond basic sequential (design when core is stable)
