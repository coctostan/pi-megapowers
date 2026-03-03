# Feature: Agent Context & Awareness (#050)

## Summary

When no issue is active but megapowers is enabled, the agent previously had zero awareness of the extension — `buildInjectedPrompt()` returned null and the dashboard showed only bare minimal hints. This feature adds a full idle-mode prompt injection (protocol summary, open issues, slash commands, roadmap reference), enhances the idle dashboard widget with matching hint lines, implements the `phase_back` signal action for backward workflow transitions, and corrects stale `/phase` command references across five prompt templates.

## Design Decisions

**Idle prompt as `buildIdlePrompt` helper, not a template file.** The idle state is dynamic (open issues list varies at runtime), so a static `.md` template isn't suitable. The content is composed in code using `parts.push()` — protocol first, then open issues from the store, then commands, then roadmap reference. This mirrors the parts-composition pattern already used in the active-issue path.

**`phase_back` implemented as a real runtime action, not just documentation.** The `megapowers_signal` tool schema was extended with `Type.Literal("phase_back")` and a `handlePhaseBack()` function that looks up the backward target from a static map (`review→plan`, `verify→implement`, `code-review→implement`). It delegates to the existing `handlePhaseNext(cwd, jj, target)` with an explicit target, reusing all existing gate/transition logic.

**Idle dashboard hints are plain text, not interactive.** Per spec, no new UI components are introduced — the idle dashboard is plain `lines.push()` additions consistent with how the existing command hints were already rendered. Interactive dashboard elements are deferred to future work.

**`milestone` and `priority` stored in issue frontmatter.** The `Issue` interface was extended with `milestone: string` and `priority: number` fields parsed from frontmatter. Both default to empty/zero on existing issues and on `createIssue()`. No migration needed — old issues without these fields parse cleanly with defaults.

## API / Interface

### `buildInjectedPrompt(cwd, store?)` — idle mode
Previously returned `null` when no active issue. Now returns non-null content when `state.megaEnabled` is true and `state.activeIssue` is null. Content includes:
- Full `megapowers-protocol.md` protocol section
- `## Open Issues` list: each open issue formatted as `- #NNN title (milestone: ..., priority: N)`
- `## Available Commands`: `/issue new`, `/issue list`, `/triage`, `/mega on|off`
- Roadmap reference: `See ROADMAP.md and .megapowers/milestones.md for what's next.`

Returns `null` when `state.megaEnabled` is false (unchanged).

### `renderDashboardLines(state, issues, theme, tasks?)` — idle mode additions
New lines added to the no-active-issue branch:
- `/triage     — batch and prioritize issues`
- `/mega on|off — enable/disable workflow enforcement`
- `See ROADMAP.md and .megapowers/milestones.md for what's next.` (dim)

### `megapowers_signal({ action: "phase_back" })`
New signal action added to both the tool schema and runtime handler. Moves backward:
- `review` → `plan`
- `verify` → `implement`
- `code-review` → `implement`

Returns an error if called from any other phase.

### `Issue` interface
Two new fields: `milestone: string` (default `""`) and `priority: number` (default `0`). Parsed from frontmatter keys `milestone` and `priority`.

### Prompt templates updated
- `prompts/megapowers-protocol.md` — Added `phase_back` to `megapowers_signal` action list; added `learnings` to valid artifact phases.
- `prompts/review-plan.md` — Fixed duplicate `### 5.` → `### 6. Self-Containment`; "After Review" now shows `megapowers_signal({ action: "phase_back" })` for the revision path.
- `prompts/implement-task.md` — "Execution Mode" section tightened: same information, less prose.
- `prompts/verify.md` — Replaced stale `/phase implement`/`/phase plan` with `megapowers_signal({ action: "phase_back" })`.
- `prompts/code-review.md` — "needs-rework" section now instructs `megapowers_signal({ action: "phase_back" })` instead of `/phase implement`/`/phase plan`.

## Testing

12 tasks implemented with TDD; 4 tasks marked `[no-test]` (prompt-template text changes) with grep-based verification steps.

Notable test cases:
- `buildInjectedPrompt — idle mode` (5 tests): AC1–AC6 — null/non-null behavior, protocol inclusion, issue list with milestone/priority, slash commands, roadmap reference.
- `renderDashboardLines — idle mode command hints` (3 tests): AC7, AC8 — `/triage`, `/mega on|off`, and ROADMAP/milestones line.
- Active-issue regression guard: confirms idle hints do not appear in the active-issue dashboard path.
- `phase_back` (4 tests in `tool-signal.test.ts`): all three valid backward transitions + error on unsupported phase.
- `store.test.ts`: `milestone` and `priority` parsing from frontmatter; defaults for bare issues.

Final test suite: **680 pass, 0 fail** across 34 files.

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/prompt-inject.ts` | Added `buildIdlePrompt()` helper; updated `buildInjectedPrompt()` to call it when idle |
| `extensions/megapowers/ui.ts` | Added `/triage`, `/mega on|off`, and ROADMAP/milestones hint lines to idle dashboard |
| `extensions/megapowers/state/store.ts` | Extended `Issue` with `milestone` and `priority`; parsing and defaults in `listIssues`, `getIssue`, `createIssue` |
| `extensions/megapowers/tools/tool-signal.ts` | Added `handlePhaseBack()` function and `phase_back` case to `handleSignal()` switch |
| `extensions/megapowers/register-tools.ts` | Added `Type.Literal("phase_back")` to tool schema action union |
| `prompts/megapowers-protocol.md` | Added `phase_back` action; added `learnings` to valid artifact phases |
| `prompts/review-plan.md` | Fixed duplicate `### 5.` numbering; added `phase_back` signal to After Review revision path |
| `prompts/implement-task.md` | Tightened "Execution Mode" section verbosity |
| `prompts/verify.md` | Replaced `/phase` commands with `megapowers_signal({ action: "phase_back" })` |
| `prompts/code-review.md` | Replaced `/phase` commands with `megapowers_signal({ action: "phase_back" })` in needs-rework section |
| `tests/prompt-inject.test.ts` | Added idle-mode AC1–AC6 test suite |
| `tests/ui.test.ts` | Added AC7, AC8 idle dashboard tests; added `phase_back` schema test |
| `tests/store.test.ts` | Added milestone/priority parsing and default tests |
| `tests/tool-signal.test.ts` | Added `phase_back` backward transition tests (3 valid + 1 error case) |
