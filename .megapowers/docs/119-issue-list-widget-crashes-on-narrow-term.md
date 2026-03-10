# Bugfix Summary — #119: `/issue list` widget crashes on narrow terminal

## Status
Fixed in commit `09507bc` on branch `bugfix/119-issue-list-width-overflow`.

## Root Cause
A **renderer contract violation** in the custom `/issue list` widget introduced by `ae71ea2`.

`ctx.ui.custom()` widgets in Pi TUI receive the terminal width at render time and are contractually
required to emit no line wider than that value. All three issue-list screen renderers
(`renderIssueListScreen`, `renderIssueDetailScreen`, `renderIssueActionMenuScreen`) accepted the
`width` parameter but silently ignored it (the parameter was named `_width`). Every line was pushed
directly into the output array without truncation, so long issue labels — particularly titles combined
with the `(in batch <slug>)` suffix — could produce lines of visible width 198 when the terminal was
119 columns wide, causing Pi TUI to hard-crash.

## Symptoms
- `/issue list` crashed at render time on any terminal narrow enough relative to issue label lengths.
- Crash log: `Terminal width: 119 / Line 83 visible width: 171`.
- The offending row matched the format `#085 [P1] ... [closed] (in batch ...)`.

## Fix Approach
Applied the existing working pattern from `extensions/megapowers/ui-checklist.ts` to all three
renderers:

1. Added `truncateToWidth` to the import from `@mariozechner/pi-tui`.
2. In each renderer, replaced bare `lines.push(...)` calls with a local `add()` helper:
   ```ts
   const add = (line: string = "") =>
     lines.push(line === "" ? "" : truncateToWidth(line, width));
   ```
3. Renamed `_width` → `width` in all three function signatures.

Empty strings are passed through unchanged to preserve blank-line spacing — they have `visibleWidth`
of 0, so they can never trigger the crash.

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/ui-issue-list.ts` | Added `truncateToWidth` import; replaced direct `lines.push()` with `add()` helper in `renderIssueListScreen`, `renderIssueDetailScreen`, `renderIssueActionMenuScreen` |
| `tests/ui-issue-list-width.test.ts` | New regression test: asserts `visibleWidth(line) <= width` for all lines from all three screens with a long-label issue fixture |

## How to Verify

```bash
# Width regression test (targeted)
bun test ./tests/ui-issue-list-width.test.ts
# Expected: 1 pass, 24 expect() calls

# Full suite (no regressions)
bun test
# Expected: 936 pass, 0 fail
```

The regression test uses an issue with:
- 113-char title
- 130-char description  
- `117-interactive-issue-list-with-keyboard-nav` batch slug
- `M1234567890` milestone

rendered at width=40 (well below any real terminal). Every emitted line is verified against
`visibleWidth(line) <= 40`.

## Pattern Note for Future Custom Widgets
`ctx.ui.custom()` widgets **must** handle width explicitly. Pi TUI does not silently clip lines — it
hard-fails if any returned line exceeds the terminal width. The canonical pattern is:

```ts
render(width: number): string[] {
  const lines: string[] = [];
  const add = (s: string) => lines.push(s === "" ? "" : truncateToWidth(s, width));
  // ... all output goes through add()
  return lines;
}
```

See `extensions/megapowers/ui-checklist.ts` as the reference implementation.
