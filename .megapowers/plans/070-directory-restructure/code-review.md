## Files Reviewed

- `extensions/megapowers/index.ts` — 108 lines of thin wiring: satellite check, hook/tool/command registration
- `extensions/megapowers/commands.ts` — 9 command handlers + RuntimeDeps/Deps types + ensureDeps factory (205 lines)
- `extensions/megapowers/hooks.ts` — 5 event hook handlers (160 lines)
- `extensions/megapowers/register-tools.ts` — 5 tool registrations including subagent spawn closure (332 lines)
- `extensions/megapowers/satellite.ts` — isSatelliteMode, resolveProjectRoot, setupSatellite (141 lines)
- `extensions/megapowers/state/` — derived.ts, state-io.ts, state-machine.ts, store.ts (moved, import paths updated)
- `extensions/megapowers/policy/` — write-policy.ts, gates.ts, phase-advance.ts (moved, import paths updated)
- `extensions/megapowers/tools/` — tool-signal.ts, tool-artifact.ts, tool-overrides.ts, tools.ts (moved, import paths updated)
- `extensions/megapowers/subagent/` — 9 subagent-*.ts files (moved, import paths updated)
- `tests/` — 35 test files with updated import paths; 3 source-code-inspection tests redirected to new file locations

## Strengths

- **index.ts:1–108** — Exceptional reduction from 870 → 108 lines. The result is genuinely easy to scan: one satellite branch, one deps object, five hook registrations, one tool registration call, nine command registrations. No logic, just wiring.
- **subagent-agents.ts:7** — `BUILTIN_AGENTS_DIR` correctly updated to `join(thisDir, "..", "..", "..", "agents")` — 3 levels up from the new `subagent/` subdirectory (was 2 levels). Correct and tested.
- **commands.ts:19–26** — `ensureDeps` pattern cleanly centralises instance creation, mutating a shared `RuntimeDeps` bag so all hooks and commands share the same store/jj/ui without any module-level singletons.
- **hooks.ts:1–160** — Clean extraction; all pre-existing logic preserved faithfully including the `ctx.ui.input` pattern in the non-interactive learn path (pre-existing, not introduced here).
- **register-tools.ts** — Pragmatic extra extraction not in the spec: the subagent spawn closure is 150+ lines of pi-dependent orchestration that would have blown the index.ts line limit. Moving it to `register-tools.ts` satisfies AC10 while keeping the code intact and well-grouped.
- **Test updates** — Source-code-inspection tests correctly redirected from `index.ts` to `commands.ts`, `hooks.ts`, and `register-tools.ts` respectively. Regex in satellite-root.test.ts:42 correctly widened to accommodate the typed `(t: string) =>` parameter form.
- **Pre-existing failures preserved** — 3 prompt-template test failures are unchanged from pre-refactor, confirming zero behavior change.

## Findings

### Critical
None.

### Important
None.

### Minor

1. **Stale file-path comments** — 7 moved files had first-line comments that still referenced the old flat paths, missing the subdirectory prefix. Fixed in this session:
   - `state/derived.ts:1` — was `// extensions/megapowers/derived.ts`
   - `state/state-io.ts:1` — was `// extensions/megapowers/state-io.ts`
   - `policy/phase-advance.ts:1` — was `// extensions/megapowers/phase-advance.ts`
   - `policy/write-policy.ts:1` — was `// extensions/megapowers/write-policy.ts`
   - `tools/tool-artifact.ts:1` — was `// extensions/megapowers/tool-artifact.ts`
   - `tools/tool-overrides.ts:1` — was `// extensions/megapowers/tool-overrides.ts`
   - `tools/tool-signal.ts:1` — was `// extensions/megapowers/tool-signal.ts`

2. **Stale test description** — `tests/satellite-root.test.ts:48` said "index.ts registers subagent and subagent_status tools" but the test body checks `register-tools.ts`. Fixed in this session to "register-tools.ts registers subagent and subagent_status tools".

## Fixes Applied

All 8 minor findings fixed in this session. Test suite re-run: 574 pass / 3 pre-existing failures — no regressions.

## Recommendations

- **Note for later**: `state-machine.ts` has no file-path comment at line 1 (the other 3 state/ files do). Not worth a separate fix, but worth noting for consistency if a future pass cleans file headers.
- **gates.ts also lacks a file-path comment** — same note.

## Assessment

**ready**

This is a clean, correct, well-scoped refactor. The directory structure matches the spec exactly. index.ts went from 870 lines to 108 lines of pure wiring. All 13 acceptance criteria met. No logic was changed — only file locations and import paths. The only findings were 8 cosmetic issues (stale file-path comments and one stale test description), all fixed in this session with tests confirming no regressions.
