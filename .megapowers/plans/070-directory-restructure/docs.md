# Feature: Directory Restructure (#070)

## Summary

Reorganised the flat `extensions/megapowers/` directory (29 source files, 870-line `index.ts`) into four concern-based subdirectories and slimmed `index.ts` to 108 lines of pure wiring. This is a zero-behavior-change refactor — all 574 passing tests continue to pass with only import paths updated.

## Design Decisions

**Subdirectory grouping by concern.** Files were split into four groups: `state/` (data model and persistence), `policy/` (enforcement logic), `tools/` (LLM-facing tool implementations), and `subagent/` (subagent orchestration). Files that don't cleanly fit a group — `ui.ts`, `prompts.ts`, `jj.ts`, `satellite.ts`, etc. — stay in the root. No barrel re-exports were added; every consumer imports directly from the file where the symbol lives.

**`ensureDeps` factory, not module-level singletons.** The old `index.ts` used nullable module-level `let store; let jj; let ui;` variables with lazy-init guards scattered across every command handler. Extraction to `commands.ts` introduced a typed `RuntimeDeps` bag (`{ store?, jj?, ui? }`) and a single `ensureDeps(rd, pi, cwd)` factory that mutates it in place. All hooks and commands call `ensureDeps` and receive guaranteed-non-null `Deps`, eliminating every guard.

**`register-tools.ts` as a pragmatic extra extraction.** The spec listed `commands.ts` and `hooks.ts` as extractions but noted the subagent spawn closure (~150 lines) was out-of-scope to redesign. After extracting commands and hooks, the remaining tool registration blocks alone exceeded the 150-line index.ts budget, so they were relocated verbatim into `register-tools.ts` via `registerTools(pi, runtimeDeps)`. No logic was changed — it's the same spawn IIFE in a different file.

**`setupSatellite()` made explicit.** The satellite early-return block was previously an anonymous inline in the main `megapowers()` function. It's now `setupSatellite(pi)` in `satellite.ts`, making the top of `index.ts` read as a clear two-path decision: satellite mode → delegate and return; primary mode → wire everything up.

**Tests stay flat.** All 30 test files remain in `tests/` with no subdirectory reorganisation. Only import paths were updated to match the new file locations.

## API / Interface

No public API changes. Every symbol previously importable from a flat-root module remains importable from its new location:

| Old path | New path |
|---|---|
| `extensions/megapowers/state-machine.js` | `extensions/megapowers/state/state-machine.js` |
| `extensions/megapowers/state-io.js` | `extensions/megapowers/state/state-io.js` |
| `extensions/megapowers/store.js` | `extensions/megapowers/state/store.js` |
| `extensions/megapowers/derived.js` | `extensions/megapowers/state/derived.js` |
| `extensions/megapowers/write-policy.js` | `extensions/megapowers/policy/write-policy.js` |
| `extensions/megapowers/gates.js` | `extensions/megapowers/policy/gates.js` |
| `extensions/megapowers/phase-advance.js` | `extensions/megapowers/policy/phase-advance.js` |
| `extensions/megapowers/tool-signal.js` | `extensions/megapowers/tools/tool-signal.js` |
| `extensions/megapowers/tool-artifact.js` | `extensions/megapowers/tools/tool-artifact.js` |
| `extensions/megapowers/tool-overrides.js` | `extensions/megapowers/tools/tool-overrides.js` |
| `extensions/megapowers/tools.js` | `extensions/megapowers/tools/tools.js` |
| `extensions/megapowers/subagent-*.js` (9 files) | `extensions/megapowers/subagent/subagent-*.js` |

New exports added (all extracted from `index.ts` — no new logic):
- `commands.ts` — `handleMegaCommand`, `handleIssueCommand`, `handleTriageCommand`, `handlePhaseCommand`, `handleDoneCommand`, `handleLearnCommand`, `handleTddCommand`, `handleTaskCommand`, `handleReviewCommand`, `ensureDeps`, `RuntimeDeps`, `Deps`
- `hooks.ts` — `onSessionStart`, `onBeforeAgentStart`, `onToolCall`, `onToolResult`, `onAgentEnd`
- `register-tools.ts` — `registerTools`
- `satellite.ts` — `setupSatellite` (added to existing file)

## Testing

No new tests were written — this is a pure refactor. The existing 577-test suite was used as a correctness oracle at each of the 7 implementation steps, with `bun test` run after every file-move task. Import paths in all 30 test files were updated to match new file locations.

Three source-code-inspection tests in `satellite-root.test.ts` and `index-integration.test.ts` were redirected to check the new files where the code now lives (`commands.ts`, `hooks.ts`, `register-tools.ts`) rather than `index.ts`.

Notable: `subagent-agents.ts` path-resolution logic (`BUILTIN_AGENTS_DIR = join(thisDir, "..", "..", "..", "agents")`) was correctly updated from 2 to 3 levels up after the file moved one directory deeper into `subagent/`. This is covered by the existing `subagent-agents.test.ts` integration tests.

## Files Changed

**New files (extracted from index.ts):**
- `extensions/megapowers/commands.ts` — 9 slash command handlers + `ensureDeps`/`RuntimeDeps`/`Deps` types
- `extensions/megapowers/hooks.ts` — 5 event hook handlers (`session_start`, `before_agent_start`, `tool_call`, `tool_result`, `agent_end`)
- `extensions/megapowers/register-tools.ts` — 5 `pi.registerTool()` registrations including the subagent spawn closure

**Modified (import paths updated, logic unchanged):**
- `extensions/megapowers/index.ts` — 870 → 108 lines; now pure wiring only
- `extensions/megapowers/satellite.ts` — added `setupSatellite()` export
- `extensions/megapowers/ui.ts`, `prompt-inject.ts`, `prompts.ts`, `plan-parser.ts`, `spec-parser.ts` — import paths updated

**Moved to `state/` (4 files):** `state-machine.ts`, `state-io.ts`, `store.ts`, `derived.ts`

**Moved to `policy/` (3 files):** `write-policy.ts`, `gates.ts`, `phase-advance.ts`

**Moved to `tools/` (4 files):** `tool-signal.ts`, `tool-artifact.ts`, `tool-overrides.ts`, `tools.ts`

**Moved to `subagent/` (9 files):** `subagent-agents.ts`, `subagent-async.ts`, `subagent-context.ts`, `subagent-errors.ts`, `subagent-runner.ts`, `subagent-status.ts`, `subagent-tools.ts`, `subagent-validate.ts`, `subagent-workspace.ts`

**Test files (30, import paths only):** all test files in `tests/` updated to new import paths; 3 source-code-inspection tests redirected to the correct new files
