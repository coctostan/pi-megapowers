---
id: 128
type: feature
status: in-progress
created: 2026-05-17T01:15:36.509Z
sources: [120, 127]
milestone: M1
priority: 2
---
# Compact Megapowers prompt injection with phase-aware protocol header
Reduce repeated Megapowers prompt bloat by replacing the every-turn full `megapowers-protocol.md` injection with a compact, phase-aware protocol header while preserving existing workflow semantics, gates, safety rules, and rich phase templates.

## Context

Pi prompt compaction work identified Megapowers as a significant source of repeated prompt content. The main issue is not the tool namespace descriptions themselves; it is the full Megapowers protocol block being injected into prompt context on every turn.

Current implementation in `extensions/megapowers/prompt-inject.ts` unconditionally loads and prepends `prompts/megapowers-protocol.md` for active Megapowers sessions, and `buildIdlePrompt()` also includes it for no-active-issue sessions. This repeatedly injects:

- all workflow/TDD signal actions
- plan task and plan review details
- artifact persistence rules
- VCS policy
- error handling
- open issues
- available commands
- roadmap/milestone pointer

Most turns only need the current issue/phase, phase-relevant allowed actions, and a small set of high-value safety reminders.

## Goal

Default Megapowers prompt injection should be compact and phase-aware:

- preserve all existing workflow gates and state transitions
- keep existing rich phase templates such as `write-plan.md`, `review-plan.md`, `implement-task.md`, `verify.md`, `code-review.md`, and `done.md`
- replace only the repeated full protocol wrapper with a concise phase-aware header
- show open issues and command lists only when relevant
- keep full protocol available through explicit full/help/debug rendering path
- keep critical safety rules visible while Megapowers is active

## Non-goals

- Do not redesign the workflow.
- Do not remove or weaken workflow gates.
- Do not remove TDD enforcement.
- Do not remove existing phase-specific prompt templates.
- Do not change issue activation, branching, WIP commit, or close behavior.
- Do not edit `.megapowers/state.json` directly.

## Proposed prompt behavior

### Default active prompt shape

For an active issue, default injection should begin with a compact header like:

```md
## Megapowers

Active phase: <phase or plan mode>
Current issue: <issue id/title/slug>
Current task: <task id/title if relevant>

Allowed now:
- <phase-relevant action>
- <phase-relevant action>

Rules:
- <phase-relevant critical rule>
- Do not edit `.megapowers/state.json`.
- If a Megapowers tool errors, follow its message and retry.
```

Then append the existing phase template content and other relevant derived sections as today.

### No active issue

When Megapowers is enabled but no issue is active, include compact issue-selection guidance and, if available, a compact open issue list:

```md
## Megapowers

No active issue.

Allowed now:
- `/issue list` to pick an issue.
- `/issue new` to create an issue.
- `/triage` to batch/prioritize open issues.

Rules:
- Do not edit `.megapowers/state.json`.
- If a Megapowers tool errors, follow its message and retry.
```

This is one of the cases where showing open issues is helpful.

### Plan draft/revise

Compact header should include:

- active phase: `plan (draft)` or `plan (revise)`
- current issue
- allowed actions:
  - `megapowers_plan_task(...)` to create/update structured plan tasks
  - `megapowers_signal({ action: "plan_draft_done" })` after tasks/artifacts are ready
- rules:
  - save plan artifacts/tasks under `.megapowers/plans/<issue-slug>/`
  - do not bypass review with `phase_next`
  - do not edit `.megapowers/state.json`

Existing `write-plan.md` / `revise-plan.md` content should still be rendered.

### Plan review

Compact header should include:

- active phase: `plan review`
- current issue
- allowed actions:
  - `megapowers_plan_review({ verdict: "approve", ... })`
  - `megapowers_plan_review({ verdict: "revise", ... })`
- rules:
  - do not use deprecated `review_approve`
  - do not force `phase_next` from plan review
  - do not edit `.megapowers/state.json`

Existing `review-plan.md`, focused review advisory artifact handling, and advisory subagent anti-recursion guidance must continue to work.

### Implement

Compact header should include:

- active phase: `implement`
- current issue
- current task when known
- allowed actions:
  - `megapowers_signal({ action: "tests_failed" })` after RED
  - `megapowers_signal({ action: "tests_passed" })` after GREEN
  - `megapowers_signal({ action: "task_done" })` when current task is complete
- rules:
  - follow TDD gates
  - do not edit `.megapowers/state.json`
  - if a tool errors, follow its message and retry

Existing `implement-task.md` content should still be rendered.

### Verify

Compact header should include:

- active phase: `verify`
- current issue
- allowed actions:
  - `megapowers_signal({ action: "phase_next" })` after verification passes
  - `megapowers_signal({ action: "phase_back" })` if implementation needs changes
- rules:
  - save verification notes/artifacts before advancing when applicable
  - do not edit `.megapowers/state.json`
  - if a tool errors, follow its message and retry

Existing `verify.md` content should still be rendered.

### Code review

Compact header should include:

- active phase: `code-review`
- current issue
- allowed actions:
  - `megapowers_signal({ action: "phase_next" })` after review findings are resolved
  - `megapowers_signal({ action: "phase_back" })` if implementation needs changes
- rules:
  - address review findings before advancing
  - do not edit `.megapowers/state.json`
  - if a tool errors, follow its message and retry

Existing `code-review.md` content should still be rendered.

### Done

Compact header should include:

- active phase: `done`
- current issue
- allowed actions:
  - push/PR and post-merge cleanup are allowed in this phase
  - `megapowers_signal({ action: "close_issue" })` after all wrap-up is complete
- rules:
  - only close after final artifacts, PR/merge status, and cleanup are complete
  - do not edit `.megapowers/state.json`
  - if a tool errors, follow its message and retry

Existing `done.md` rendering with `doneActions` should still work.

## Open issue and command injection policy

Do not inject the full open issues list every turn.

Open issues should be injected only when:

- no issue is active
- `/issue list` or equivalent issue-selection UI is requested
- status/help makes issue selection relevant
- triage/routing is happening

Do not inject the full available commands list every turn.

Commands should be injected only when:

- no issue is active
- user asks for help/status
- command parsing fails
- first Megapowers activation in a session, if such a hook exists

Compact command form is enough when needed:

```md
Commands: `/issue list`, `/issue new`, `/triage`, `/mega on|off`.
```

## Full protocol mode

Keep a code path that can render the canonical full `prompts/megapowers-protocol.md` for explicit full/help/debug/context inspection use. The first implementation may keep this as an internal helper if there is not yet a user-facing command, but tests should verify the full protocol can still be rendered.

Potential future UX hooks, likely covered by #120, include:

- `/mega context`
- `/mega context full`
- `/mega help`
- `/mega prompt full|compact`

## Suggested implementation approach

1. Add prompt renderer helpers near `extensions/megapowers/prompt-inject.ts` or in a small dedicated module:
   - `renderFullProtocolPrompt(...)`
   - `renderCompactProtocolPrompt(...)`
   - `renderIdleCompactPrompt(...)`
   - `renderActiveCompactPrompt(...)`
   - plan-mode-specific helpers if useful

2. Change `buildInjectedPrompt()` so active sessions no longer unconditionally push `loadPromptFile("megapowers-protocol.md")`.

3. Change `buildIdlePrompt()` to use compact no-active-issue prompt plus compact open issue/command information, not the full protocol.

4. Preserve all existing phase template rendering and derived context behavior:
   - workflow artifact variable loading
   - acceptance criteria derivation
   - task derivation/current task variables
   - brainstorm/plan learnings and roadmap context
   - done phase branch/base variables
   - plan revise instructions
   - focused review artifacts
   - advisory plan-review subagent section
   - source issue context
   - derived tool instructions, unless intentionally superseded by the compact header

5. Be careful not to duplicate conflicting allowed-action guidance between the new compact header and existing `deriveToolInstructions()` output. Prefer reusing canonical workflow configuration where practical.

## Testing requirements

Add/update tests, likely in `tests/prompt-inject.test.ts`, to verify:

1. Compact prompt rendering is the default.
2. Active issue prompt no longer includes the full `## Megapowers Protocol` block by default.
3. Active issue prompt does not include the full `## Open Issues` section.
4. Active issue prompt does not include the full `## Available Commands` section every turn.
5. No-active-issue prompt includes issue-selection guidance and may include compact open issues.
6. Plan draft/revise prompt includes `megapowers_plan_task` and `plan_draft_done`.
7. Plan draft/revise prompt warns not to bypass review with `phase_next`.
8. Plan review prompt includes `megapowers_plan_review` approve/revise.
9. Plan review prompt does not recommend forcing `phase_next`.
10. Plan review prompt warns not to use deprecated `review_approve`.
11. Implement prompt includes `tests_failed`, `tests_passed`, and `task_done`.
12. Implement prompt includes current task context when known.
13. Verify prompt includes `phase_next` and `phase_back` guidance.
14. Code-review prompt includes `phase_next` and `phase_back` guidance.
15. Done prompt includes push/PR/post-merge allowance and `close_issue`.
16. Full protocol rendering path still includes canonical `## Megapowers Protocol` content.
17. `Do not edit .megapowers/state.json` remains visible in compact mode.
18. Megapowers tool error handling guidance remains visible in compact mode.
19. Existing workflow/state transition tests still pass.

## Acceptance criteria

- Default live Megapowers prompt no longer repeats the full protocol every turn.
- Active issue turns show only phase-relevant Megapowers actions in the protocol header.
- Existing detailed phase templates still render as before.
- Open issues list appears only when issue selection/status/triage needs it.
- Available commands list appears only when helpful.
- Full protocol remains accessible through an explicit/internal full rendering path.
- Existing workflow gates, state transitions, TDD behavior, and plan review behavior are unchanged.
- Tests cover compact vs full behavior and phase-specific compact guidance.
- `bun test` passes.
