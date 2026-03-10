# Reproduction: `/issue list` widget overflows and crashes on narrow terminals

## Steps to Reproduce
1. Start from the pre-fix interactive issue-list implementation (`origin/main` at commit `ae71ea2`, introduced by `feat: interactive /issue list widget with keyboard navigation (#117) (#63)`).
2. Ensure there is at least one issue whose rendered row label is longer than the terminal width, especially a long title plus a long `(in batch <slug>)` suffix.
3. Open the custom `/issue list` widget in a terminal that is narrower than the rendered row. In the observed crash, terminal width was `119` columns.
4. Navigate to the screen containing the long row.
5. Pi TUI crashes during render because the widget emits a line wider than the available width.

Minimal code-level repro (same failure mode, using the pre-fix renderer behavior):
1. Build issue-list rows for a long issue title and long batch slug.
2. Render the list/detail/menu screens at a narrow width (for example `40`).
3. Assert every rendered line width is `<= width`.
4. The assertion fails immediately on the pre-fix implementation because the renderers return untruncated lines.

## Expected Behavior
`/issue list` should render safely at any terminal width. No emitted line should exceed the current render width, and opening the widget should not crash Pi TUI even with very long issue titles, descriptions, or batch slugs.

## Actual Behavior
The widget emits lines wider than the terminal width and Pi TUI hard-fails during render.

Exact crash text from the issue report:
- `Rendered line 83 exceeds terminal width (171 > 119)`

Exact crash-log evidence from `/Users/maxwellnewman/.pi/agent/pi-crash.log`:
- `Crash at 2026-03-09T19:57:18.270Z`
- `Terminal width: 119`
- `Line 83 visible width: 171`
- offending rendered row:
  - `#085 [P1] Pipeline squash fails when worktree creates files that already exist in main working directory [closed] (in batch 091-nuke-pipeline-subagent-infrastructure-re)`

Exact failing assertion from a minimal pre-fix renderer repro test run:
```text
bun test v1.3.9 (cf6cdbbb)

.tmp/repro-119-old-ui.test.ts:
121 |       renderIssueDetailScreen(longIssue, width, theme),
122 |       renderIssueActionMenuScreen(longIssue, menuItems as any, 0, width, theme),
123 |     ];
124 |     for (const screen of screens) {
125 |       for (const line of screen) {
126 |         expect(visibleWidth(line)).toBeLessThanOrEqual(width);
                                         ^
error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 40
Received: 198

      at <anonymous> (/Users/maxwellnewman/pi/workspace/pi-megapowers/.tmp/repro-119-old-ui.test.ts:126:36)
(fail) pre-fix issue-list width handling > does not keep all rendered lines within width [3.27ms]

 0 pass
 1 fail
 4 expect() calls
Ran 1 test across 1 file. [77.00ms]
```

## Evidence
### Crash-log snippet
```text
Crash at 2026-03-09T19:57:18.270Z
Terminal width: 119
Line 83 visible width: 171

=== All rendered lines ===
[79] (w=14) M1: (2 issues)
[80] (w=95) > #117 [P1] Interactive issue list with keyboard navigation and per-issue actions [in-progress]
[81] (w=57)   #051 [P2] UX feedback, visibility & transparency [open]
[82] (w=13) M2: (1 issue)
[83] (w=171)   #085 [P1] Pipeline squash fails when worktree creates files that already exist in main working directory [closed] (in batch 091-nuke-pipeline-subagent-infrastructure-re)
[84] (w=15) M3: (13 issues)
[85] (w=129)   #082 [P1] Reviewer-authored revise-instructions handoff for plan revision sessions [closed] (in batch 078-init-workflow-system)
[86] (w=162)   #094 [P1] Remove T1 plan lint, restore reviewer ownership, and reduce plan-phase context overload [open] (in batch 096-restore-full-reviewer-ownership-in-promp)
[87] (w=132)   #096 [P1] Restore full reviewer ownership in prompts/review-plan.md [open] (in batch 110-plan-review-recovery-disable-t1-authorit)
[88] (w=166)   #099 [P1] Remove T1 model lint from handlePlanDraftDone in extensions/megapowers/tools/tool-signal.ts [open] (in batch 110-plan-review-recovery-disable-t1-authorit)
[89] (w=142)   #100 [P1] Remove T1 model-wiring from extensions/megapowers/register-tools.ts [open] (in batch 110-plan-review-recovery-disable-t1-authorit)
[90] (w=161)   #101 [P1] Delete T1 plan-lint module, prompt, and tests; replace with simple transition coverage [open] (in batch 111-plan-review-recovery-remove-t1-dead-code)
```

### Recent change check
`git log` shows the regression belongs to the interactive widget introduced on main before the fix branch:
```text
09507bc (HEAD -> fix/119-issue-list-widget-crashes-on-narrow-term, origin/bugfix/119-issue-list-width-overflow, bugfix/119-issue-list-width-overflow) fix(issue-list): truncate custom widget lines to terminal width
ae71ea2 (origin/main, origin/HEAD, main) feat: interactive /issue list widget with keyboard navigation (#117) (#63)
```

This establishes that the crash is tied to the custom `/issue list` widget implementation present on `origin/main` before the fix commit.

## Environment
- OS: `Darwin lg-tv.casa 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:48:41 PST 2026; root:xnu-12377.81.4~5/RELEASE_ARM64_T6041 arm64`
- Bun: `1.3.9`
- Pi version from crash log: `pi v0.57.1`
- Repository branch during investigation: `fix/119-issue-list-widget-crashes-on-narrow-term`
- Current HEAD during investigation: `09507bc`
- Pre-fix commit confirmed to reproduce: `ae71ea2` (`origin/main`)

## Failing Test
Test is feasible.

Regression test path now present on the fix branch:
- `tests/ui-issue-list-width.test.ts`

That test renders the list screen, detail screen, and action-menu screen at width `40` and asserts:
```ts
for (const screen of screens) {
  for (const line of screen) {
    expect(visibleWidth(line)).toBeLessThanOrEqual(width);
  }
}
```

On the pre-fix implementation, the same assertion fails with:
- `Expected: <= 40`
- `Received: 198`

## Reproducibility
Always, when the custom `/issue list` widget renders any row/detail line wider than the current terminal width. The crash is especially easy to trigger with long issue titles plus long batch slugs.