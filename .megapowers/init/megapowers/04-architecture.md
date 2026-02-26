# Phase 4: Architecture — Megapowers (Current)

> **Date:** 2026-02-25
> **Method:** Brownfield — LLM reads existing codebase, documents as-built architecture

---

## Overview

**4,107 lines** across 30 flat files in `extensions/megapowers/`. Single pi extension. Two workflow types (feature, bugfix). Disk-first state machine with tool-based enforcement.

## Module Map

### Entry Point
- **`index.ts`** (870 lines) — Extension entry point. Registers all hooks (session_start, before_agent_start, tool_call, tool_result, agent_end), all tools (megapowers_signal, megapowers_save_artifact, create_batch, subagent, subagent_status), all commands (/mega, /issue, /phase, /done, /learn, /tdd, /task, /review). Contains satellite mode branch and inline subagent spawn logic.

### State & Core
- **`state-machine.ts`** (157 lines) — Types, transition tables, `transition()` function. `WorkflowType = "feature" | "bugfix"`. Hardcoded `FEATURE_TRANSITIONS` and `BUGFIX_TRANSITIONS` dictionaries. Pure functions — no I/O.
- **`state-io.ts`** (41 lines) — `readState(cwd)` / `writeState(cwd, state)`. Atomic JSON read/write to `.megapowers/state.json`. No module-level state variable.
- **`gates.ts`** (108 lines) — `checkGate(state, target, store, cwd)`. Pure function checking artifact existence, open questions (spec), review approval, task completion. Returns `{pass, reason}`.
- **`write-policy.ts`** (110 lines) — `canWrite(phase, filePath, megaEnabled, taskIsNoTest, tddState)`. Pure function. Blocking phases (brainstorm, spec, plan, review, verify, done) block all non-.megapowers writes. TDD phases (implement, code-review) gate production writes behind test-first cycle.
- **`derived.ts`** (35 lines) — `deriveTasks(cwd, issueSlug)`, `deriveAcceptanceCriteria(...)`. Parses plan.md and spec.md on demand. Never cached.

### Store
- **`store.ts`** (290 lines) — File-system backed. `createStore(projectRoot)` returns Store interface. Manages: issues (`.megapowers/issues/`), plan artifacts (`.megapowers/plans/{slug}/`), learnings, roadmap, feature docs, changelog. Issues are markdown files with YAML frontmatter.

### Prompt System
- **`prompts.ts`** (156 lines) — Template loading from `prompts/` directory. `loadPromptFile()`, `interpolatePrompt()` (mustache-style `{{var}}`), `buildImplementTaskVars()`, `formatAcceptanceCriteriaList()`. Maps phases to prompt files via `PHASE_PROMPT_MAP`.
- **`prompt-inject.ts`** (175 lines) — `buildInjectedPrompt(cwd, store, jj)`. Assembles the full context for `before_agent_start` hook: protocol doc + phase prompt + artifact vars + tool instructions + source issues. Handles bugfix aliasing (reproduce→brainstorm_content, diagnosis→spec_content).
- **`prompts/`** directory (15 files) — Markdown templates for each phase + done modes + protocol + triage.

### UI
- **`ui.ts`** (573 lines) — Mixed pure rendering and interactive UI. Pure functions: `formatPhaseProgress()`, `renderDashboardLines()`, `renderStatusText()`, `formatIssueListItem()`. Interactive: `handleIssueCommand()`, `handlePhaseTransition()`, `handleDonePhase()`, `handleTriageCommand()`. Uses `ctx.ui.select()`, `ctx.ui.input()`, `ctx.ui.editor()`, `ctx.ui.notify()`, `ctx.ui.setWidget()`, `ctx.ui.setStatus()`.

### Tools & Signals
- **`tool-signal.ts`** (251 lines) — `handleSignal(cwd, action, jj)`. Dispatches: task_done (mark task complete, advance to next or verify), review_approve (set flag), phase_next (advance), tests_failed (TDD RED), tests_passed (TDD GREEN). Contains TDD null-safety validation (AC13).
- **`tool-artifact.ts`** (34 lines) — `handleSaveArtifact(cwd, phase, content)`. Writes artifact to plan directory.
- **`tool-overrides.ts`** (81 lines) — `evaluateWriteOverride(cwd, filePath)`, `recordTestFileWritten(cwd)`. Disk-backed write policy enforcement + TDD state tracking.
- **`tools.ts`** (26 lines) — `createBatchHandler()`. Batch issue creation.

### Phase Advance
- **`phase-advance.ts`** (81 lines) — `advancePhase(cwd, targetPhase, jj)`. Gate check → transition → jj operations (async fire-and-forget). Called by phase_next signal and UI handlers.

### Subagent System (8 files)
- **`subagent-tools.ts`** (149 lines) — `handleSubagentDispatch()`, `handleSubagentStatus()`. Validates, builds config, returns dispatch result.
- **`subagent-runner.ts`** (147 lines) — `buildSpawnArgs()`, `buildSpawnEnv()`, `createRunnerState()`, `processJsonlLine()`. Builds pi CLI args, parses JSONL output from spawned pi process.
- **`subagent-workspace.ts`** (29 lines) — `buildWorkspaceName()`, `buildWorkspaceAddArgs()`, `buildWorkspaceForgetArgs()`, `buildDiffSummaryArgs()`, `buildDiffFullArgs()`. JJ workspace CLI arg builders.
- **`subagent-status.ts`** (58 lines) — `writeSubagentStatus()`, `readSubagentStatus()`, `updateSubagentStatus()`. Status JSON files in `.megapowers/subagents/{id}/`.
- **`subagent-context.ts`** (63 lines) — Builds context for subagent prompt.
- **`subagent-agents.ts`** (113 lines) — Agent configs (model, tools, thinking, system prompt).
- **`subagent-validate.ts`** (35 lines) — Validates dispatch params.
- **`subagent-errors.ts`** (25 lines) — `detectRepeatedErrors()`. Scans error lines for patterns.
- **`subagent-async.ts`** (39 lines) — Async helpers.

### Satellite Mode
- Entire branch in `index.ts` (~80 lines). Detected via `isSatelliteMode()` from `satellite.ts` (35 lines). Subagent sessions run in satellite mode: in-memory TDD state (no competing state.json writes), limited megapowers_signal tool (tests_failed, tests_passed only).

### JJ Integration
- **`jj.ts`** (151 lines) — `createJJ(pi)` factory. `isJJRepo()`, `newChange()`, `describe()`, `squashInto()`, `getCurrentChangeId()`. Uses `pi.exec("jj", args)`.
- **`jj-messages.ts`** (19 lines) — Install/init message constants.

### Task Coordination
- **`task-coordinator.ts`** (80 lines) — `inspectTaskChange()`, `createTaskChange()`, `buildTaskCompletionReport()`, `parseTaskDiffFiles()`. JJ change management per task.

### Parsers
- **`plan-parser.ts`** (93 lines) — Parses plan.md into PlanTask[]. Handles `[no-test]`, `[depends: N, M]` annotations.
- **`spec-parser.ts`** (83 lines) — Parses spec.md for acceptance criteria and open questions.

---

## State Model

### state.json

```typescript
interface MegapowersState {
  version: 1;
  activeIssue: string | null;      // Issue slug (e.g., "050-agent-context")
  workflow: "feature" | "bugfix" | null;
  phase: Phase | null;              // Current phase
  phaseHistory: PhaseTransition[];  // Audit trail
  reviewApproved: boolean;          // Plan review gate
  currentTaskIndex: number;         // Array index into derived tasks
  completedTasks: number[];         // PlanTask.index values (1-based)
  tddTaskState: TddTaskState | null;
  taskJJChanges: Record<number, string>;  // Task index → jj change ID
  jjChangeId: string | null;       // Current jj change
  doneMode: string | null;          // Active done-phase action
  megaEnabled: boolean;             // Enforcement toggle
}
```

**Key principle:** State stores only coordination data. Task lists and acceptance criteria are derived on demand from artifact files.

### Artifact Storage

```
.megapowers/
├── state.json                    # Workflow state
├── issues/                       # Issue markdown files with frontmatter
│   ├── 041-save-artifact-tool-reliability-overwrite.md
│   └── ...
├── plans/                        # Per-issue plan artifacts
│   └── {issue-slug}/
│       ├── brainstorm.md
│       ├── spec.md
│       ├── plan.md
│       ├── verify.md
│       └── code-review.md
├── docs/                         # Generated feature docs
├── learnings/                    # Learning entries
├── subagents/                    # Subagent status + diffs
│   └── {subagent-id}/
│       ├── status.json
│       └── diff.patch
├── init/                         # Foundation documents (THIS PROJECT)
│   ├── skeleton.md
│   ├── megapowers/               # Project-specific artifacts
│   └── process/                  # Process templates
└── CHANGELOG.md
```

---

## Workflow Phase Sequences

### Feature
```
brainstorm → spec → plan → review → implement → verify → code-review → done
                          ↗         ↖           ↖
                    review→plan  verify→impl  code-review→impl
```

### Bugfix
```
reproduce → diagnose → plan → review → implement → verify → done
                            ↗
                      review→plan
```

### Backward Transitions (current)
- `review → plan` (re-plan)
- `verify → implement` (fix implementation)
- `code-review → implement` (fix code)

On backward to plan: `reviewApproved` reset to false. On backward to implement: `taskJJChanges` reset.

---

## Hook Pipeline

```
session_start
  → init store, jj, ui
  → reset megaEnabled to true
  → jj change ID validation
  → render dashboard

before_agent_start
  → buildInjectedPrompt() → return message with phase context

tool_call (write/edit only)
  → evaluateWriteOverride() → canWrite() → block or allow

tool_result (write/edit only)
  → if test file written → recordTestFileWritten() → update TDD state

agent_end
  → done-phase artifact capture (if doneMode set)
  → if non-open-ended phase: handlePhaseTransition() → select widget
  → if now in done: handleDonePhase() → done menu
  → renderDashboard()
```

---

## Strengths (Preserve)

1. **Disk-first state** — no module-level state, every handler reads fresh from disk
2. **Pure core functions** — write policy, gates, rendering are all testable without pi
3. **Derived data** — tasks from plan.md on demand, never stale cached copies
4. **Store abstraction** — clean interface, easy to test and extend
5. **Satellite mode** — subagent sessions get TDD enforcement without competing for state.json

## Weaknesses (Address in V1)

1. **`index.ts` monolith** (870 lines) — mixes concerns: hooks, tools, commands, subagent spawn, satellite mode
2. **Flat file structure** — 30 files with no grouping, hard to navigate
3. **UI mixes rendering and state mutation** — `handlePhaseTransition` both shows UI and writes state
4. **Subagent spawn inline** — 150+ lines of spawn logic inside a tool execute function
5. **Hardcoded workflow types** — can't support init system without refactoring state machine
6. **Phase transition UX** — agent_end → select widget pattern produces the "pile of shit" experience
7. **Plan and review are separate phases** — no iterative loop, no multi-model orchestration
8. **Done phase is a menu loop** — each action is a separate LLM turn with manual selection
9. **No backward cascade invalidation** — going back doesn't reset downstream state properly
10. **No init system** — foundation docs exist manually but no code supports the init workflow
11. **No clean context windows** — full conversation carries between phases
12. **Subagent squash missing** (#067) — workspace results don't get back to main workspace

---

## Technical Constraints

- **pi extension API** — single entry point function, hook-based lifecycle, tool registration
- **pi UI** — `ctx.ui.select()`, `ctx.ui.input()`, `ctx.ui.editor()`, `ctx.ui.notify()`, `ctx.ui.setWidget()`, `ctx.ui.setStatus()`, `ctx.ui.theme`
- **bun runtime** — TypeScript, ESM modules
- **jj** — optional dependency, detected at runtime, operations are async fire-and-forget
- **No direct model API access from extensions** — extensions interact with LLM via prompt injection and tool results, not direct API calls (⚠️ needs verification)

---

## Open Questions for V1 Architecture Design

1. **Can pi make direct model API calls from an extension?** Needed for plan/review loop's reviewer call.
2. **Can pi programmatically start a new conversation?** Needed for clean context windows between phases.
3. **Should V1 keep jj workspaces for sequential subagents?** Rollback value vs. complexity.
4. **Should init and dev share state.json?** Simplicity vs. separation of concerns.
5. **Should the user see the reviewer's verdict during the plan/review loop?** Transparency vs. noise.


**See:** `04-architecture-proposed.md` for the proposed V1 architecture addressing these weaknesses and questions.
