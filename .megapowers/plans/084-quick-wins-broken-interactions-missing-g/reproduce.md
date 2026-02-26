# Reproduction: Quick Wins — Broken Interactions & Missing Guards (#084)

Three source issues batched together. One already fixed, two confirmed.

## Bug 1 (#069): Backward Phase Transitions Unreachable

### Steps to Reproduce
1. Enter feature workflow, advance to `code-review` phase
2. Code review finds structural problems requiring rework
3. Try to transition backward to `implement` via `megapowers_signal({ action: "phase_next" })`
4. Observe: always advances forward to `done`, never backward to `implement`

### Expected Behavior
There should be a way to trigger backward transitions (`code-review → implement`, `verify → implement`, `review → plan`) that are defined in workflow configs.

### Actual Behavior
`handlePhaseNext` always calls `advancePhase(cwd, undefined, jj)` — no target parameter. `advancePhase` with `undefined` target picks `validNext[0]`, which is always the forward transition. The `megapowers_signal` tool schema has no `target` field. The `/phase` command only handles `"next"` (forward) or shows status.

### Evidence
- `tool-signal.ts:243` — `handlePhaseNext(cwd, jj)` passes no target
- `tool-signal.ts:244` — calls `advancePhase(cwd, undefined, jj)`  
- `phase-advance.ts:24` — `const target = targetPhase ?? validNext[0]` always picks first (forward) transition
- `register-tools.ts:33-39` — tool schema only has `action`, no `target` parameter
- `commands.ts:80-84` — `/phase` only handles `"next"` or shows status, no `/phase <target>`
- `feature.ts` and `bugfix.ts` define backward transitions with `backward: true` flag but they're dead code
- Bugfix workflow (`bugfix.ts`) has NO backward transitions defined at all

### Reproducibility
Always — backward transitions are structurally unreachable in the current code.

---

## Bug 2 (#041): Artifact Overwrite Silently Destroys Content

### Steps to Reproduce
1. Have an active issue with a `spec.md` artifact
2. Call `megapowers_save_artifact({ phase: "spec", content: "new content" })`
3. Observe: original `spec.md` is overwritten with no backup

### Expected Behavior
When overwriting an existing artifact, the old version should be preserved as a versioned backup (e.g., `spec.v1.md`).

### Actual Behavior
`tool-artifact.ts:28` calls `writeFileSync(join(dir, \`${phase}.md\`), content)` unconditionally. No existence check. No versioning. Previous content is silently destroyed.

### Evidence
- `tool-artifact.ts:28` — unconditional `writeFileSync`, no `existsSync` check
- No `renameSync` or backup logic exists anywhere in the file
- Test confirms: after two saves, only `spec.md` exists — no `spec.v1.md`

### Reproducibility
Always — every overwrite destroys the previous version.

---

## Bug 3 (#061): jj Mismatch Dialog Frozen — ALREADY FIXED

### Finding
This bug was already fixed. The current `hooks.ts` code:
1. Uses `startsWith` comparison (not strict `!==`) for change ID matching — fixes false mismatches from short vs full IDs
2. Auto-updates the stored change ID and sends a notification instead of showing a frozen `ctx.ui.select()` dialog

### Evidence
- `hooks.ts:42` — `!currentId.startsWith(currentState.jjChangeId) && !currentState.jjChangeId.startsWith(currentId)`
- `hooks.ts:44` — `writeState(ctx.cwd, { ...currentState, jjChangeId: currentId })` (auto-update)
- `hooks.ts:45-47` — `ctx.ui.notify(...)` instead of `ctx.ui.select()`
- Comment on line 43: `"select dialog is broken during session_start — see #061"`

### Recommendation
Mark #061 as done/closed. The regression test in `tests/084-reproduce.test.ts` guards against reintroduction.

---

## Environment
- Bun 1.3.9
- macOS
- pi-megapowers extension (post #071 generalized state machine refactor)

## Failing Test
`tests/084-reproduce.test.ts` — 5 tests documenting all three bugs:
- 2 tests for #069 (backward transitions unreachable)
- 2 tests for #041 (artifact overwrite, no versioning)
- 1 regression test for #061 (already fixed)

All tests PASS currently — they document the buggy behavior. When bugs are fixed:
- #069 tests will need updating to verify backward transitions work
- #041 tests will need updating to verify versioned backups are created

## Reproducibility
- #069: Always (structural — code path doesn't exist)
- #041: Always (no conditional logic, always overwrites)
- #061: N/A (already fixed)
