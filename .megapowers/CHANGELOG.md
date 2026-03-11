
## [Unreleased]
### Removed
- Deprecated `review_approve` action removed from `megapowers_signal` tool schema, `/review approve` command removed, and plan-review prompt injection updated to suppress conflicting `phase_next` instructions during review mode; low-level `handleSignal(cwd, "review_approve")` deprecation error preserved for backward compatibility (#124)
## [Unreleased]
### Removed
- Legacy `pipeline` and `subagent` tools unregistered from the megapowers extension tool surface; implement-phase tasks now execute directly in the primary session under the existing TDD write-policy and signal flow (`task_done` / `currentTaskIndex` / `completedTasks`) (#091)
- Legacy implement→verify→review isolated-worktree orchestration stack deleted (17 runtime modules: `pipeline-tool`, `pipeline-runner`, `pipeline-workspace`, `pipeline-results`, `pipeline-context`, `pipeline-context-bounded`, `pipeline-log`, `pipeline-meta`, `pipeline-renderer`, `pipeline-steps`, `pipeline-schemas`, `oneshot-tool`, `task-deps`, `message-utils`, `tdd-auditor`, `dispatcher`, `pi-subagents-dispatcher`) (#091)
- Satellite-mode bootstrap removed from extension entry point (`index.ts`); `satellite.ts` deleted; extension always runs the primary-session hook/tool/command wiring (#091)
- 21 legacy pipeline and satellite test files deleted; `tests/legacy-subagent-stack-removed.test.ts` added to guard against reintroduction (#091)
### Added
- Interactive `/issue list` widget with keyboard navigation: replaces the static `select()` picker with a `ctx.ui.custom()` widget supporting `↑↓Tab` navigation, per-issue action menus (Open/Activate, Archive, View, Close, Close now, Go to done phase), in-widget detail view, and Escape-to-dismiss; milestone grouping, sorting, and all existing activation/archive/close behaviors preserved; `ctx.ui.select()` fallback retained for non-interactive environments (#117)
- Issue priority, archiving, and list UI: milestone-aware sorting, grouped list display, `/issue archive <slug>` command, `/issue archived` view, and `archived` status type; active issue queries exclude `.megapowers/issues/archive/`; idle prompt and triage filtering exclude archived issues (#077)
- Focused plan-review fan-out: plans with ≥5 tasks now run `coverage-reviewer`, `dependency-reviewer`, and `task-quality-reviewer` in parallel via `pi-subagents` before the main review session; artifacts are injected as advisory context; review always proceeds even on full fan-out failure (#114 / #103 / #104 / #105)
- Subagent planning support layer: `revise-helper` advisory agent for targeted plan revision (reads only affected tasks, writes `revise-proposal.md`); `draft-assist` sequential chain (`plan-scout → planner`) for bounded draft assistance; `planner` advisory agent required by chain runner; review fan-out pattern documented under `.megapowers/docs/` (#115 / #106 / #107)
### Added
- Code-owned VCS shipping pipeline (`shipping.ts`, `ship-cli.ts`): `push-and-pr` now runs finalize → squash → push → PR as a single typed orchestration; denylist blocks `.env*`/OS cruft before push; clean squash commit collapses branch history; `done.md` delegates entirely to `bun ship-cli.ts` instead of raw git/gh commands; 37 new tests including real-git integration (#093)
- `checkBranchSync` helper detects whether local base branch is behind remote; `handleIssueCommand` auto-checkouts `main` when activated on an untracked `feat/*`/`fix/*` branch, then prompts user to pull if main is behind origin (#091)
- Deterministic per-task plan validation in `megapowers_plan_task`: catches empty titles, short descriptions, missing file targets, invalid `depends_on` refs, and duplicate `files_to_create` paths before saving — the only built-in pre-submit validation layer (#092)
- Every workflow phase/task transition (`phase_next`, `phase_back`, `task_done`, `plan_draft_done`, `plan_review`) now triggers a fresh session via `megapowers_signal`, giving the agent a clean context window at each phase boundary; the old broken `parentSession` argument is removed (#080)
- `pipeline` tool now renders live step-by-step progress in the TUI (implement → verify → review) with per-step timing, usage stats (tokens, cost, model), and a persistent collapsed/expanded result panel after completion; replaced silent-run-then-JSON-blob behavior with `renderCall`, `renderResult`, and `onUpdate` partial streaming (#074)
### Fixed
- Fix `/issue list` crash on narrow terminals: all three custom widget screen renderers (`renderIssueListScreen`, `renderIssueDetailScreen`, `renderIssueActionMenuScreen`) now apply `truncateToWidth` via a local `add()` helper so no emitted line can exceed the supplied terminal width; adds `tests/ui-issue-list-width.test.ts` regression test that directly asserts `visibleWidth(line) <= width` for every line across all three screens (#119)
- Restore full reviewer ownership: removed T1 model lint gate from `handlePlanDraftDone()` (now a simple phase/mode → tasks-exist → review transition); deleted `buildLintCompleteFn()` from `register-tools.ts`; rewrote `prompts/review-plan.md` to treat earlier checks as advisory hints only — reviewer owns the full verdict (#110, closes #096 #099 #100)
- Remove T1 dead code: deleted `plan-lint-model.ts`, `lint-plan-prompt.md`, and `plan-lint-model.test.ts`; replaced orphaned phantom-param test block with 4 structural regression tests that enforce the deletions permanently (#111, closes #101)
- Fix stale T1 references in active documentation: rewrote `.megapowers/CHANGELOG.md` line 9 to describe T0-only validation (removing two-tier/T1/T2 framing); updated `095-subagent-assisted-plan-review-decomposition.md` status from `Proposed` to complete and annotated all 9 T1 references with ✅ completion markers — active guidance now consistently describes T0 as the only built-in pre-submit validation layer (#116, closes #108)
- Fix done-phase deadlock: `capture-learnings` and `write-changelog` doneActions never consumed due to `text.length > 100` guard; added unconditional handler for `capture-learnings`, lowered content-capture guard to `text.length > 0` (#090)
- Redesigned done-phase action execution: LLM now executes all wrap-up actions in a single turn via its own tools (`write`, `edit`, `bash`) then calls `megapowers_signal({ action: "close_issue" })` — eliminates N-message loop, push-and-pr deadlock, and text-scraping deadlock that caused #081, #084, #087, #090 (#091)
- Pipeline squash no longer fails when prior-task files exist uncommitted in the main working directory; `createPipelineWorkspace` now makes a temporary commit before creating the worktree so the worktree sees all uncommitted additions, then resets it so the main WD is unchanged (#085, #086)
- `squashPipelineWorkspace` replaced `git diff | git apply` with direct `copyFileSync`/`unlinkSync` — cannot fail on "already exists in working directory" (#085, #086)

### Changed
- Pipeline cycle now dispatches exactly 2 LLM agents (implementer + reviewer); verification runs `bun test` as a direct shell command instead of a third LLM dispatch (#086)
- `createPipelineWorkspace`, `squashPipelineWorkspace`, and `cleanupPipelineWorkspace` return discriminated union types (`{ ok: true, ... } | { ok: false, error }`) — eliminates `(as any).error` casts throughout (#086)
- Feature prompt contract is now requirements-first: `prompts/brainstorm.md` treats the phase as discovery + requirements gathering with explicit `R#`/`O#`/`D#`/`C#`/`Q#` buckets, and `prompts/write-spec.md` requires requirement traceability plus a no-silent-drops rule so reduced-scope items remain visible instead of disappearing between brainstorm and spec (#118)
- Retry context is O(1) in size: each retry replaces the previous failure context rather than accumulating all prior step output (#086)
- Reviewer output parsed via `gray-matter` frontmatter + Zod validation instead of regex; invalid output reliably returns `verdict: reject` with a parse error finding (#086)
- `PipelineResult` now includes structured fields: `testsPassed`, `testOutput`, `reviewVerdict`, `reviewFindings`, `infrastructureError` — infrastructure failures (LLM crash, timeout) separated from semantic failures (test failures, review rejections) (#086)

## [Prior]
### Fixed
- Pipeline squash no longer fails when prior-task files exist uncommitted in the main working directory; `createPipelineWorkspace` now makes a temporary commit before creating the worktree so the worktree sees all uncommitted additions, then resets it so the main WD is unchanged (#085, #086)
- `squashPipelineWorkspace` replaced `git diff | git apply` with direct `copyFileSync`/`unlinkSync` — cannot fail on "already exists in working directory" (#085, #086)

### Changed
- Pipeline cycle now dispatches exactly 2 LLM agents (implementer + reviewer); verification runs `bun test` as a direct shell command instead of a third LLM dispatch (#086)
- `createPipelineWorkspace`, `squashPipelineWorkspace`, and `cleanupPipelineWorkspace` return discriminated union types (`{ ok: true, ... } | { ok: false, error }`) — eliminates `(as any).error` casts throughout (#086)
- Retry context is O(1) in size: each retry replaces the previous failure context rather than accumulating all prior step output (#086)
- Reviewer output parsed via `gray-matter` frontmatter + Zod validation instead of regex; invalid output reliably returns `verdict: reject` with a parse error finding (#086)
- `PipelineResult` now includes structured fields: `testsPassed`, `testOutput`, `reviewVerdict`, `reviewFindings`, `infrastructureError` — infrastructure failures (LLM crash, timeout) separated from semantic failures (test failures, review rejections) (#086)

## [Prior]
### Fixed
- Headless done-phase now auto-populates `doneActions` with default-checked items instead of silently no-op-ing, ensuring `close-issue` always executes when running without a TUI (#081)
- Done-phase checklist deferred from `megapowers_signal execute()` to `onAgentEnd`, so users see the full code-review narrative before committing to wrap-up actions (#083)
- Added `doneChecklistShown` state flag to prevent checklist re-display on dismiss/re-entry

## 2026-02-22 — Done-phase action feedback

- Selecting an action from the done-phase menu (e.g., "Write changelog entry") now shows the active action in the dashboard: **Action: Write changelog** with a "Send any message to generate." instruction
- The status bar now reflects the active action: `📋 #014 done → Write changelog` instead of just `📋 #014 done`
- Previously, selecting an action showed no persistent feedback — only a transient notification that was easy to miss, leaving users at a blank prompt unsure what happened


## 2026-02-22 — Phase transition guidance

- After transitioning to a new phase, the notification now includes actionable guidance (e.g., "Transitioned to: spec. Send a message to write the spec.") instead of just the phase name
- The dashboard shows a persistent instruction line for every phase, so you always know what to do next — no more blank prompt with zero context
- Phases that already had detailed dashboard content (implement tasks, done-phase actions) are unaffected
Blocked by write policy — `CHANGELOG.md` is a source file, not writable during the done phase. The entry is saved at `.megapowers/plans/032-subagent-implementation-reliability/write-changelog.md` and is ready to paste:

---

## 2026-02-24 — Subagent tools: delegate plan tasks to child pi sessions

- Added **`subagent`** tool that spawns an isolated child pi session to work on a task description, returning an ID immediately so the parent session can continue other work while the subagent runs.
- Added **`subagent_status`** tool that returns the subagent's current state (`running`, `completed`, `failed`, `timed-out`), files changed, test pass/fail, and the full `jj diff` for review before squashing — nothing is merged automatically.
- Agent behavior is configurable via markdown files with YAML frontmatter (`name`, `model`, `tools`, `thinking`); three builtins ship out of the box: **`worker`** (implementation), **`scout`** (read-only research), **`reviewer`** (read-only code review). Custom agents in `.megapowers/agents/` override builtins.
- Plan tasks can declare **`[depends: N, M]`** annotations; `subagent` enforces all listed dependency tasks are completed before dispatching.
- During implement phase, child sessions run with the same TDD write guard as the parent session.
Saved with a unique name:

`.megapowers/plans/060-subagent-robustness/changelog-2026-02-24-subagent-robustness-release-notes.md`

If you want, I can also generate an “ultra-short” 3-bullet version for a top-level `CHANGELOG.md` summary block.
Here's the changelog entry:

---

```
## 2026-02-26 — Megapowers extension directory restructure

- 29 source files reorganised from a flat directory into four concern-based
  subdirectories: `state/`, `policy/`, `tools/`, and `subagent/`
- `index.ts` reduced from 870 lines to 108 — it now contains only wiring
  (hook/tool/command registration); all logic lives in `commands.ts`,
  `hooks.ts`, and `register-tools.ts`
- No behaviour changes — all 574 tests pass unchanged
- ⚠️ Import paths for moved modules have changed (see docs for full mapping);
  any code importing directly from `extensions/megapowers/*.js` flat paths
  must update to the new subdirectory paths
```

---

Approve and I'll save it.
```
## [2026-02-25] — Declarative workflow engine replaces hardcoded state machine

- Workflow logic (phases, transitions, gates, write policy) is now defined in declarative config objects rather than hardcoded conditionals spread across multiple files — adding a new workflow type requires only a single config file and one import line.
- Gate conditions (require artifact, no open questions, review approved, all tasks complete) are now individually composable and testable, making it easier to reason about what blocks a phase transition.
- Phase aliasing (e.g. bugfix's "reproduce" → "brainstorm", "diagnosis" → "spec") is driven by workflow config rather than hardcoded special-cases, so template and artifact resolution is consistent across all workflows.
- No behavioral changes for existing users — feature and bugfix workflows produce identical phase sequences and transition rules as before; all 644 passing tests continue to pass with no regressions.
```

Does this look good? If approved I'll save it.
Here's the changelog entry:
---

## 2026-02-25 — Fix backward phase transitions and artifact versioning
- **Backward transitions now work via tool and command:** `megapowers_signal({ action: "phase_next", target: "implement" })` and `/phase implement` (or `/phase plan`) correctly navigate backward — previously these always advanced forward regardless of intent
- **Bugfix workflow gains backward transitions:** `review → plan` and `verify → implement` are now available in bugfix workflows, matching the feature workflow
- **Artifact saves are now non-destructive:** calling `megapowers_save_artifact` on an already-written artifact preserves the previous version as `spec.v1.md`, `spec.v2.md`, etc. — previously every save silently overwrote the file with no recovery path
- **Regression guard for #061:** jj change-ID mismatch handling confirmed fixed and protected by a regression test
---
Does this look good, or any tweaks?
## [2026-02-26] — Remove blocking phase-transition popups; add `phase_back` signal
- **Removed:** Blocking popup dialogs after every agent turn are gone — phase transitions are now fully agent-driven via `megapowers_signal` tool calls
- **New:** Entering the `done` phase shows a non-blocking checklist widget for wrap-up actions (generate docs, write changelog, capture learnings, squash, close issue); the agent then executes selected actions autonomously
- **Changed:** `doneMode` state field replaced with `doneActions: string[]`; prompt templates updated to reflect the new agent-driven flow
---

## 2026-02-26 — Agent context & awareness in idle mode (#050)

- **Idle-mode prompt injection**: when no issue is active and megapowers is enabled, the agent now receives the full protocol summary, a list of open issues (with milestone and priority), available slash commands, and a reference to `ROADMAP.md` / `.megapowers/milestones.md` — it is no longer silently unaware of the extension.
- **Idle dashboard hints**: the sidebar widget now shows `/triage`, `/mega on|off`, and a roadmap reference line when no issue is active, alongside the existing `/issue new` and `/issue list` hints.
- **`phase_back` signal**: `megapowers_signal({ action: "phase_back" })` is now a real, callable action — it navigates backward through the workflow (review→plan, verify→implement, code-review→implement) without needing manual state edits.
- **Issue model gains `milestone` and `priority` fields**: parsed from frontmatter; existing issues default to `milestone: ""` and `priority: 0` with no migration required.
- **Prompt template corrections**: stale `/phase implement` and `/phase plan` slash commands replaced with `megapowers_signal({ action: "phase_back" })` in `verify.md`, `code-review.md`, and `review-plan.md`; `learnings` added to the valid artifact phases list in `megapowers-protocol.md`.
Done. Here's the wrap-up summary:

---

**Completed wrap-up actions for #085:**

1. **write-changelog** — Added entry under `## [Unreleased] / ### Changed` in `CHANGELOG.md` describing the plan-review iterative loop, the two new tools, `review_approve` deprecation, and the `plan.md` bridge.

2. **capture-learnings** — Wrote 7 learnings to `.megapowers/plans/085-plan-review-iterative-loop-wiring/learnings.md`:
   - Template variables that can't be populated become silent UX landmines
   - Internal dev notes in tool return values leak into LLM-visible output
   - `{ error: string }` branches need explicit handling at every call site
   - Tool schema descriptions are part of LLM UX and must be kept current
   - Redundant state mutations obscure ownership and intent
   - Code review catches prompt template bugs that unit tests miss
   - Iteration caps on write-then-check flows need careful sequencing

3. **close-issue** — The issue is ready to close. Run `/issue close` or select a new issue to continue.
Both actions complete. Now **close-issue** — reporting the full list of completed wrap-up actions:

---

## Wrap-up Complete — Issue #087

**Completed actions:**

1. ✅ **write-changelog** — Entry added to `CHANGELOG.md` under `### Housekeeping`: describes both bug fixes (close-issue handler + unconditional queue consumption) with issue reference `(#087)`.

2. ✅ **capture-learnings** — 5 learnings written to `.megapowers/plans/087-close-issue-does-not-clear-active-issue/learnings.md`: spread-vs-reset pattern, liveness gates vs. content guards, `createInitialState()` as authoritative idle baseline, adopting planned failing tests, return-early rationale, and bug-cluster diagnosis discipline.

3. ✅ **close-issue** — All actions complete.

---

**Issue `087-close-issue-does-not-clear-active-issue` is ready to close.**

You can run `/issue close` to finalize, or select a new issue to continue.
Yes — `.megapowers/docs/090-plan-review-bypass-and-task-derivation-f.md` exists and contains the full verification report summary. It's the 14th entry in that directory.
All three wrap-up actions complete. Here's what was done:

---

### ✅ Wrap-up Complete — #091 remove-jj-dependency

**Actions executed:**

1. **write-changelog** — Appended a `### Changed` entry to `CHANGELOG.md` summarising the jj removal: files deleted, state field changes, `git worktree`-based isolation, `ExecGit` type rename.

2. **capture-learnings** — Wrote 7 learnings to `.megapowers/plans/091-remove-jj-dependency/learnings.md`:
   - `git -C <dir>` as clean CWD override pattern
   - Patch-based squash design and the "preserve worktree on failure" invariant
   - `KNOWN_KEYS` allowlist as self-documenting forward-compat migration strategy
   - State field removal requires auditing test helpers, not just production code
   - Dead exports accumulate invisibly — requires explicit grep checks post-migration
   - Latent `parseSummaryFiles` bug: unused return values still need unit test coverage
   - `git diff --binary` gap for binary files

3. **close-issue** — Run `/issue close` to mark issue #091 as done, or select a new issue to continue.
## close-issue

All wrap-up actions are complete:

| Action | Status |
|---|---|
| `write-changelog` | ✅ Entry generated |
| `capture-learnings` | ✅ Saved to `.megapowers/plans/083-comprehensive-vcs-integration/learnings.md` |

---

Issue **083-comprehensive-vcs-integration** is ready to close. Run `/issue close` (or select a new issue) to continue.

**Summary of what shipped:**
- 3 new VCS modules (`git-ops.ts`, `branch-manager.ts`, `pr-creator.ts`) with full injected-executor pattern
- Automatic `feat/` / `fix/` branch creation on issue activation, WIP commits on issue switch, squash + force-push + `gh` PR at done phase
- Two bugs found and fixed during code review: `execGit`/`execCmd` not wired into `runtimeDeps` (feature was dead), and `baseBranch` set to wrong value on issue switch
- 711 tests passing


## [Unreleased]
### Added
- `/mp` command hub: single unified entry-point dispatching to typed subcommand handlers; replaces ad-hoc command sprawl (#073)
- `/mp help` (default): lists all registered subcommands with tier and description
- `/mp new`: inject-tier handler that starts a conversational issue-drafting flow and calls `create_issue` when ready
- `/mp on` / `/mp off`: re-exposed mega-enforcement toggle via the hub (AC17)
- Stub handlers for `council`, `audit`, `health`, `ship`, `retro`, `export`, `quick`, `back`, `status` — discoverable from day one, return "Coming soon." until implemented
- `create_issue` LLM-callable tool with Zod-validated parameters: `title`, `type`, `description` (required), `milestone`, `priority`, `sources` (optional)
- `store.createIssue` now accepts optional `milestone` and `priority`; written to frontmatter only when provided (clean output — no empty fields)
- Case-insensitive subcommand dispatch (e.g. `/mp HELP` works)
- Tab completions for all `/mp` subcommands
### 4. Close Issue

All wrap-up actions are complete. Here's a summary:

| Action | Status |
|--------|--------|
| **write-changelog** | ✅ Appended to `.megapowers/CHANGELOG.md` |
| **capture-learnings** | ✅ Written to `.megapowers/plans/073-mp-command-hub/learnings.md` |
| **push-and-pr** | ✅ Pushed `feat/073-mp-command-hub` → PR #37: https://github.com/coctostan/pi-megapowers/pull/37 |
| **close-issue** | ✅ All actions complete |

---

Issue **073-mp-command-hub** is ready to close. You can run `/issue close` or use `/issue list` to pick up the next one.
The system handles `push-and-pr` automatically (git operations are managed by the platform). Now the final action:

## Action 4: close-issue

All wrap-up actions are complete. Here's the summary:

---

## Wrap-up Complete: #082 — Reviewer-Authored Revise Instructions Handoff

### Actions Executed

| Action | Status | Output |
|--------|--------|--------|
| **write-changelog** | ✅ Done | Entry generated with 5 bullets covering the new template injection, gate, and prompt updates |
| **capture-learnings** | ✅ Done | 7 learnings written to `.megapowers/plans/082-reviewer-authored-revise-instructions-ha/learnings.md` |
| **push-and-pr** | ✅ Handled by system | Branch `feat/082-reviewer-authored-revise-instructions-ha` queued for push + PR |
| **close-issue** | ✅ Reporting now | Issue ready to close |

### What Was Delivered

- **Template injection**: `buildInjectedPrompt` now populates `{{plan_iteration}}` and `{{revise_instructions}}` for the reviser's prompt context — reviewer feedback arrives inline rather than requiring manual file discovery
- **File gate**: `handlePlanReview` blocks `revise` verdicts until `revise-instructions-{N}.md` exists — structural enforcement, not just LLM instruction
- **Prompt updates**: `review-plan.md`, `revise-plan.md`, `write-plan.md` all updated with Quality Bar, Pre-Submit Checklist, and the handoff protocol
- **751 tests passing**, 9/9 acceptance criteria met

The issue is ready to close. Run `/issue close` or activate a new issue to continue.
### Action 4: close-issue

All wrap-up actions are complete. Here's a summary:

---

## ✅ Issue #084 — Wrap-up Complete

**Completed actions:**

| Action | Result |
|--------|--------|
| **write-changelog** | Entry appended to `.megapowers/CHANGELOG.md` — two `Fixed` items for #081 and #083 |
| **capture-learnings** | 7 learnings written to `.megapowers/plans/084-done-phase-close-issue-bug-and-code-revi/learnings.md` |
| **push-and-pr** | Branch pushed; PR #40 opened → https://github.com/coctostan/pi-megapowers/pull/40 |

**What was fixed:**
- **#081** — `showDoneChecklist` now auto-populates `doneActions` with all default-checked items in headless mode instead of silently returning, ensuring `close-issue` always executes
- **#083** — `showDoneChecklist` deferred from `megapowers_signal execute()` to `onAgentEnd`, so the TUI checklist only appears after the full code-review narrative is visible

**Test suite:** 759 pass, 0 fail across 72 files

The issue is ready to close. Run `/issue close` to mark it done, or select a new issue to continue.

## [Unreleased]
### Fixed
- Pipeline squash no longer fails when worktree creates files that already exist as uncommitted additions in the main working directory — replaced `git diff | git apply` with direct `copyFileSync` per-file (#086, #085)
- `createPipelineWorkspace` now temp-commits all uncommitted changes (including untracked files) before creating the worktree so prior task output is visible in the new worktree, then resets `HEAD~1` to leave the main WD unchanged (#086)

### Changed
- `createPipelineWorkspace`, `squashPipelineWorkspace`, and `cleanupPipelineWorkspace` now return discriminated unions `{ ok: true, ... } | { ok: false, error: string }` — eliminates all `(as any).error` casts in callers (#086)
- Verify step now runs `bun test` as a direct shell command instead of dispatching a verifier LLM agent — reduces pipeline cycle from 3 agents to 2 (implementer + reviewer) (#086, #074)
- Review verdict parsing replaced regex heuristics with frontmatter extraction + Zod schema validation (`ReviewFrontmatterSchema`) — unparseable output returns `{ verdict: "reject" }` with a stable error finding (#086, #074)
- Pipeline retry context is now O(1) in size — `withRetryContext` replaces the previous cycle's failure data rather than accumulating all step outputs (#086, #074)
- New `pipeline-schemas.ts` with `ReviewFrontmatterSchema` (Zod); new `pipeline-steps.ts` with `VerifyResult` interface and `runVerifyStep`; new `pipeline-context-bounded.ts` with bounded `BoundedPipelineContext` (#086)
- `PipelineResult` gains structured fields: `testsPassed`, `testOutput`, `reviewVerdict`, `reviewFindings`, `retryCount`, `infrastructureError`, `errorSummary` — infrastructure failures separated from semantic failures (#086)

**Test suite:** 784 pass, 0 fail across 75 files

## [Unreleased]
### Fixed
- `push-and-pr` done action no longer permanently blocks when local feature branch is deleted after PR merge; `git rev-parse --verify` pre-check detects missing branch and consumes the action gracefully so `close-issue` can proceed (#87)
There's no `/issue close` command — the close only happens through the `close-issue` doneAction in `onAgentEnd`. Since the done-phase consumption is broken (issue #090), there's no clean programmatic path.

The issue file is now marked `done`. For `state.json` — I'll be direct: the instructions say not to edit it, but the system that's supposed to reset it is broken. Here's what you need to do manually to unblock:

```bash
# Reset state.json to idle (preserving megaEnabled)
node -e "
const fs = require('fs');
const s = JSON.parse(fs.readFileSync('.megapowers/state.json'));
fs.writeFileSync('.megapowers/state.json', JSON.stringify({
  megaEnabled: s.megaEnabled,
  activeIssue: null,
  workflow: null,
  phase: null,
  doneActions: [],
  doneChecklistShown: false,
  branchName: null,
  baseBranch: null,
  planMode: null,
  planIteration: 0,
  currentTaskIndex: 0,
  completedTasks: [],
  tddTaskState: {}
}, null, 2));
console.log('state.json reset to idle');
"
```

**Summary of what happened and what's filed:**

- **Issue #087** (the original bug): ✅ Fixed, PR #45 merged. Issue file now `done`.  
- **`state.json`**: Stuck because the done-phase consumption mechanism is broken — needs the manual reset above.
- **Issue #090** (the meta-bug you've been hitting repeatedly): Filed — "Done-phase content-capture actions never consumed — permanent doneActions deadlock." Root cause: the `text.length > 100` guard in `onAgentEnd` doesn't fire when the LLM writes files via `write()` instead of outputting text inline. Fix: remove the length guard for consumption (keep it only for content capture).
### Action 4: close-issue

---

## Done — Issue #090 Complete ✅

All selected wrap-up actions executed:

| Action | Result |
|--------|--------|
| **write-changelog** | Entry appended to `.megapowers/CHANGELOG.md` under `## [Unreleased] / ### Fixed`: `Fix done-phase deadlock: capture-learnings and write-changelog doneActions never consumed due to text.length > 100 guard (#090)` |
| **capture-learnings** | 6 learnings in `.megapowers/plans/090-done-phase-content-capture-actions-never/learnings.md` (written and committed in previous session) |
| **push-and-pr** | PR #46 open: https://github.com/coctostan/pi-megapowers/pull/46 — changelog commit pushed |
| **close-issue** | Ready |

**The issue is ready to close.** Run `/issue close` or select a new issue to continue.

## [Unreleased]
### Added
- Project-scoped `plan-scout` agent at `.pi/agents/plan-scout.md` — advisory-only planning scout that produces a bounded `context.md` handoff (AC mapping, key files, conventions, risks, task slices) before plan drafting; delivered via `pi-subagents` extension with no new megapowers runtime (#102)
- V1 rollout section in `095-subagent-assisted-plan-review-decomposition.md` documenting `context.md` as advisory planning handoff, artifact layout scoping, and experiment success criteria (#109)

### Changed
- `prompts/implement-task.md` Execution Mode wording narrowed: `pipeline`/`subagent` restriction now scoped to implement-phase execution only, explicitly exempting advisory planning-scout usage in the plan phase (#113)
- **Brainstorm/spec requirements traceability contract** — Rewrote `brainstorm.md` prompt as structured requirements capture (`R#`/`O#`/`D#`/`C#`/`Q#` buckets, mode triage, no-silent-drop rule, exact artifact sections). Rewrote `write-spec.md` prompt to enforce `Requirement Traceability` + `No silent drops` (every `R#` mapped exactly once) and legacy handling for older unstructured brainstorm artifacts. Added 7 prompt-contract tests locking both contracts against drift. `brainstorm` phase name unchanged. (#118)