## Task 7: Document tool mapping plus injected-prompt coverage

Step 3’s `docs/phase-tools.md` block does not match the exact string produced by Step 1’s `renderPhaseToolsDoc()` helper.

In `task-007.md`, the renderer at lines 156-169 emits:
- a blank line after the title
- a blank line after the intro paragraph
- exactly one blank line between each table and the next `## prompts/...` header

But the Step 3 “Use this exact content” block starts with:

```md
# Phase Tool Guidance Map
Prompt markdown in `prompts/*.md` is the source of truth. This file is a review index for issue #127 and the drift-check target for the tests in `tests/phase-tool-guidance.test.ts`.
## prompts/brainstorm.md
```

That is missing the blank line before `## prompts/brainstorm.md`. The same block also inserts double blank lines between some sections (for example between the `brainstorm.md` and `write-spec.md` tables), while the renderer emits only one.

Replace the Step 3 doc block so it matches the renderer output byte-for-byte. The opening must be:

```md
# Phase Tool Guidance Map

Prompt markdown in `prompts/*.md` is the source of truth. This file is a review index for issue #127 and the drift-check target for the tests in `tests/phase-tool-guidance.test.ts`.

## prompts/brainstorm.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `read` | `## Read first` | Prefer structural-map reads on unfamiliar files. |
| `symbol_graph` | `## Read first` | Confirm named symbols exist and inspect callers. |
| `symbol_graph` | `## Read first` | Preserve current contracts when brainstorming changes to existing symbols. |
| `grep` | `## Read first` | Handle text mentions. |
| `ast_search` | `## Read first` | Handle structural patterns. |
| `bash` | `## Read first` | Skim recent history with `git log --oneline -20 -- <path>`. |

## prompts/write-spec.md
```

Apply that same spacing rule throughout the whole file: exactly one blank line between every prompt table and the next prompt header.

Keep the Step 1 exact-equality test unchanged:
`expect(readPhaseToolsDoc().trim()).toBe(renderPhaseToolsDoc(phaseToolDoc))`

Fix Step 3 so a developer can paste the instructed `docs/phase-tools.md` content and make that assertion pass on the first try.
