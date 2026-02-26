Here's the bugfix summary:

---

# Bugfix: Backward Phase Transitions Unreachable & Artifact Overwrites Silently Destroy History

## Bug Description

Two separate bugs were fixed. First, backward phase transitions (e.g. `code-review → implement`, `verify → implement`, `review → plan`) were structurally unreachable via the LLM tool and `/phase` command — both paths hardcoded `undefined` as the target phase, always advancing forward. Second, calling `megapowers_save_artifact` on an already-written artifact silently overwrote it with no backup, permanently destroying prior content.

## Root Cause

**Bug A (#069):** `handleSignal → handlePhaseNext → advancePhase` never passed a target phase. `advancePhase(cwd, undefined, jj)` always resolved to `validNext[0]` — the first (forward) transition. The `megapowers_signal` tool schema had no `target` field, and the `/phase` command only handled the literal string `"next"`. Additionally, the bugfix workflow config defined zero backward transitions, making them impossible even from the UI path.

**Bug B (#041):** `handleSaveArtifact` called `writeFileSync` unconditionally. No `existsSync` check, no `renameSync` backup. The function was written as a simple write-through with no consideration for re-invocation.

## Fix Applied

**Bug A:** Added an optional `target` parameter through the entire call chain: `handleSignal` → `handlePhaseNext` → `advancePhase`. Updated the `megapowers_signal` tool schema with an optional `target` string field. Updated `/phase <target>` command handling so any sub-command other than `"next"` is treated as an explicit target phase (backward or forward). Added `review→plan` and `verify→implement` backward transitions to the bugfix workflow config — these were present in feature but missing from bugfix entirely.

**Bug B:** Replaced the unconditional `writeFileSync` with a versioning pattern: if the artifact file already exists, `readdirSync` scans for existing `.vN.md` files to find the next version number, then `renameSync` moves the current file to `${phase}.vN.md` before writing the new content. Downstream consumers (`deriveTasks`, `deriveAcceptanceCriteria`) always read from the unversioned filename so no other code was affected.

## Regression Tests

- `tests/tool-signal.test.ts`: "phase_next uses explicit target for backward transition" — confirms `handleSignal(cwd, "phase_next", undefined, "implement")` transitions `code-review → implement`
- `tests/tool-signal.test.ts`: "megapowers_signal schema includes optional target parameter" — confirms tool schema exposes `target`
- `tests/commands-phase.test.ts` (new file): four tests covering `/phase implement` (backward), `/phase plan` (backward), `/phase` (status), `/phase next` (forward — preserved behavior)
- `tests/workflow-configs.test.ts`: "has review → plan as backward transition" and "has verify → implement as backward transition" for bugfix workflow
- `tests/tool-artifact.test.ts`: "creates spec.v1.md backup when saving spec twice" and "creates sequential versions on repeated saves"
- `tests/084-reproduce.test.ts`: regression suite documenting original symptoms for all three source issues (#069, #041, #061)

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/tools/tool-signal.ts` | Added `target?: string` to `handleSignal` and `handlePhaseNext`; wired through to `advancePhase` |
| `extensions/megapowers/tools/tool-artifact.ts` | Added versioning logic: `existsSync` + `readdirSync` version scan + `renameSync` before write |
| `extensions/megapowers/register-tools.ts` | Added optional `target` field to `megapowers_signal` tool schema; passed `params.target` to `handleSignal` |
| `extensions/megapowers/commands.ts` | Updated `/phase` handler to treat non-"next" sub-commands as target phase arguments |
| `extensions/megapowers/workflows/bugfix.ts` | Added `review→plan` and `verify→implement` backward transitions |
| `tests/tool-signal.test.ts` | New tests for explicit target and schema presence |
| `tests/tool-artifact.test.ts` | New tests for v1 and sequential versioning |
| `tests/commands-phase.test.ts` | New test file for `/phase <target>` command |
| `tests/workflow-configs.test.ts` | New tests for bugfix backward transitions |
| `tests/084-reproduce.test.ts` | New regression test file for all three source bugs |

---

Does this look good to you, or would you like any adjustments before I save it?