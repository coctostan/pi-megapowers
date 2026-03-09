# Code Review: 117-interactive-issue-list-with-keyboard-nav

## Files Reviewed

| File | Description |
|------|-------------|
| `extensions/megapowers/ui-issue-list.ts` | New module — row types, row builder, navigation logic, renderers, action builders, widget entry point |
| `extensions/megapowers/ui.ts` | Modified — integrates custom widget path into `/issue list` handler; adds `go-to-done` action handler and new imports |
| `tests/ui-issue-list-rows.test.ts` | New — pure tests for `buildIssueListRows` |
| `tests/ui-issue-list-navigation.test.ts` | New — pure tests for cursor navigation and rendering |
| `tests/ui-issue-list-actions.test.ts` | New — pure tests for `buildIssueActionItems` |
| `tests/ui-issue-list-detail.test.ts` | New — pure tests for detail-view open/return/render |
| `tests/ui-issue-command-custom-list.test.ts` | New — integration tests for full widget interaction |
| `tests/ui-issue-command-open-action.test.ts` | New — integration test for Open/Activate state reset |
| `tests/ui-issue-command-archive-action.test.ts` | New — integration tests for Archive action |
| `tests/ui-issue-command-close-actions.test.ts` | New — integration tests for Close / Close now / Go to done phase |
| `tests/ui-issue-command-create-row.test.ts` | New — integration test for create-row action flow |

---

## Strengths

- **Clean module boundary** (`ui-issue-list.ts`): row types, builders, navigation, renderers, and the widget factory are all exported as pure/testable units separate from side-effecting UI integration code. This makes the logic easy to test independently.

- **Discriminated union types** (`IssueListRow`, `IssueListViewState`, `WidgetView`): exhaustive union with `kind`/`screen` discriminants makes screen-state handling explicit and type-safe throughout `showIssueListUI`.

- **Immutable cursor updates**: `handleInput` always creates new view objects (`view = { ... }`) rather than mutating in place — consistent with the widget rendering pattern.

- **Non-regression preserved** (`ui.ts` lines 451–480): the original `ctx.ui.select()` fallback path is left intact and covered by the existing `ui-issue-command-list.test.ts` test, ensuring environments without `ctx.ui.custom` continue to work.

- **Error surfacing for `go-to-done`** (`ui.ts` line 432–435): `handleSignal` errors are surfaced via `ctx.ui.notify` rather than silently swallowed, so users see why a transition failed when the active issue is in a non-adjacent phase.

- **Tests are deterministic and pure**: the six pure-function test files (`rows`, `navigation`, `actions`, `detail`) have zero I/O dependencies and no mocks of implementation details — they test behavior against real outputs.

---

## Findings

### Critical

None.

### Important

**1. Missing test for archiving the active issue via the widget (`tests/ui-issue-command-archive-action.test.ts`)**

The original test only covered archiving a non-active issue. The active-issue branch in `ui.ts` (lines 390–399):
```typescript
if (state.activeIssue === result.issue.slug) {
  const resetState = { ...createInitialState(), megaEnabled: ..., branchName: ..., baseBranch: ... };
  writeState(ctx.cwd, resetState);
  ...
  return resetState;
}
```
...was entirely uncovered. This is important behavior: archiving the active issue must reset `activeIssue` and `phase` to null. A regression here would leave the system pointing at an archived issue.

**Fix applied:** Added a second test case to `ui-issue-command-archive-action.test.ts` that sets the active issue, archives it via the widget, and asserts `nextState.activeIssue === null` and `nextState.phase === null`. 935 tests pass after fix.

### Minor

**1. Unused `_width` parameter in `renderIssueListScreen` and `renderIssueDetailScreen`**

Both renderers accept a `width` parameter (prefixed `_width`) but never use it — long issue titles or descriptions are not truncated. This is intentional for now (out-of-scope visual polish), and the underscore prefix signals intentionality. No action required, but callers should not assume text fits within the given width.

**2. Runtime duck-typing for `ctx.ui.custom` (`ui.ts` line 355)**

```typescript
if (typeof (ctx.ui as any).custom === "function") {
```

The `as any` cast is necessary because `ExtensionContext.ui` doesn't declare `custom` in its type definition. This is a pragmatic workaround for the pi TUI API. If `custom` is eventually added to the `ExtensionContext` type, this cast can be removed. Not a correctness issue — behavior degrades gracefully to the fallback path.

**3. `go-to-done` option shown for all active issues regardless of phase**

`buildIssueActionItems` always includes `Go to done phase` when `issue.slug === activeIssueSlug`. This means users in `brainstorm` or `spec` phase will see the option, attempt it, and receive an error notification. This is acceptable behavior (the spec says "performs the existing action for moving to done phase"), but could be confusing UX. No code change needed; noted for future UX polish.

---

## Recommendations

- **Typed `custom` interface**: Consider adding a typed `custom<T>(factory: ...) => Promise<T>` declaration to the extension context type so the `as any` cast in `ui.ts:355` can be removed. This is a pi-level concern, not this issue's responsibility.
- **Width-aware truncation**: When visual polish becomes in-scope, `renderIssueListScreen` and `renderIssueDetailScreen` should use the `width` parameter to truncate/wrap long content.
- **`go-to-done` guard**: Could limit the option to phases where `"done"` is a reachable next transition, reducing friction. Low priority given current scope.

---

## Assessment

**ready**

The implementation is well-structured with clean module boundaries, good type safety, and meaningful tests covering both pure logic and integration paths. One important gap — missing test for archiving the active issue via the widget — was identified and **fixed in this session** (test added to `tests/ui-issue-command-archive-action.test.ts`, 935 tests pass). No critical issues found. Minor findings are either intentional design choices or out-of-scope polish items.
