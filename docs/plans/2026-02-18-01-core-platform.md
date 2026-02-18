# Component Design: Core Platform + jj Integration

**Date:** 2026-02-18
**Parent:** [Architecture](./2026-02-18-architecture.md)
**Status:** Draft
**Scope:** State machine, project store, session persistence, jj integration, basic TUI, package structure

## Goal

Build the foundation that everything else sits on: a pi extension that tracks workflow state, persists it to disk, validates jj state, presents the process UI, and scopes LLM tasks per phase. After this component is complete, the system should be able to:

1. Start pi and see a megapowers dashboard (current issue, phase, available actions)
2. Create/select issues from an issue list
3. Transition through phases (with phase-appropriate prompts injected)
4. Have jj changes created and described automatically at phase boundaries
5. Resume exactly where you left off after closing the terminal

## Package Structure

```
pi-megapowers/
├── package.json
├── extensions/
│   └── megapowers/
│       ├── index.ts              # Extension entry: event wiring, command registration
│       ├── state-machine.ts      # Phase definitions, transitions, rules
│       ├── store.ts              # .megapowers/ filesystem operations
│       ├── jj.ts                 # jj command wrappers + state validation
│       ├── ui.ts                 # Widget rendering, menu presentation
│       └── prompts.ts            # Phase-specific prompt injection
├── prompts/                      # Scoped prompt templates per phase
│   ├── brainstorm.md
│   ├── write-spec.md
│   ├── write-plan.md
│   ├── review-plan.md
│   ├── diagnose-bug.md
│   └── generate-docs.md
└── docs/
    └── plans/
```

```json
// package.json
{
  "name": "pi-megapowers",
  "version": "0.1.0",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"]
  },
  "peerDependencies": {
    "@mariozechner/pi-ai": "*",
    "@mariozechner/pi-agent-core": "*",
    "@mariozechner/pi-coding-agent": "*",
    "@mariozechner/pi-tui": "*",
    "@sinclair/typebox": "*"
  }
}
```

The package is installed as a local path during development:
```bash
pi install /Users/maxwellnewman/pi/workspace/pi-megapowers
```

## State Machine

### Workflow Types and Phases

```typescript
type WorkflowType = "feature" | "bugfix";

type FeaturePhase =
  | "brainstorm"
  | "spec"
  | "plan"
  | "review"      // optional
  | "implement"
  | "verify"
  | "done";

type BugfixPhase =
  | "reproduce"
  | "diagnose"
  | "plan"
  | "review"      // optional
  | "implement"
  | "verify"
  | "done";

type Phase = FeaturePhase | BugfixPhase;
```

### Transition Rules

Transitions are deterministic. The extension decides what transitions are valid; the user picks from the valid options.

**Feature mode transitions:**
```
brainstorm → spec → plan → review → implement → verify → done
                         ↘                    ↗
                          implement (skip review)
```

**Bugfix mode transitions:**
```
reproduce → diagnose → plan → review → implement → verify → done
                            ↘                    ↗
                             implement (skip review)
```

**Transition preconditions (enforced by extension):**

| From → To | Precondition |
|-----------|-------------|
| brainstorm → spec | None (brainstorm is freeform) |
| spec → plan | `spec.md` exists in issue plan directory |
| plan → review | `plan.md` exists |
| plan → implement | `plan.md` exists (skipping review) |
| review → implement | Review approved (stored in state) |
| reproduce → diagnose | Failing test or repro script exists |
| diagnose → plan | `diagnosis.md` exists |
| implement → verify | All plan tasks marked complete |
| verify → done | Test suite passes (extension runs tests and checks exit code) |

### State Shape

```typescript
interface MegapowersState {
  version: 1;
  activeIssue: string | null;          // e.g., "001-api-auth-refactor"
  workflow: WorkflowType | null;
  phase: Phase | null;
  phaseHistory: PhaseTransition[];     // audit trail
  reviewApproved: boolean;
  planTasks: PlanTask[];               // extracted from plan.md
  jjChangeId: string | null;           // current jj change ID
}

interface PhaseTransition {
  from: Phase | null;
  to: Phase;
  timestamp: number;
  jjChangeId?: string;
}

interface PlanTask {
  index: number;
  description: string;
  completed: boolean;
}
```

## Project Store

All persistent data lives in `.megapowers/` at the project root. The extension creates this directory on first use.

```
.megapowers/
├── state.json                        # Current workflow state (MegapowersState)
├── issues/
│   ├── 001-api-auth-refactor.md      # Issue description
│   └── 002-fix-timeout-bug.md
├── plans/
│   ├── 001-api-auth-refactor/
│   │   ├── spec.md
│   │   ├── plan.md
│   │   └── review.md
│   └── 002-fix-timeout-bug/
│       ├── diagnosis.md
│       └── plan.md
├── learnings/
│   └── learnings.md
└── docs/                             # Generated living docs (future)
```

### store.ts API

```typescript
interface Store {
  // State
  loadState(): MegapowersState;
  saveState(state: MegapowersState): void;

  // Issues
  listIssues(): Issue[];
  createIssue(title: string, type: WorkflowType, description: string): Issue;
  getIssue(slug: string): Issue | null;
  updateIssueStatus(slug: string, status: IssueStatus): void;

  // Plans
  ensurePlanDir(issueSlug: string): string;
  writePlanFile(issueSlug: string, filename: string, content: string): void;
  readPlanFile(issueSlug: string, filename: string): string | null;
  planFileExists(issueSlug: string, filename: string): boolean;

  // Learnings
  getLearnings(): string;
  appendLearning(learning: string): void;
}

interface Issue {
  id: number;
  slug: string;            // e.g., "001-api-auth-refactor"
  title: string;
  type: WorkflowType;
  status: IssueStatus;
  description: string;
  createdAt: number;
}

type IssueStatus = "open" | "in-progress" | "done";
```

### Issue File Format

```markdown
<!-- .megapowers/issues/001-api-auth-refactor.md -->
---
id: 1
type: feature
status: open
created: 2026-02-18T12:00:00Z
---

# API Auth Refactor

Refactor the auth module to use JWT tokens instead of session cookies.
```

Simple YAML frontmatter + markdown body. Human-readable, git-friendly.

## jj Integration

### jj.ts API

```typescript
interface JJ {
  // Validation
  isJJRepo(): boolean;
  getCurrentChangeId(): string;
  getChangeDescription(): string;
  hasConflicts(): boolean;

  // Operations
  newChange(description: string): string;         // returns change ID
  describe(description: string): void;
  squash(): void;
  bookmarkSet(name: string): void;

  // Queries
  log(revset?: string): string;
}
```

All jj operations use `pi.exec("jj", [...args])`. The extension never shells out raw — it uses structured commands and parses output.

### jj Lifecycle

**Session start (`session_start`):**
1. Check `isJJRepo()`. If not, offer to init: `jj git init`
2. Load state from `.megapowers/state.json`
3. If there's an active issue with a stored `jjChangeId`, verify current change matches. If not, surface: "You're on change X but issue Y expects change Z. Switch back?"
4. Render dashboard

**Phase transitions:**
When the extension advances to a new phase:
```typescript
async function transitionPhase(newPhase: Phase, state: MegapowersState, jj: JJ, store: Store) {
  // 1. Describe current change with phase completion
  jj.describe(`mega(${state.activeIssue}): ${state.phase} complete`);

  // 2. Create new change for next phase
  const changeId = jj.newChange(`mega(${state.activeIssue}): ${newPhase}`);

  // 3. Update state
  state.phase = newPhase;
  state.jjChangeId = changeId;
  state.phaseHistory.push({
    from: state.phase,
    to: newPhase,
    timestamp: Date.now(),
    jjChangeId: changeId,
  });
  store.saveState(state);
}
```

**Starting work on an issue:**
```typescript
// Create new change off main
const changeId = jj.newChange(`mega(${issue.slug}): ${firstPhase}`);
```

**Done phase — present cleanup options:**
1. Squash all changes: `jj squash` down to one commit
2. Keep phase history as-is
3. Push bookmark: `jj bookmark set mega/${issueId} && jj git push`

## Extension Wiring (index.ts)

### Event Handlers

```typescript
export default function megapowers(pi: ExtensionAPI): void {
  const store = createStore(/* cwd */);
  const jj = createJJ(pi);
  const ui = createUI(pi);
  let state: MegapowersState;

  // --- Session lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    state = store.loadState();

    // jj validation
    if (jj.isJJRepo()) {
      if (state.activeIssue && state.jjChangeId) {
        const current = jj.getCurrentChangeId();
        if (current !== state.jjChangeId) {
          // Surface mismatch
          const choice = await ctx.ui.select(
            `Wrong change: on ${current}, expected ${state.jjChangeId} for ${state.activeIssue}`,
            ["Switch back", "Continue on current change", "Abort"]
          );
          // Handle choice...
        }
      }
    }

    ui.renderDashboard(ctx, state, store);
  });

  // --- Input interception ---

  pi.on("input", async (event, ctx) => {
    // If no active issue, intercept input and present issue selection
    if (!state.activeIssue) {
      return await ui.handleNoActiveIssue(ctx, state, store, jj, event.text);
    }

    // If at a phase boundary, present transition options
    if (isPhaseComplete(state)) {
      return await ui.handlePhaseTransition(ctx, state, store, jj);
    }

    // Otherwise, let the LLM handle it with phase-scoped prompt
    return { action: "continue" };
  });

  // --- Prompt injection ---

  pi.on("before_agent_start", async (event, ctx) => {
    if (!state.activeIssue || !state.phase) return;

    const phasePrompt = getPhasePrompt(state.phase, state, store);
    const learnings = getRelevantLearnings(state, store);

    return {
      message: {
        customType: "megapowers-context",
        content: phasePrompt + (learnings ? `\n\n${learnings}` : ""),
        display: false,
      },
    };
  });

  // --- Agent completion ---

  pi.on("agent_end", async (event, ctx) => {
    // Check if phase artifacts were produced
    // Update task completion tracking
    // Present next action options
    await ui.handleAgentEnd(ctx, state, store, jj, event);
  });

  // --- Session persistence ---

  pi.on("session_shutdown", async () => {
    store.saveState(state);
  });

  // --- Commands ---

  pi.registerCommand("mega", {
    description: "Megapowers dashboard",
    handler: async (args, ctx) => {
      ui.renderDashboard(ctx, state, store);
    },
  });

  pi.registerCommand("issue", {
    description: "Create or list issues",
    handler: async (args, ctx) => {
      await ui.handleIssueCommand(ctx, state, store, jj, args);
    },
  });

  pi.registerCommand("phase", {
    description: "Show current phase or force transition",
    handler: async (args, ctx) => {
      await ui.handlePhaseCommand(ctx, state, store, jj, args);
    },
  });

  pi.registerCommand("learn", {
    description: "Capture a learning",
    handler: async (args, ctx) => {
      if (args) {
        store.appendLearning(args);
        ctx.ui.notify("Learning captured.", "success");
      } else {
        const learning = await ctx.ui.input("What did you learn?");
        if (learning) {
          store.appendLearning(learning);
          ctx.ui.notify("Learning captured.", "success");
        }
      }
    },
  });
}
```

## TUI / UX

### Dashboard Widget

Rendered via `ctx.ui.setWidget()` on every state change. Always visible above the editor.

```
┌─ megapowers ────────────────────────────────┐
│ Issue: #001 API Auth Refactor [feature]     │
│ Phase: plan  (brainstorm → spec → ▶plan)    │
│ Tasks: 0/5 complete                          │
│ jj: ksqx on mega/001-api-auth-refactor      │
└──────────────────────────────────────────────┘
```

When no issue is active:
```
┌─ megapowers ────────────────────────────────┐
│ No active issue.                             │
│ /issue new — create an issue                 │
│ /issue list — pick an issue to work on       │
└──────────────────────────────────────────────┘
```

### Footer Status

Via `ctx.ui.setStatus()`: compact one-line summary.
```
📋 #001 plan 0/5
```

### Phase Transition Flow

When a phase completes, the extension uses `ctx.ui.select()`:

```
Phase "plan" complete. What next?
> Submit plan for review
  Skip review, start implementation
  Go back and revise the plan
```

### Issue Selection

When starting fresh or using `/issue list`:

```
Pick an issue to work on:
> #001 API Auth Refactor [feature] [open]
  #002 Fix Timeout Bug [bugfix] [open]
  Create new issue...
```

## Phase-Specific Prompts

Each phase injects a scoped prompt via `before_agent_start`. These are loaded from the `prompts/` directory and interpolated with current state.

**Example: `prompts/write-plan.md`**
```markdown
You are writing an implementation plan for the following spec.

## Spec
{{spec_content}}

## Instructions
- Break the spec into ordered, independently testable tasks
- Each task should be small enough to implement with TDD in one session
- Number each task
- For each task, note what test(s) would verify it
- Do not include setup/boilerplate unless it's genuinely a separate step

Write the plan as a markdown document. When done, the plan will be saved to
the project store automatically.
```

The extension reads the template, substitutes `{{spec_content}}` with the actual spec, and injects it.

**Key principle:** The LLM never sees "you are in megapowers phase X of the development lifecycle." It just gets a clear, scoped job: "write a plan for this spec" or "diagnose why this test fails." The process is invisible to the LLM.

## Prompt Routing and LLM Output Handling

### How the extension captures LLM output per phase

The extension needs to take what the LLM produces and route it to the right place. The approach:

1. **`agent_end` handler** inspects the last assistant message
2. Based on current phase, it extracts the content and writes it to the appropriate plan file
3. It then checks transition preconditions and offers next steps

```typescript
// In agent_end handler
if (state.phase === "spec") {
  const content = getLastAssistantText(event.messages);
  if (content) {
    store.writePlanFile(state.activeIssue!, "spec.md", content);
    ctx.ui.notify("Spec saved.", "success");
    // Offer transition to plan phase
  }
}

if (state.phase === "plan") {
  const content = getLastAssistantText(event.messages);
  if (content) {
    store.writePlanFile(state.activeIssue!, "plan.md", content);
    state.planTasks = extractPlanTasks(content);
    store.saveState(state);
    ctx.ui.notify(`Plan saved. ${state.planTasks.length} tasks extracted.`, "success");
    // Offer transition to review or implement
  }
}
```

### Plan Task Extraction

The extension parses numbered lists from `plan.md`:

```typescript
function extractPlanTasks(planContent: string): PlanTask[] {
  // Match lines like "1. Do the thing" or "- [ ] Do the thing"
  const lines = planContent.split("\n");
  const tasks: PlanTask[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (match) {
      tasks.push({
        index: parseInt(match[1]),
        description: match[2].trim(),
        completed: false,
      });
    }
  }
  return tasks;
}
```

## Session Persistence Strategy

Two layers of persistence:

1. **`.megapowers/state.json`** — The source of truth for workflow state. Written on every transition and shutdown. This is what survives across sessions.

2. **`pi.appendEntry()`** — Pi's session persistence. Used to record phase transitions within a pi session so state can be reconstructed on session resume (same session, different terminal). Entries are append-only markers.

On `session_start`, the extension:
1. Loads `.megapowers/state.json` (always authoritative)
2. Scans pi session entries for any transitions that happened after the last state.json write (crash recovery)
3. Reconciles and renders

## Error Handling

- **jj not installed:** Notify on session_start, block all workflow operations, suggest install instructions.
- **Not a jj repo:** Offer to initialize with `jj git init`.
- **State file corrupt:** Fall back to defaults, notify user, log the error. Never crash the extension.
- **Plan file missing when expected:** Surface clearly ("Expected spec.md but it doesn't exist. Was it deleted?"), don't silently proceed.
- **jj change mismatch:** Always surface and ask, never silently switch.

## What This Component Does NOT Include

- TDD enforcement (tdd-guard) — separate component
- Subagent orchestration — separate component
- Circuit breakers — separate component
- Living documentation generation — separate component
- Advanced subagent strategies — separate component

These will be layered on top once the core platform is stable.

## Open Questions for Implementation

- Exact widget styling (iterate during build)
- How to handle the user typing freely when the extension expects a phase transition (likely: let them, the `before_agent_start` prompt keeps the LLM scoped)
- Whether `input` interception or `agent_end` handling is the better place to drive transitions (likely: `agent_end` for most cases, `input` only for the "no active issue" guard)
