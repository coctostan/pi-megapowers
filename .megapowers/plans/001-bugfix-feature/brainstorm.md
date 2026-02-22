# Brainstorm: Bugfix Mode (Component 03)

## Problem
The bugfix workflow (`reproduce → diagnose → plan → review → implement → verify → done`) is defined in the state machine but not wired up. Gates, artifact routing, prompts, and done-phase UI only support feature mode. Users creating a bugfix issue get no guided workflow.

## Approach

Bugfix mode completes the second workflow by extending five existing modules (gates, artifact-router, prompts, UI, spec-parser) with workflow-conditional logic. No new modules. The bugfix flow diverges from feature only in its first two phases and its done-phase menu; shared middle phases (plan through verify) work as-is.

The reproduce phase produces a `reproduce.md` artifact documenting the bug, reproduction steps, and expected vs actual behavior. The prompt encourages writing a failing test but doesn't gate on it — keeping the workflow flexible for hard-to-test bugs. The diagnose phase produces `diagnosis.md` with root cause analysis and an optional `## Fixed When` section; if present, acceptance criteria are parsed and tracked through verify. The TDD guard already enforces regression test creation during implement.

The done phase offers a bugfix-specific menu: "Generate bugfix summary" (lighter than feature docs), "Write changelog", and "Capture learnings." The bugfix summary pulls from all workflow artifacts to document what broke, why, and how it was fixed.

## Key Decisions

- **`reproduce.md` as gate artifact, failing test optional** — keeps workflow moving for complex bugs while nudging toward TDD
- **Optional AC via `## Fixed When` in diagnosis** — supports larger bugfixes that need tracked criteria, doesn't burden simple ones
- **Workflow-conditional template variables** (`{{reproduce_content}}`, `{{diagnosis_content}}`) — explicit over abstract, easier to debug
- **No new modules** — extends existing gates, artifact-router, prompts, UI, spec-parser
- **Bugfix done menu: summary + changelog + learnings** — lighter than feature docs but still leaves a documentation trace
- **Every done-menu branch must have a match or catch-all exit** — from project learnings about while-loop hangs

## Components

- **`prompts/reproduce-bug.md`** — new template for reproduce phase
- **`prompts/diagnose-bug.md`** — updated with optional `## Fixed When` section
- **`prompts/generate-bugfix-summary.md`** — new template for done phase
- **`gates.ts`** — two new gates: reproduce→diagnose, diagnose→plan
- **`artifact-router.ts`** — reproduce handler, AC extraction from diagnosis
- **`prompts.ts`** — bugfix variable mapping (reproduce/diagnosis content injection)
- **`ui.ts`** — workflow-conditional done-phase menu
- **`spec-parser.ts`** — AC extraction from `## Fixed When` header

## Testing Strategy

- **Gates:** mock store, assert pass/fail on artifact existence for both new gates
- **Artifact router:** test reproduce/diagnosis save paths; test AC extraction present and absent
- **Prompts:** test template mapping per phase; test variable interpolation with bugfix-specific content
- **UI:** test bugfix done menu labels, each option sets correct doneMode, catch-all exit prevents hangs
- **Spec parser:** test `## Fixed When` parsing and graceful empty on missing/malformed
- All tests unit-level with mocked pi context, following existing patterns
