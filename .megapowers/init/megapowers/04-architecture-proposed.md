# Proposed Architecture — Megapowers V1

> **Date:** 2026-02-25
> **Status:** Draft — pending answers to open questions
> **Input:** Current architecture doc (`04-architecture.md`) + PRD (`03-prd.md`)

---

## Proposed Module Structure

```
extensions/megapowers/
├── index.ts                    # Entry point — thin wiring only (~150 lines)
├── core/
│   ├── state-machine.ts        # Generalized: phase configs, transitions, cascade invalidation
│   ├── state-io.ts             # Read/write state.json (unchanged)
│   ├── gates.ts                # Gate checks (generalized for init + dev)
│   ├── write-policy.ts         # Write policy (unchanged)
│   ├── store.ts                # File-system store (extended for init artifacts)
│   └── derived.ts              # Task/criteria derivation (unchanged)
├── workflows/
│   ├── workflow-configs.ts     # Phase definitions for: feature, bugfix, init-green, init-brown
│   ├── phase-advance.ts        # Phase transition logic + cascade invalidation
│   ├── plan-review-loop.ts     # Momus-style iterative plan/review (NEW)
│   └── done-sequence.ts        # Automated done phase (NEW)
├── subagent/
│   ├── dispatcher.ts           # Task delegation + context building
│   ├── runner.ts               # Spawn pi process, parse JSONL (extracted from index.ts)
│   ├── workspace.ts            # JJ workspace create/squash/cleanup
│   ├── status.ts               # Status tracking + UI data
│   ├── chain.ts                # Per-task chain: implement → verify → code-review (NEW)
│   ├── errors.ts               # Error detection (unchanged)
│   └── agents.ts               # Agent configs (unchanged)
├── ui/
│   ├── dashboard.ts            # Widget rendering (pure)
│   ├── phase-transition.ts     # Phase transition UX (NEW pattern)
│   ├── commands.ts             # /mp command router + contextual command list
│   └── notifications.ts        # Feedback messages (pure)
├── hooks/
│   ├── session.ts              # session_start handler
│   ├── prompt-inject.ts        # before_agent_start handler
│   ├── write-guard.ts          # tool_call handler for write policy
│   ├── agent-end.ts            # agent_end handler (phase transitions)
│   └── satellite.ts            # Satellite mode (subagent sessions)
├── prompts/
│   ├── loader.ts               # Template loading + interpolation (from prompts.ts)
│   └── templates.ts            # Phase-specific tool instructions (from prompt-inject.ts)
├── parsers/
│   ├── plan-parser.ts          # (unchanged)
│   └── spec-parser.ts          # (unchanged)
├── jj/
│   ├── jj.ts                   # JJ operations (unchanged)
│   └── messages.ts             # JJ messages (unchanged)
└── init/
    ├── init-engine.ts          # Init workflow orchestration (NEW)
    ├── foundation-docs.ts      # Foundation doc read/update/revisit (NEW)
    └── templates.ts            # Init phase templates + gates (NEW)
```

**Key principle:** `index.ts` becomes a thin wiring file that imports handlers from subdirectories and registers them with pi. No business logic in index.ts.

---

## Design Decisions

### 1. Generalized State Machine

**Current:** `WorkflowType = "feature" | "bugfix"` with hardcoded transition tables.

**Proposed:** A `WorkflowConfig` type that defines phases, transitions, and gates for any workflow:

```typescript
interface WorkflowConfig {
  type: string;                           // "feature" | "bugfix" | "init-green" | "init-brown"
  phases: string[];                       // Ordered phase list
  transitions: Record<string, string[]>;  // Valid next phases from each phase
  openEnded: Set<string>;                 // Phases that suppress auto-transition prompts
  gates: Record<string, GateCheck>;       // Gate function per transition
  cascadeInvalidation: boolean;           // Whether backward transitions invalidate downstream
}
```

The `transition()` function and `canTransition()` work the same way but read from config rather than hardcoded tables. `state.json` gains a `workflowConfig` field (or we store the config type and look it up).

**Init configs** are simpler: linear phase progression, all phases are open-ended (collaborative), gates check for artifact existence, no TDD/subagent/task tracking.

**Backward transitions with cascade invalidation:**
- When going backward, compute all downstream phases from the target
- Mark downstream artifacts as stale (rename to `*.stale.md`, not delete)
- Reset downstream state (reviewApproved, completedTasks, etc.)
- Warn user before executing: "Going back to spec will invalidate: plan, review, implement state. Proceed?"

### 2. Plan/Review Loop (Momus Pattern)

**Current flow:** plan → review (separate phases, binary gate)
**Proposed flow:** plan-review (one phase with internal loop)

```
┌─────────────────────────────────────────────┐
│              plan-review phase              │
│                                             │
│  ┌──────────┐    ┌────────┐    ┌────────┐  │
│  │ Interview │───▶│ Draft  │───▶│ Review │  │
│  │ (planner)│    │(planner)│   │(reviewer)│ │
│  └──────────┘    └────────┘    └────┬───┘  │
│       ▲                            │       │
│       │              ┌─────────────┤       │
│       │              ▼             ▼       │
│  ┌────┴───┐    ┌──────────┐  ┌────────┐   │
│  │ User   │    │  REJECT  │  │  OKAY  │   │
│  │intervene│   │(fix plan)│  │(proceed)│   │
│  └────────┘    └──────────┘  └────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Multi-model orchestration:** The plan-review phase manages two models:
- **Planner model** (configurable, default: Claude Opus) — interviews, drafts, fixes
- **Reviewer model** (configurable, default: GPT-5.2) — reviews against checklist

**How this works with pi:** The plan-review phase isn't a standard "inject prompt, let agent run" phase. It's an **orchestrated conversation**:

1. Phase starts → planner prompt injected → planner interviews user
2. User answers → planner drafts plan → plan artifact saved
3. System triggers reviewer: send plan to reviewer model via separate API call (not the current conversation)
4. Reviewer returns verdict (OKAY/REJECT with details)
5. If REJECT → verdict shown to planner → planner fixes → back to step 3
6. If OKAY → phase complete → proceed to implement
7. User can intervene at any point in the conversation

**The reviewer is a subagent call** — same infrastructure as task implementation, verify, and code review. Different prompt, different model, same mechanism. One subagent system for everything.

**Autonomy with checkpoints:** The loop runs autonomously but prompts the user when:
- Review score exceeds threshold (>90%)
- Loop has run N iterations
- Planner believes it's ready

State tracking for the loop:
```typescript
interface PlanReviewState {
  iteration: number;
  lastVerdict: "pending" | "okay" | "reject";
  lastScore?: number;
  lastIssues?: string[];
  plannerModel: string;
  reviewerModel: string;
}
```

### 3. Subagent Pipeline

**Current:** Subagent spawn logic is 150+ lines inline in `index.ts` tool execute.

**Proposed:** Extract into clean pipeline:

```
dispatcher.ts → workspace.ts → runner.ts → status.ts
                                    ↓
                               chain.ts (implement → verify → code-review)
```

**Per-task chain:**
```
Task N from plan
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Implement   │────▶│   Verify     │────▶│ Code Review  │
│  subagent    │     │  subagent    │     │  subagent    │
│  (writes code)│    │ (runs tests) │     │ (reviews)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                          ┌───────┴────────┐
                                          ▼                ▼
                                     ✅ PASS          ❌ REJECT
                                     (next task)      (back to main agent)
```

**Subagent context:** Task description, relevant file paths, acceptance criteria, TDD instructions. Just this task — not the full plan.

**JJ workspaces:** Keep for V1 (rollback value + V1.1 parallel prep) but fix squash (#067).

### 4. UX Architecture

**Current:** `agent_end hook → select widget → transition`

**Proposed:**
```
phase completes → notification: "✅ Phase X complete. Next: Phase Y."
                → contextual commands available via /mp
                → user proceeds → clean context window → next phase starts
```

**`/mp` as contextual command hub:**
```
/mp                    → shows all available commands for current state
/mp next               → advance to next phase
/mp back [phase]       → go backward (with cascade warning)
/mp status             → current phase, task, TDD state
/mp issue [subcommand] → issue management
/mp triage             → triage open issues
/mp tdd skip           → skip TDD for current task
/mp audit              → trigger foundation doc re-audit
/mp revisit            → revisit foundation docs
```

**Clean context windows:** When a phase completes:
1. Artifact is saved
2. Current conversation ends
3. New conversation starts with: phase prompt + artifact from previous phase
4. Agent immediately orients

**Implementation:** Signal handler calls `pi.sendUserMessage("/mp next", { deliverAs: "followUp" })` which triggers the `/mp next` command. That command has `ExtensionCommandContext` with `ctx.newSession()`. Fully programmatic — user never types anything.

### 5. Done Phase Sequence

**Current:** While loop with select menu.

**Proposed:** Automated sequence with one confirmation point:

```
1. Review & update artifacts            (automated)
2. Update foundation docs (if needed)   (proposed, user-approved)
3. Generate changelog entry             (automated)
4. Confirmation: "Ready for final       (user confirms)
   processes? [docs, changelog, VCS]
   Options: ✅ Proceed / 💬 Discuss"
5. VCS close (merge or push/PR)         (automated)
6. Archive issue                        (automated)
```

### 6. Init System

Same generalized state machine, simpler config:

```typescript
const INIT_BROWNFIELD_CONFIG: WorkflowConfig = {
  type: "init-brown",
  phases: ["audit", "discovery", "vision", "prd", "architecture", "roadmap", "issues"],
  transitions: {
    audit: ["discovery"],
    discovery: ["vision"],
    vision: ["prd"],
    prd: ["architecture"],
    architecture: ["roadmap"],
    roadmap: ["issues"],
    issues: [],
  },
  openEnded: new Set(["audit", "discovery", "vision", "prd", "architecture", "roadmap", "issues"]),
  gates: { /* artifact existence checks per transition */ },
  cascadeInvalidation: true,
};
```

**Foundation doc integration:**
- During brainstorm: prompt includes vision, PRD, architecture excerpts
- During done: agent proposes foundation doc updates, user approves
- On demand: `/mp audit` re-runs audit, `/mp revisit` reviews for staleness

**State:** Shared `state.json` with `system: "init" | "dev"` discriminator.

---

## Migration Path

Restructure, not rewrite. Each step independently testable:

1. **Create directory structure** — move existing files into subdirectories
2. **Extract index.ts** — pull handlers into hooks/, tools into workflows/ and subagent/
3. **Generalize state machine** — add WorkflowConfig, keep existing transition logic
4. **Add plan-review loop** — new module, replaces plan + review as separate phases
5. **Fix subagent pipeline** — extract from index.ts, fix squash, add chain
6. **Rebuild UX** — new phase transition pattern, /mp hub, clean context windows
7. **Add done sequence** — replace done menu with automated sequence
8. **Add init system** — new modules, new workflow config, foundation docs
9. **Add backward transitions** — cascade invalidation logic

Existing 546 tests should pass through steps 1-3.

---

## Resolved Questions

1. **Model API calls:** One subagent system for everything — reviewer, verify, code review, implementation. All subagent calls with different prompts/models. No separate mechanism needed.
2. **Clean context windows:** Programmatic via `pi.sendUserMessage("/mp next", { deliverAs: "followUp" })` → command handler → `ctx.newSession()`. Proven pi pattern.
3. **JJ workspaces:** Keep for V1. Fix squash (#067). Rollback value + V1.1 parallel prep.
4. **State file:** Shared `state.json` with `system` discriminator.
5. **Reviewer verdict visibility:** Shown to user via subagent UI (collapsed widget, expandable). Transparent, not hidden.
