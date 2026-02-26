# Diagnosis

## Root Cause

Two independent root causes for two remaining bugs (#061 already fixed):

### Bug A (#069): Backward transitions unreachable via tool/command

**Root cause**: The `handleSignal` → `handlePhaseNext` → `advancePhase` call chain never passes a target phase. `advancePhase` defaults to `validNext[0]` which is always the forward transition. Additionally, the tool schema doesn't expose a `target` parameter, and `/phase <target>` isn't implemented.

The interactive UI path (`ui.handlePhaseTransition` via `onAgentEnd`) **does** work — it shows all valid transitions including backward ones via `ctx.ui.select()`. But the two programmatic paths (LLM tool + slash command) are broken.

**Secondary issue**: The bugfix workflow config (`bugfix.ts`) defines **zero** backward transitions, while feature defines 3. Bugfix should have at minimum `review→plan` and `verify→implement`.

### Bug B (#041): Artifact overwrite with no versioning

**Root cause**: `handleSaveArtifact` calls `writeFileSync` unconditionally on line 28 of `tool-artifact.ts`. No `existsSync` check, no `renameSync` backup. The function was written as a simple write-through with no consideration for re-invocation.

## Trace

### Bug A trace
```
LLM calls megapowers_signal({ action: "phase_next" })
  → register-tools.ts:35 — handleSignal(ctx.cwd, params.action, jj)
    → tool-signal.ts:31 — case "phase_next": handlePhaseNext(cwd, jj)
      → tool-signal.ts:244 — advancePhase(cwd, undefined, jj)
        → phase-advance.ts:27 — const target = targetPhase ?? validNext[0]
          → targetPhase is undefined → picks validNext[0] → always forward
```

The `advancePhase` function already accepts `targetPhase?: Phase` — it's designed for this. The pipe is just disconnected: `handleSignal` doesn't accept a target, `handlePhaseNext` doesn't pass one, and the tool schema doesn't expose one.

### Bug B trace
```
LLM calls megapowers_save_artifact({ phase: "spec", content: "..." })
  → register-tools.ts:52 — handleSaveArtifact(ctx.cwd, params.phase, params.content)
    → tool-artifact.ts:28 — writeFileSync(join(dir, `${phase}.md`), content)
      → Overwrites unconditionally. No existsSync check. No renameSync backup.
```

## Affected Code

### Bug A (#069)
| File | Function | Issue |
|------|----------|-------|
| `extensions/megapowers/tools/tool-signal.ts:14-17` | `handleSignal()` | No target parameter in signature |
| `extensions/megapowers/tools/tool-signal.ts:243-248` | `handlePhaseNext()` | Passes `undefined` to advancePhase |
| `extensions/megapowers/register-tools.ts:26-39` | Tool schema | No `target` field in parameters |
| `extensions/megapowers/commands.ts:78-92` | `handlePhaseCommand()` | Only handles `"next"` and status |
| `extensions/megapowers/workflows/bugfix.ts:21-27` | transitions array | Missing backward transitions |

### Bug B (#041)
| File | Function | Issue |
|------|----------|-------|
| `extensions/megapowers/tools/tool-artifact.ts:18-33` | `handleSaveArtifact()` | No existsSync/renameSync logic |

## Pattern Analysis

### Bug A — working vs broken
The UI path (`ui.ts:447-486`) correctly enumerates all valid transitions (forward AND backward) and lets the user pick. It even labels backward ones with `← implement (go back)`. The programmatic paths (`tool-signal.ts`, `commands.ts`) skip this and hardcode `undefined` as the target.

`advancePhase` already supports a target — `const target = targetPhase ?? validNext[0]`. The plumbing exists. It just needs to be connected through `handleSignal` and the tool schema.

### Bug B — working vs broken
No existing code in the project does artifact versioning. This is entirely missing functionality, not a broken pattern. The issue description provides a clear implementation pattern using `readdirSync` + `renameSync`.

## Risk Assessment

### Bug A
- **Low risk**: `advancePhase` already validates via `canTransition()` and gate checks. Adding a target parameter to `handleSignal` just passes it through — validation is unchanged.
- **Tool schema change**: Adding an optional `target` field to `megapowers_signal` is backward-compatible.
- **Prompt updates needed**: `code-review.md` and `verify.md` prompts should instruct the LLM to use the target parameter for backward transitions.
- **Bugfix workflow**: Adding backward transitions to `bugfix.ts` is additive — no existing behavior changes.

### Bug B
- **Low risk**: Versioning happens before write — if renameSync fails, writeFileSync won't run (exception propagates).
- **No downstream impact**: `deriveTasks()` and `deriveAcceptanceCriteria()` always read from `plan.md`/`spec.md` (unversioned name). Versioned files are backup-only.
- **Directory pollution**: Over many iterations, versioned files accumulate. Acceptable — they're small markdown files in issue-specific directories.

## Fixed When
1. `megapowers_signal({ action: "phase_next", target: "implement" })` successfully transitions backward (e.g., `code-review → implement`)
2. `/phase implement` command triggers backward transition from code-review
3. `/phase plan` command triggers backward transition from review
4. Bugfix workflow has `review→plan` and `verify→implement` backward transitions
5. `handleSaveArtifact` creates versioned backup (`spec.v1.md`) when overwriting existing artifact
6. Third overwrite creates `spec.v1.md` and `spec.v2.md`, with `spec.md` containing latest content
7. All existing tests continue to pass (no regressions)
8. #061 remains fixed (regression test passes)
