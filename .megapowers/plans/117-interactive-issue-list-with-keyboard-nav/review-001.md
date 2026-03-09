---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 6
  - 7
  - 8
  - 9
  - 4
  - 5
approved_tasks:
  - 1
  - 2
  - 3
  - 6
  - 7
  - 8
  - 9
needs_revision_tasks:
  - 4
  - 5
---

### Per-Task Assessment

### Task 1: Build grouped issue-list rows for the custom widget — ✅ PASS
No issues. Coverage, ordering, TDD steps, and APIs are realistic. The task uses the real `Issue` type from `extensions/megapowers/state/store.ts` and its test/implementation pair is self-contained.

### Task 2: Add cursor navigation and focused-row rendering — ✅ PASS
No blocking issues. It correctly depends on Task 1, uses the existing `@mariozechner/pi-tui` package pattern seen in `extensions/megapowers/ui-checklist.ts`, and the Step 3 APIs are realistic.

### Task 3: Define per-issue action menus for active and non-active rows — ✅ PASS
No blocking issues. The task is self-contained, uses the correct `Issue` type, and its Step 3 implementation is compatible with the codebase.

### Task 4: Add in-widget detail view rendering and return state — ❌ REVISE
- `depends_on: [1, 3]` is not correct. This task does not use `buildIssueActionItems()` or any Task 3 output; it only needs the issue/detail-view helpers. The dependency on Task 3 should be removed.
- The `Covers AC:` line is inaccurate. The task claims AC 17 and AC 18, but its Step 3 only adds detail-view state/rendering helpers. Activation/archive routing is implemented later in `extensions/megapowers/ui.ts`, not here.
- The task is otherwise technically sound, but its dependency and AC mapping need to be corrected so implementation stays self-contained and traceable.

### Task 5: Switch `/issue list` to `ctx.ui.custom()` and preserve Escape dismiss — ❌ REVISE
- This is the main plan blocker. Step 3 only handles Up/Down/Tab/Escape inside `showIssueListUI()`; it never handles Enter, so AC 12 and AC 13 are not actually implemented.
- Because Enter never opens an action menu, downstream Tasks 6–9 are unreachable from the widget as written.
- Because there is no menu/result path for `view`, AC 19 and AC 21 are also not wired into the widget, even though Task 4 creates the pure detail-view helpers.
- Step 3 says to "append" code to `extensions/megapowers/ui-issue-list.ts` but the snippet starts with import statements. Appending `import { Key, matchesKey } from "@mariozechner/pi-tui";` and `import type { Issue } from "./state/store.js";` into the middle of an existing module would not be valid TypeScript. The task must explicitly say to update the top-level imports instead.
- The task’s coverage list is incomplete/inaccurate for the work it must do. Once fixed, this task should explicitly cover the Enter-to-create, Enter-to-open-menu, view/detail return flow, and Escape dismiss behavior it owns.

### Task 6: Route the create row into the existing new-issue flow — ✅ PASS
No blocking issues once Task 5 is corrected. It deliberately reuses the existing `new` branch in `extensions/megapowers/ui.ts` and the test is realistic.

### Task 7: Route Open/Activate through the existing activation path — ✅ PASS
No blocking issues once Task 5 is corrected. It reuses existing `getFirstPhase()`, `writeState()`, and `store.updateIssueStatus()` behavior in `extensions/megapowers/ui.ts`.

### Task 8: Route Archive through the existing archive behavior — ✅ PASS
No blocking issues once Task 5 is corrected. The task uses the real `store.archiveIssue()` API and mirrors the existing archive reset path in `extensions/megapowers/ui.ts`.

### Task 9: Route close actions through existing state and phase behavior — ✅ PASS
No blocking API issues. The imports and APIs (`handleSignal`, `readState`, `writeState`, `store.updateIssueStatus`) exist and the branches are realistic for the current codebase.

### Missing Coverage
- As written today, AC 12 is not actually covered by any implementation task because Task 5 never handles Enter on the `+ Create new issue...` row.
- As written today, AC 13 is not actually covered by any implementation task because no task wires Enter on an issue row to open an action menu inside the widget.
- As written today, AC 19 and AC 21 are only partially covered: Task 4 builds pure detail-view helpers, but no task integrates the `View` action into the widget flow or returns from detail back to the list.

### Verdict
- **revise** — Task 5 is missing the core Enter/menu/detail interaction flow the rest of the plan depends on, and Task 4’s dependency/coverage annotations are inaccurate. I wrote prescriptive fix instructions to `.megapowers/plans/117-interactive-issue-list-with-keyboard-nav/revise-instructions-1.md`.
