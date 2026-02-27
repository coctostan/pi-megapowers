

## 2026-02-27 — Done-phase action runner (065-done-phase-refactor)

### Added
- **Done-phase action runner** — Replaced fragile `onAgentEnd` message-scraping with a tool-driven sequential action queue. The LLM executes wrap-up actions (docs, changelog, learnings, VCS, project docs) using existing tools, calling `megapowers_signal({ action: "task_done" })` after each.
- **`completedDoneActions: string[]`** in `MegapowersState` — tracks completed done-phase actions; reset on every phase transition; persisted via `KNOWN_KEYS`.
- **`handleSaveArtifact` accepts phase `"learnings"`** — routes to `store.appendLearnings()` with markdown bullet-list parsing; errors if no bullet items found.
- **`getDoneChecklistItems` `locked` field** — required actions have `locked: true`; optional `vcs-wrap-up` has `locked: false`. Checklist UI prevents toggling locked items.
- **`update-project-docs` done action** — reviews and updates ROADMAP.md, AGENTS.md, and README.md as part of every done phase.
- **`vcs-wrap-up` replaces `squash-task-changes`** — combines squash + bookmark + push + PR; shown only when `taskJJChanges` has entries and `jjChangeId` is set.
- **Close-confirmation dialog** — after last `task_done` in done phase, `handleSignal` returns `closeConfirmation: true` and presents a Yes/No dialog. Confirming closes source issues then main issue and resets state.
- **Status bar and dashboard done-phase progress** — shows `"N/M actions complete"`.
- **`getCloseConfirmationInfo`** and **`handleCloseConfirmation`** exported from `tool-signal.ts`.

### Changed
- **`handleTaskDone`** now succeeds when `phase === "done"` and `doneActions` is non-empty.
- **Done-phase prompt** (`prompts/done.md`) rewritten — ✅ completed actions, pending actions, conditional VCS permission block.
- **Dashboard done-phase block** — `N/M complete` fraction and "Next: <action>" line.

### Removed
- **`onAgentEnd` artifact-capture block** — deleted; `onAgentEnd` now only renders the dashboard.
- **`close-issue` checklist item** — closing handled by close-confirmation dialog.


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
```
## [2026-02-26] — Remove blocking phase-transition popups; add `phase_back` signal

- **New:** `megapowers_signal({ action: "phase_back" })` lets the agent go back to the previous phase (review→plan, verify→implement, code-review→implement) without any user prompt
- **Removed:** Blocking popup dialogs after every agent turn are gone — phase transitions are now fully agent-driven via `megapowers_signal` tool calls
- **New:** Entering the `done` phase shows a non-blocking checklist widget for wrap-up actions (generate docs, write changelog, capture learnings, squash, close issue); the agent then executes selected actions autonomously
- **Changed:** `doneMode` state field replaced with `doneActions: string[]`; prompt templates updated to reflect the new agent-driven flow
```

Approve this and I'll save it, or let me know if you'd like any tweaks.
Here's the summary of what happened and current status:

---

## Done Actions — Status

**The core issue:** Pi loaded the megapowers extension at session startup with the **old code** (before issue 065 was implemented). The new `handleTaskDone` that supports `phase === "done"` is on disk but not in the running pi process. `megapowers_signal({ action: "task_done" })` returns the old error in done phase.

### Actions completed (content-wise):

**✅ write-changelog** — Entry written to:
- `.megapowers/CHANGELOG.md` (appended)
- `.megapowers/artifacts/changelog-pending.md` (full entry, ready to paste to root `CHANGELOG.md` when write policy allows)

**✅ capture-learnings** — Saved to:
- `.megapowers/plans/065-done-phase-refactor/learnings.md`
- `.megapowers/learnings.md` (appended, attributed)

**⚠️ squash-task-changes** — Skipped. VCS permission was not granted (the `{{vcs_permission}}` template placeholder was not interpolated in the prompt because the new prompt-inject code wasn't running when this done phase was entered). The 15 task jj changes in `taskJJChanges` still need to be squashed.

**✅ close-issue** — `.megapowers/issues/065-done-phase-refactor.md` updated to `status: done`.

### What you need to do to fully close out:

1. **Restart pi** — this reloads the extension with the new code from issue 065
2. After restart, the done phase will still be active (state.json persists). Call **`megapowers_signal({ action: "task_done" })`** 4 times to drain the doneActions queue — the new code will handle it correctly
3. On the 4th `task_done`, the close-confirmation dialog will appear → confirm to reset state
4. Optionally run `jj squash` to consolidate the task changes before pushing
