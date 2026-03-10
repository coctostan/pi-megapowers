---
id: 119
type: bugfix
status: in-progress
created: 2026-03-09T20:09:54.422Z
---
# Issue list widget crashes on narrow terminals when long row labels exceed width
`/issue list` can crash the TUI when a rendered row exceeds the terminal width. The crash log shows a hard render failure from pi-tui:

- terminal width: `119`
- offending rendered line width: `171`
- crash: `Rendered line 83 exceeds terminal width (171 > 119)`

Evidence from `/Users/maxwellnewman/.pi/agent/pi-crash.log`:

- offending row:
  `#085 [P1] Pipeline squash fails when worktree creates files that already exist in main working directory [closed] (in batch 091-nuke-pipeline-subagent-infrastructure-re)`
- other rows in the same widget also exceed width (`129`, `162`, `166`, `142`, `161`, etc.)

Likely cause:
- the custom `/issue list` widget renders raw row labels without width-aware truncation/wrapping
- long issue titles plus the `(in batch <slug>)` suffix make lines overflow narrow terminals

Expected:
- custom issue-list renderers must truncate or wrap every emitted line to the current TUI width using pi-tui width helpers
- `/issue list` should never crash regardless of issue title/batch slug length

Suggested acceptance criteria:
1. `/issue list` does not emit any line wider than the provided render width.
2. Long issue rows are truncated safely in the list screen.
3. Long issue titles/descriptions are also safe in any related issue-list detail/action screens.
4. Add a regression test that renders the widget at a narrow width and asserts all lines stay within bounds.

Notes:
- The crash log strongly suggests this is in the custom widget renderer rather than the old select fallback.
- The overflow is especially easy to trigger with long batch slugs.
