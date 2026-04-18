# Next-Gen Pi Extension: Research & Design Inputs

**Date:** 2026-03-23
**Purpose:** Capture analysis from GSD-2, pi-megapowers, and PALS to inform a fresh Pi extension design that combines the best of all three.

---

## Executive Summary

The goal is a **new Pi extension** (not a fork of any existing project) that combines:
- **GSD-2's context management** — fresh session per task, layered context assembly, task summaries, pre-planning research
- **Megapowers' discipline enforcement** — TDD write-gate with signal acknowledgement, plan review loop with approval gates
- **PALS' structured loop** — PLAN → APPLY → UNIFY reconciliation cycle, context brackets, checkpoint system

The extension should be **lean** — a single `state.json` as coordination file, no file-presence state inference, no scattered summary/UAT/completion markers that can drift.

---

## Part 1: Phase-by-Phase Comparison (GSD-2 vs. Megapowers)

| Phase | GSD-2 | Megapowers | Winner & Why |
|-------|-------|------------|--------------|
| **Pre-planning** | Integrated research: scouts codebase + web docs before plan. Distinct step producing research artifacts. | No research step. Jumps to plan authoring. | GSD-2 — plans are better-informed |
| **Planning** | Milestones → slices → tasks hierarchy. Roadmap reassessment after each slice. Dynamic model routing (Opus for planning). | Flat issue → tasks. Draft/review/revise loop with subagent fan-out for advisory reviews. Structured approval gates. | Megapowers review loop is stronger; GSD-2 hierarchy is stronger |
| **Execution** | Fresh session per task. Pre-inlined context (task plan, prior summaries, deps, decisions, roadmap). Token profiles (budget/balanced/quality). Parallel execution in worktrees. | Single session for all tasks. Context injected via hook. Strict TDD enforcement (red-green-refactor with `tests_failed`/`tests_passed` signals). Write-gate blocks production code until test fails. | **Both contribute uniquely.** GSD-2 context management + megapowers TDD enforcement = ideal |
| **Verification** | Milestone validation gate after all slices. Compares roadmap criteria vs actual. Auto-UAT generation. | Single verify phase. Manual test suite run + per-criterion evidence with gate function. | Megapowers evidence-based verification is more rigorous per-issue |
| **Review** | Adversarial separate-agent review with fresh context. | Code-review phase. Plan-review subagent fan-out (coverage, dependency, task quality). | Different strengths — megapowers reviews plans, GSD-2 reviews code |
| **Completion** | Auto: writes summary, UAT script, marks roadmap, commits. Squash-merge. | Manual done checklist (push-and-pr, changelog, docs). Branch per issue. | GSD-2 automation is better but its scattered file state causes bugs |
| **Cost/Tokens** | Budget ceiling with enforcement. Per-phase/slice/model tracking. Budget pressure auto-downgrades models. Token profiles. | None. | GSD-2 — but adds complexity |
| **Crash Recovery** | Lock file + tool-call recovery briefing + headless auto-restart. | Session restart resets `megaEnabled`. No crash recovery. | GSD-2 |
| **Mid-flight Steering** | `/gsd capture` with auto-triage between tasks (quick-task, inject, defer, replan, note). `/gsd steer` for hard modifications. | None. Must `/mega off` or wait. | GSD-2 |
| **Observability** | Dashboard, 4-tab visualizer, HTML export, doctor health checks, forensics. | Dashboard widget, status command. | GSD-2 — but most of this is UI polish, not core |

---

## Part 2: PALS Unique Contributions

PALS brings several ideas neither GSD-2 nor megapowers have:

### 2.1 The PLAN → APPLY → UNIFY Loop
Every unit of work follows a three-phase loop:
- **PLAN** — Define work, get approval
- **APPLY** — Execute tasks, verify each, record deviations
- **UNIFY** — Reconcile plan vs. actual, write SUMMARY.md, update state

This is cleaner than GSD-2's implicit phase flow or megapowers' signal-based transitions because it has an explicit **reconciliation step** that catches drift between what was planned and what was built.

### 2.2 Context Brackets
PALS adapts behavior based on remaining context capacity:

| Bracket | Remaining | Behavior |
|---------|-----------|----------|
| FRESH | >70% | Full file loads, parallel ops OK |
| MODERATE | 40-70% | Reinforce key context, consider splits |
| DEEP | 20-40% | Summaries over full content, prepare handoffs |
| CRITICAL | <20% | Finish current task only, write handoff |

Neither GSD-2 nor megapowers has this. GSD-2 avoids the problem by using fresh sessions (so context is always "FRESH"), but within a session this is valuable.

### 2.3 Checkpoint System
Three checkpoint types:
- **human-verify** (90%) — Claude completed work, human confirms visually
- **decision** (9%) — Human chooses between options
- **human-action** (1%) — Human must do something Claude can't

These are explicitly typed and have structured resume signals. Megapowers has no equivalent. GSD-2's auto-mode has no human-in-the-loop checkpoints.

### 2.4 Module System (Hooks)
PALS modules hook into `pre-plan` and `post-apply`:
- **dave** — CI/CD config detection and YAML validation
- **dean** — Dependency audit (pre and post)
- **docs** — Doc staleness detection and drift warning
- **iris** — Anti-pattern review (25 patterns)
- **ruby** — Technical debt detection and refactor suggestions

This is a composable quality layer on top of the core loop. Very extensible.

### 2.5 Collaboration Depth
PALS lets users set planning collaboration level (low/medium/high) with per-run overrides. This controls how much discussion happens before planning vs. jumping straight to execution.

### 2.6 Discussion Phase (Pre-Planning Discovery)
PALS has an explicit discuss step (`paul-discuss`) that explores scope before committing to a plan. Creates a handoff file with metadata (planning mode, collaboration level, review path). Similar to GSD-2's research but focused on human-agent dialogue rather than codebase scouting.

---

## Part 3: GSD-2's Bugs — Root Cause Analysis

GSD-2's reliability problems stem from **state derivation from scattered files**:

### Files GSD-2 Uses to Infer State
- `STATE.md` — explicit state (good)
- `ROADMAP.md` — checkbox status for slice completion (fragile)
- `metrics.json` — cost/token tracking
- `routing-history.json` — model routing decisions
- `CAPTURES.md` — pending thoughts
- `completed-units.json` — task completion tracking
- `auto.lock` — current unit lock
- Per-slice: `PLAN.md`, `CONTEXT.md`, `CONTEXT-DRAFT.md`, UAT markers, summary files

### What Goes Wrong
1. **Checkbox drift** — ROADMAP.md checkboxes get out of sync with actual completion state
2. **Summary file loss** — worktree teardown can lose root-level `.gsd/` files (their v2.41 changelog has a specific fix for this)
3. **Completion key races** — doctor auto-fix during post-task health checks can remove valid completion keys due to timing races
4. **UAT marker drift** — UAT completion/failure isn't always written atomically
5. **Empty merge guard** — milestone branches with unanchored changes get deleted when squash-merge produces nothing

### The Lesson
**Never derive state from file presence or content.** Use a single coordination file (`state.json`) with explicit fields. Artifacts exist for human inspection and context injection, not for the system to read back and infer next steps.

---

## Part 4: What to Take from Each System

### From GSD-2 (Context Management)
1. **Fresh session per task** — clean context window, pre-inlined artifacts, no accumulation
2. **Layered context assembly** — task plan at full detail, prior summaries compressed, everything else absent
3. **Task-completion summaries** — 50-100 token compressed records
4. **Pre-planning research** — codebase scouting before plan generation
5. **Token profiles** — budget/balanced/quality context compression levels
6. **The Pyramid of Relevance** — sharp focus (active files full detail), present but compressed (interfaces, manifest), summarized or absent (other components)

### From Megapowers (Discipline Enforcement)
1. **TDD write-gate** — `tests_failed` signal unlocks production writes. Better than self-verification.
2. **Signal-based state machine** — explicit transitions, not file-presence inference
3. **Plan review loop** — structured draft/review/revise with approval gates and iteration limit
4. **Write policy enforcement** — `write`/`edit` intercepted via tool hooks, phase restrictions enforced
5. **Phase-specific prompt templates** — each phase gets tailored instructions
6. **Artifact gates** — phase transitions require specific artifacts to exist

### From PALS (Structured Workflow)
1. **PLAN → APPLY → UNIFY loop** — explicit reconciliation step
2. **Context brackets** — adaptive behavior based on remaining context capacity
3. **Checkpoint system** — typed human interaction points with structured resume
4. **Module hooks** — composable pre-plan and post-apply quality checks
5. **Discussion phase** — exploratory scope shaping before committing to plans
6. **Collaboration depth** — configurable engagement level per workflow run

---

## Part 5: Architectural Principles for the New Extension

### P1: Single Source of State
One `state.json` file. All state mutations go through it. No inferring state from file presence, checkbox status, or marker files.

### P2: Fresh Session Per Task
Each task gets a clean context window. The extension triggers a session reset on task boundaries and re-injects only what the new task needs.

### P3: Artifacts Are for Humans and Context, Not for State
Plans, summaries, specs, and reviews are written to predictable paths. They're injected into prompts as context. But the system never reads them back to determine what to do next — that comes from `state.json`.

### P4: Enforce Discipline at the Tool Layer
Write policy, TDD gates, and phase gates are enforced through Pi's tool hook system (`tool_call` event). The LLM cannot bypass them.

### P5: Reconcile, Don't Assume
After every execution phase, explicitly reconcile what was planned vs. what was built. Don't assume tasks succeeded because the LLM said so — verify and record.

### P6: Lean Over Feature-Rich
Start with the smallest viable workflow: research → plan → implement (with TDD) → verify → done. Add complexity (review phases, parallel execution, cost tracking) only when proven necessary.

---

## Part 6: Proposed Workflow Shape

```
[discuss/research] → plan (draft → review → approve) → implement (per-task, fresh sessions, TDD) → verify → [review] → done
```

### Phase Details

| Phase | What Happens | Artifacts |
|-------|-------------|-----------|
| **Research** (optional) | Scout codebase, identify relevant files, research docs. Produce research brief. | `research.md` |
| **Plan** | Draft tasks from spec + research. Review loop with approval. | `tasks/*.md`, `plan.md` (legacy view) |
| **Implement** | Per-task execution with TDD write-gate. Fresh session per task. Task summaries on completion. | Source code, tests, `task-N-summary.md` |
| **Verify** | Run full test suite. Per-criterion evidence check. Reconcile plan vs. actual. | `verify.md` |
| **Review** (optional, feature only) | Code review with fresh-context reviewer. | `review.md` |
| **Done** | Push, PR, changelog. | Branch merged |

### State Shape (Minimal)
```typescript
interface WorkflowState {
  version: 1;
  activeIssue: string | null;
  workflow: "feature" | "bugfix" | null;
  phase: Phase | null;
  phaseHistory: { from: Phase; to: Phase; timestamp: number }[];
  
  // Plan loop
  planMode: "draft" | "review" | "revise" | null;
  planIteration: number;
  
  // Task execution
  currentTaskIndex: number;
  completedTasks: number[];
  taskSummaries: Record<number, string>; // task index → summary path
  
  // TDD
  tddState: "no-test" | "test-written" | "impl-allowed" | null;
  
  // Enforcement
  enabled: boolean;
  
  // VCS
  branchName: string | null;
  baseBranch: string | null;
}
```

### Context Assembly Per Task
```
[System prompt modifications via before_agent_start]
├── Phase-specific prompt template (implement-task.md)
├── Current task description (full detail)
├── Prior task summaries (compressed, most recent 2-3)
├── Spec/acceptance criteria (compressed)
├── Research brief (if exists, compressed)
└── Tool instructions for current phase
```

---

## Part 7: Key Design Decisions to Make

1. **Session management strategy** — Does the extension trigger Pi session resets, or does it use subagents for task isolation? (Pi SDK question — need to verify what's available)

2. **Plan format** — Megapowers' structured task files vs. PALS' XML-in-markdown vs. GSD-2's roadmap/slice/task hierarchy. Recommendation: megapowers' individual task files are cleanest.

3. **Module/hook system** — Should quality checks (debt detection, doc drift, dependency audit) be built in or pluggable? PALS' module approach is most extensible.

4. **Reconciliation depth** — Full PALS-style UNIFY with SUMMARY.md, or lightweight verify-only? Start lightweight, add UNIFY if drift becomes a problem.

5. **Checkpoint implementation** — PALS checkpoints require human interaction during auto-execution. If this extension is interactive-first (not auto-mode), checkpoints might be unnecessary.

6. **Hierarchy depth** — Flat (issue → tasks) or nested (milestone → slice → tasks)? Start flat, add slicing if issues consistently have >8 tasks.

---

## Appendix A: GSD-2 Context Engineering Principles (Verbatim Key Points)

From `docs/building-coding-agents/11-god-tier-context-engineering.md`:

- "Context is a cache, not a history"
- "Earn every token's place" — token budget system per category
- "Compress at every state transition" — 50-100 token completion records
- "Use the filesystem as your infinite context window"
- "Design for context recovery" — checkpoint at task starts, roll back on confusion
- "Orchestrator-assembled minimal slice + persistent hierarchical memory"

From `docs/building-coding-agents/03-state-machine-context-management.md`:

- Layered memory: Working Context (8k-25k) → Session/Episodic (summary only) → Project Semantic (pointers only) → Ground Truth (zero in prompt)
- "Summarize aggressively between phases"
- "Pull-based, not push-based context"
- "Use structured state for reliability" — JSON/typed for system, natural language for reasoning

## Appendix B: PALS Module Hook Points

```yaml
pre-plan:   # Before plan generation — inject warnings, flags, context
post-apply: # After task execution — validate, audit, check drift
post-unify: # After reconciliation — debt detection, refactor suggestions
```

Modules available: dave (CI/CD), dean (dependencies), docs (documentation), iris (review patterns), ruby (tech debt)

## Appendix C: Megapowers TDD Signal Flow

```
Write test file → run test (expect fail) → megapowers_signal({ action: "tests_failed" })
  → [write-gate unlocked] → write production code → run test (expect pass)
  → megapowers_signal({ action: "tests_passed" }) → run full suite
  → megapowers_signal({ action: "task_done" })
```

The write-gate is enforced at the tool hook level — `write`/`edit` calls are intercepted and blocked if `tddState !== "impl-allowed"` for the current task.
