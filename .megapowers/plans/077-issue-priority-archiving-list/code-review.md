# Code Review — 077-issue-priority-archiving-list

## Files Reviewed

- `extensions/megapowers/state/store.ts` — Added `IssueStatus: "archived"`, `listArchivedIssues()`, `archiveIssue()`, `readIssuesFromDir()` helper, `archiveDir` constant, `formatIssueFile` archive timestamp support
- `extensions/megapowers/ui.ts` — Added `sortActiveIssues`, `buildMilestoneIssueSections`, `formatActiveIssueListItem`, `formatMilestoneHeader`, `formatArchivedIssueList`; updated `filterTriageableIssues`; added `archive` and `archived` subcommands to `handleIssueCommand`
- `extensions/megapowers/prompt-inject.ts` — Added `status !== "archived"` filter to idle prompt issue list
- `tests/store-archive-listing.test.ts` — New: listing separation tests (AC1-AC3)
- `tests/store-archive-operation.test.ts` — New: archive operation tests (AC14-AC22) + review-added ID uniqueness test
- `tests/store-archive-errors.test.ts` — New: error path tests (AC23-AC24)
- `tests/ui-issue-list.test.ts` — New: sorting, grouping, formatting, filtering helpers tests (AC4-AC13)
- `tests/ui-issue-command-list.test.ts` — New: command-level list + archived subcommand test (AC7-AC12, AC28, AC30)
- `tests/ui-issue-archive-command.test.ts` — New: archive subcommand state-reset tests (AC25-AC27)
- `tests/prompt-inject-archived.test.ts` — New: prompt filter test (AC29)

---

## Strengths

- **Clean directory-based separation** (`store.ts:140`): Active and archived issues live in sibling dirs (`issues/` vs `issues/archive/`). `readIssuesFromDir` reads non-recursively so no special-casing needed — archived files simply never appear in active queries.
- **`readIssuesFromDir` extraction** (`store.ts:111`): Well-factored helper that DRYs up both `listIssues` and `listArchivedIssues` with zero duplication.
- **Atomic-style archive operation** (`store.ts:171`): Error checks (`archivedPath` exists, `activePath` missing) happen before any mutation, minimising the window for partial state.
- **`sortActiveIssues` is a pure function** (`ui.ts:207`): Non-mutating sort (creates a copy), easy to test in isolation.
- **Full spec coverage**: All 30 acceptance criteria have dedicated test assertions and pass.
- **State reset on active-issue archive** (`ui.ts:400`): Preserves `megaEnabled`, `branchName`, and `baseBranch` from the old state — the right fields to carry over.
- **`filterTriageableIssues` defence-in-depth** (`ui.ts:249`): Explicitly filters both `done` and `archived`, so manual status manipulation in the active directory doesn't leak archived issues into triage flows.

---

## Findings

### Critical

None.

### Important

**[FIXED] ID reuse after archiving — `store.ts:createIssue`**

`createIssue` computed the next issue ID by scanning only `issuesDir` for existing filenames:
```ts
// Before fix
const existing = readdirSync(issuesDir).filter((f) => f.endsWith(".md"));
```
After archiving issue #3 and creating a new issue, the scan returned max=2, so the new issue was assigned ID 3 — identical to the archived one. Two issues (one archived, one active) would share the same numeric ID, creating ambiguity in references (`#003`), batch-source lookups, and any future cross-index queries.

**Fix applied** (`store.ts:createIssue`, line ~196): The scan now unions both active and archive directories before computing `maxId`:
```ts
const existing = [
  ...readdirSync(issuesDir).filter((f) => f.endsWith(".md")),
  ...readdirSync(archiveDir).filter((f) => f.endsWith(".md")),
];
```
New test `"store.createIssue ID uniqueness after archiving"` in `store-archive-operation.test.ts` covers this path. All 916 tests pass.

### Minor

**[FIXED] Error help text omitted `archive` subcommand** (`ui.ts:416`)

The fallthrough `notify` said `"Use: new, list, archived"` but omitted `archive`. Fixed to `"Use: new, list, archive, archived"`.

**[FIXED] Missing blank line between `formatArchivedIssueList` and `filterTriageableIssues`** (`ui.ts:247`)

Cosmetic — single blank line added for readability consistency.

**`sortActiveIssues` used for archived issues** (`ui.ts:335`)

`sortActiveIssues(store.listArchivedIssues())` works fine functionally (same sort logic is appropriate), but the function name is slightly misleading in this context. No change made — renaming would be over-engineering for a private sort utility; the name accurately reflects the primary path.

**`milestoneRank` only handles `M\d+` format** (`ui.ts:201`)

Milestones not matching `/^M(\d+)$/i` all sort to `MAX_SAFE_INTEGER` (last). This is consistent with the codebase's milestone convention and the spec says milestone creation semantics are out of scope. No change needed.

**`archiveIssue` redundant double-read** (`store.ts:180–183`)

`existsSync(activePath)` is checked then `this.getIssue(slug)` immediately re-reads the same file. The second null check (`if (!current)`) is dead code given `existsSync` just passed. Not harmful, but slightly redundant. Left as-is since the defensive null guard has negligible cost.

**Partial-failure inconsistency** (`store.ts:189–190`)

If `writeFileSync(archivedPath, …)` succeeds but the process crashes before `rmSync(activePath)`, the file exists in both dirs. A subsequent `archiveIssue` call returns `"Issue already archived"` while the active file still exists. Extremely unlikely in practice and no worse than similar POSIX rename semantics. No change needed for V1.

---

## Recommendations

- If issue IDs are ever exposed in URLs or external integrations, consider a monotonic ID counter stored in state rather than deriving from filenames. The current max-filename approach is resilient but depends on filenames not diverging from IDs.
- The `archiveIssue` TOCTOU window (write + delete) could be made atomic with `fs.renameSync(activePath, archivedPath)` followed by a frontmatter rewrite in place. Simpler and crash-safe. Worth considering in a follow-up.
- `buildMilestoneIssueSections` uses a linear `sections.find()` inside a loop (O(n²)). A `Map<string, MilestoneIssueSection>` would be O(n). Not a concern at current issue counts, but easy to fix if sections grow.

---

## Assessment

**ready**

One important bug (ID reuse after archive) was identified and fixed in this session. Two minor style issues were also corrected. All 916 tests pass. The implementation is clean, well-tested, and correctly addresses all 30 acceptance criteria.
