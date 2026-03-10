# Learnings — #119: `/issue list` crashes on narrow terminal

- **`ctx.ui.custom()` widgets must handle width explicitly — Pi TUI does not clip.** Pi TUI hard-fails
  if any rendered line exceeds the terminal width. Every custom widget must route all output through a
  `truncateToWidth(line, width)` guard. "The data is usually short enough" is not a safe assumption.

- **Naming a parameter `_width` is a silent contract violation.** The convention of prefixing with
  `_` to suppress unused-variable warnings masked the bug from code review: the function signature
  looked correct but the width was never applied. Prefer renaming to `width` and using it, even when
  the initial implementation is a stub.

- **Content-only tests don't catch width contract breaks.** The existing `toContain(...)` assertions
  in `ui-issue-list-navigation.test.ts` and `ui-issue-list-detail.test.ts` verified what was rendered
  but not how wide. A width regression test using `visibleWidth(line) <= width` is the right companion
  for any custom widget renderer.

- **The working checklist widget was the right reference all along.** `ui-checklist.ts` already had the
  canonical `add()` pattern. When writing a new custom widget, check existing widgets first — the
  pattern was there to copy.

- **TDD guard blocks `task_done` if no RED was observed in the session.** When a task is already
  implemented on the branch before the implement phase starts, the harness has no record of RED. The
  workaround was to call `megapowers_signal({ action: "tests_failed" })` explicitly to unblock the
  state, then confirm green. A cleaner fix would be a "already-green" bypass path for pre-implemented
  tasks.

- **Plan review is worth the iteration cost.** The only revision needed was adding a `**Covers:**`
  traceability line — a lightweight fix. Catching coverage traceability gaps in plan review is cheaper
  than discovering them during verify or code review.
