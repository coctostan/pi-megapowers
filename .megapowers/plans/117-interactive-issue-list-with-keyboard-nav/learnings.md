# Learnings: 117-interactive-issue-list-with-keyboard-nav

- **Separate pure logic from widget wiring from integration dispatch.** The `ui-issue-list.ts` module cleanly splits into three layers: pure data functions (`buildIssueListRows`, `moveIssueListCursor`, `buildIssueActionItems`), pure renderers (`renderIssueListScreen`, `renderIssueDetailScreen`), and the stateful widget factory (`showIssueListUI`). This made every layer independently testable without mocking the TUI runtime.

- **A `driveWidget` test helper that feeds synthetic key sequences pays off immediately.** Rather than mocking individual key handlers, the `driveWidget` helper in `ui-issue-command-custom-list.test.ts` runs the actual `showIssueListUI` factory with a minimal fake `tui` object and replays raw escape sequences. This tests the real input-dispatch logic without any TUI dependency, catches regressions in the full screen-state machine, and reads almost like a user story.

- **Discriminated union screen states eliminate impossible `if` nesting.** The `WidgetView` union (`list | menu | detail`) meant each `handleInput` branch could be written as a simple guard with no shared mutable cursor that could drift. Contrast with an approach that uses `mode` flags and boolean guards — that pattern tends to accumulate cross-cutting `if (inMenu && !inDetail)` conditions.

- **Missing coverage on a non-trivial branch (`archive` of the active issue) was caught in code review, not in spec/plan.** The spec called out archive behavior in AC 18 but didn't enumerate both sub-cases. The plan test step only covered the non-active case. The code-review phase caught the gap. Worth adding explicit sub-case enumeration to AC descriptions when a single action has state-dependent side effects.

- **`ctx.ui.custom` duck-typing (`typeof ... === "function"`) is the right short-term bridge** when the underlying platform type doesn't yet declare the API. It degrades gracefully to the fallback path and doesn't require changing the extension context interface. Flag for removal if `custom` is ever added to `ExtensionContext`.

- **The `go-to-done` stub code-review.md creation is a pragmatic gate bypass** that should be documented. When the user selects "Go to done phase" from code-review phase, the handler writes a minimal `code-review.md` so the `phase_next` gate passes. This is correct behavior but easy to miss — it's the kind of side effect that should appear explicitly in the action's description, not just in the implementation.

- **Unused `_width` parameters are intentional design hooks, not dead code.** Both `renderIssueListScreen` and `renderIssueDetailScreen` accept `width` but don't use it for truncation yet. Naming them `_width` signals intent. When terminal-aware formatting is added later, the signature is already correct; no callsite changes needed.
