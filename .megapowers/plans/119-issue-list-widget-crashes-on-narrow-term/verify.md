# Verification Report — 119-issue-list-widget-crashes-on-narrow-term

## Test Suite Results

```
bun test
→ 936 pass, 0 fail, 2267 expect() calls
   Ran 936 tests across 103 files. [1309ms]
```

## Step 1b — Reproduce Original Symptom

The diagnosis states the pre-fix renderers accepted `_width` but used `lines.push(...)` directly,
producing lines of visible width 198 when given a terminal width of 40. A fresh script was run
against the current branch with the exact same long issue data:

```
bun run repro-check.ts
→ PASS: all lines across list/detail/menu screens have visibleWidth <= 40
```

The over-wide output (width 198) described in the crash report no longer occurs.

---

## Per-Criterion Verification

### Criterion 1: Every screen returned by the custom issue-list widget honors the supplied render width — list, detail, and action menu.

**IDENTIFY:** Code inspection of all three renderer functions in `extensions/megapowers/ui-issue-list.ts`.

**RUN / READ:**

`renderIssueListScreen` (lines 112–136):
```ts
const add = (line: string = "") => lines.push(line === "" ? "" : truncateToWidth(line, width));
```
All lines (header, milestone headers, issue rows, nav hint) go through `add()`.

`renderIssueDetailScreen` (lines 174–192):
```ts
const add = (line: string = "") => lines.push(line === "" ? "" : truncateToWidth(line, width));
```
All lines (title, metadata, description paragraphs, back hint) go through `add()`.

`renderIssueActionMenuScreen` (lines 203–223):
```ts
const add = (line: string = "") => lines.push(line === "" ? "" : truncateToWidth(line, width));
```
All lines (header, issue title, menu items, nav hint) go through `add()`.

No `lines.push(...)` call exists outside the `add()` helper in any of the three renderers (blank lines
are passed as `""` which the helper passes through unchanged — that is correct, since blank lines have
visibleWidth 0).

The import at line 2 confirms `truncateToWidth` is imported:
```ts
import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
```

**VERIFY:** All three renderers apply `truncateToWidth` to every non-empty line via the `add()` helper.

**Verdict:** ✅ pass

---

### Criterion 2: No line emitted by those screens exceeds terminal width, even with long issue titles, descriptions, or batch slugs.

**IDENTIFY:** Fresh runtime check using a long issue (title 113 chars, description 130 chars, batch slug
`117-interactive-issue-list-with-keyboard-nav`, milestone `M1234567890`) at width=40, across all three screens.

**RUN:**
```
bun run repro-check.ts
→ PASS: all lines across list/detail/menu screens have visibleWidth <= 40
```

**READ:** Exit 0, output confirms no line exceeded 40 characters.

**Also verified by the dedicated regression test:**
```
bun test ./tests/ui-issue-list-width.test.ts
→ 1 pass, 0 fail, 24 expect() calls
```
24 calls = each line from each of the three screens was checked individually with
`expect(visibleWidth(line)).toBeLessThanOrEqual(width)`.

**Verdict:** ✅ pass

---

### Criterion 3: Regression test coverage exists that measures rendered line width directly, not just rendered content.

**IDENTIFY:** `tests/ui-issue-list-width.test.ts` — inspected the test file and ran it fresh.

**RUN:**
```
bun test ./tests/ui-issue-list-width.test.ts
→ 1 pass, 0 fail, 24 expect() calls. [38ms]
```

**READ:** The test (lines 32–50) asserts `visibleWidth(line) <= width` for every line returned by
`renderIssueListScreen`, `renderIssueDetailScreen`, and `renderIssueActionMenuScreen`. This is a
direct width measurement, not a content/substring check.

Contrast with the pre-existing tests that did NOT catch the bug:
- `tests/ui-issue-list-navigation.test.ts` uses `toContain(...)` — content only.
- `tests/ui-issue-list-detail.test.ts` uses `toContain(...)` — content only.

The new test uses `visibleWidth()` from `@mariozechner/pi-tui`, the same API Pi TUI uses internally to
enforce the width contract.

**Verdict:** ✅ pass

---

## Overall Verdict

**pass**

All three acceptance criteria are met:

1. All three custom issue-list widget screen renderers (`renderIssueListScreen`,
   `renderIssueDetailScreen`, `renderIssueActionMenuScreen`) apply `truncateToWidth` via a local
   `add()` helper to every emitted line — confirmed by code inspection.

2. A fresh runtime reproduction with a long issue (title + batch slug producing a pre-fix width of 198)
   at terminal width 40 emits zero lines exceeding the bound — confirmed by script output.

3. `tests/ui-issue-list-width.test.ts` asserts `visibleWidth(line) <= width` for all three screens
   with a wide issue fixture — a direct width regression test, not a content test. 24/24 assertions
   pass fresh.

Full suite: 936 pass, 0 fail.
