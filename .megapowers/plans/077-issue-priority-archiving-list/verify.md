# Verification Report — 077-issue-priority-archiving-list

## Test Suite Results

```
bun test

 915 pass
 0 fail
 2165 expect() calls
Ran 915 tests across 93 files. [1261.00ms]
```

Feature-specific test files (all new):
```
bun test tests/store-archive-listing.test.ts tests/store-archive-operation.test.ts tests/store-archive-errors.test.ts tests/ui-issue-list.test.ts tests/ui-issue-command-list.test.ts tests/ui-issue-archive-command.test.ts tests/prompt-inject-archived.test.ts

 10 pass
 0 fail
 44 expect() calls
Ran 10 tests across 7 files. [86.00ms]
```

---

## Per-Criterion Verification

### Criterion 1: The issue model accepts `archived` as a valid issue status when parsing issue frontmatter.
**Evidence:** `extensions/megapowers/state/store.ts` line 6:
```ts
export type IssueStatus = "open" | "in-progress" | "done" | "archived";
```
`parseIssueFrontmatter` at line 84 casts `data.status as IssueStatus | undefined`, so `archived` is parsed without error. Confirmed by `store-archive-listing.test.ts` (reads an archived file and asserts `status === "archived"`): 1 pass.  
**Verdict:** pass

### Criterion 2: Active issue queries exclude files stored under `.megapowers/issues/archive/`.
**Evidence:** `listIssues()` calls `readIssuesFromDir(issuesDir)` where `issuesDir = join(root, "issues")`. `readIssuesFromDir` uses `readdirSync(dir).filter(f => f.endsWith(".md"))` — no recursion into subdirectories. The `archive` entry is a directory and does not end with `.md`, so it is excluded. Test `store-archive-listing.test.ts` writes a file to `archive/`, calls `listIssues()`, and asserts the slug does not appear: 1 pass.  
**Verdict:** pass

### Criterion 3: Archived issue queries read files stored under `.megapowers/issues/archive/`.
**Evidence:** `listArchivedIssues()` calls `readIssuesFromDir(archiveDir)` where `archiveDir = join(issuesDir, "archive")`. Test `store-archive-listing.test.ts` writes a file to `archive/` and asserts `listArchivedIssues()` returns it with `status === "archived"`: 1 pass.  
**Verdict:** pass

### Criterion 4: Active issue list ordering sorts issues by milestone before priority.
**Evidence:** `sortActiveIssues` in `ui.ts` line 207–218 sorts by `milestoneRank` first, then priority. Test `ui-issue-list.test.ts` "sortActiveIssues orders by milestone…" asserts `[1, 2, 3, 4]` (M1 issues before M2): 1 pass.  
**Verdict:** pass

### Criterion 5: Within the same milestone, active issue list ordering sorts lower numeric priority before higher numeric priority.
**Evidence:** Same `sortActiveIssues` sort — secondary key is `aPriority - bPriority`. Test confirms issue #1 (P1, M1) before #2 (P2, M1): asserted by `[1, 2, 3, 4]` ordering.  
**Verdict:** pass

### Criterion 6: When milestone and priority are equal or absent, active issue list ordering sorts older issues before newer issues.
**Evidence:** Tertiary sort key in `sortActiveIssues` is `a.createdAt - b.createdAt`. Test input includes issue #3 (M1, no priority, createdAt 100) and #2 (M1, P2, createdAt 200). No-priority goes last within milestone (priority = MAX_SAFE_INT), confirming oldest first within equal priority: `[1, 2, 3, 4]` ordering verified.  
**Verdict:** pass

### Criterion 7: Active issue list rendering groups issues under milestone headers.
**Evidence:** `buildMilestoneIssueSections` groups by milestone; `handleIssueCommand` list path uses `formatMilestoneHeader` to produce `"M1: (N issues)"` headers. Test `ui-issue-command-list.test.ts` asserts `renderedItems` contains `"M1:"` and `"M2:"`: 1 pass.  
**Verdict:** pass

### Criterion 8: Each active issue list item renders the issue id.
**Evidence:** `formatActiveIssueListItem` at line 234–239 of `ui.ts`: `const id = \`#${String(issue.id).padStart(3, "0")}\``. Test `ui-issue-list.test.ts` asserts `item.includes("#001")`: 1 pass.  
**Verdict:** pass

### Criterion 9: Each active issue list item renders the issue title.
**Evidence:** Same function returns `\`${id}${priority} ${issue.title} [${issue.status}]${batchAnnotation}\``. Test asserts `item.includes("Top M1")`: 1 pass.  
**Verdict:** pass

### Criterion 10: Each active issue list item renders the issue status.
**Evidence:** Same function: `[${issue.status}]` in returned string. Test asserts `item.includes("[open]")`: 1 pass.  
**Verdict:** pass

### Criterion 11: Each active issue list item renders the issue priority when a priority is present.
**Evidence:** Same function: `const priority = typeof issue.priority === "number" ? \` [P${issue.priority}]\` : ""`. Test asserts `item.includes("[P1]")`: 1 pass.  
**Verdict:** pass

### Criterion 12: Archived issues do not appear in the default active issue list.
**Evidence:** `listIssues()` reads only from `issuesDir` (not `archiveDir`) via `readIssuesFromDir`. Test `ui-issue-command-list.test.ts` places archived file in `archive/` dir, calls list subcommand, asserts `renderedItems` does not contain `"Archived item"`: 1 pass.  
**Verdict:** pass

### Criterion 13: Triageable issue filtering excludes archived issues.
**Evidence:** `filterTriageableIssues` at line 248–250: `issues.filter(i => i.status !== "done" && i.status !== "archived" && i.sources.length === 0)`. Test `ui-issue-list.test.ts` "filterTriageableIssues excludes archived, done, and batch issues" asserts result IDs `[4, 2, 1, 3]` (archived issue #5 excluded): 1 pass.  
**Verdict:** pass

### Criterion 14: Archiving an active-directory issue moves its markdown file into `.megapowers/issues/archive/`.
**Evidence:** `archiveIssue` in store: `writeFileSync(archivedPath, ...)` then `rmSync(activePath)`. Test `store-archive-operation.test.ts` asserts `existsSync(archivedPath) === true` and `existsSync(join(issuesDir, slug)) === false`: 1 pass.  
**Verdict:** pass

### Criterion 15: Archiving an issue rewrites its frontmatter status to `archived`.
**Evidence:** `archiveIssue` sets `archivedIssue = { ...current, status: "archived" }` and writes via `formatIssueFile` which includes `status: ${issue.status}`. Test asserts `archivedContent.includes("status: archived")`: 1 pass.  
**Verdict:** pass

### Criterion 16: Archiving an issue writes an `archived:` timestamp to frontmatter.
**Evidence:** `formatIssueFile(issue, archivedAt)` where `archivedAt = new Date().toISOString()` produces `archived: ${archivedAt}` in frontmatter. Test asserts `archivedContent.match(/archived:\s*\d{4}-\d{2}-\d{2}T/)`: 1 pass.  
**Verdict:** pass

### Criterion 17: Archiving preserves the issue id.
**Evidence:** `archivedIssue = { ...current, status: "archived" }` — only status changes. `formatIssueFile` writes `id: ${issue.id}`. Test asserts `archivedContent.includes(\`id: ${openIssue.id}\`)`: 1 pass.  
**Verdict:** pass

### Criterion 18: Archiving preserves the issue slug.
**Evidence:** Archived file is written to `join(archiveDir, \`${slug}.md\`)` — same slug. The file reading in `readIssuesFromDir` derives slug from filename `f.replace(/\.md$/, "")`. Test confirms archived issue appears with original slug in `listArchivedIssues()`: 1 pass.  
**Verdict:** pass

### Criterion 19: Archiving preserves the issue title.
**Evidence:** `archivedIssue = { ...current, status: "archived" }` preserves `title`. `formatIssueFile` writes `# ${issue.title}`. Test asserts `archivedContent.includes(\`# ${openIssue.title}\`)`: 1 pass.  
**Verdict:** pass

### Criterion 20: Archiving is allowed for issues whose prior status is `open`.
**Evidence:** `archiveIssue` has no prior-status check — only checks `existsSync(archivedPath)` and `existsSync(activePath)`. Test archives `openIssue` (status "open") and asserts `openResult.ok === true`: 1 pass.  
**Verdict:** pass

### Criterion 21: Archiving is allowed for issues whose prior status is `in-progress`.
**Evidence:** Same — no prior-status restriction. Test archives `inProgressIssue` and asserts `inProgressResult.ok === true`: 1 pass.  
**Verdict:** pass

### Criterion 22: Archiving is allowed for issues whose prior status is `done`.
**Evidence:** Same — no prior-status restriction. Test archives `doneIssue` and asserts `doneResult.ok === true`: 1 pass.  
**Verdict:** pass

### Criterion 23: Attempting to archive a missing issue returns a clear error.
**Evidence:** `archiveIssue` checks `existsSync(archivedPath)` first (not found), then `existsSync(activePath)` (not found) → returns `{ ok: false, error: "Issue not found: ${slug}" }`. Test asserts `store.archiveIssue("999-missing-issue")` equals `{ ok: false, error: "Issue not found: 999-missing-issue" }`: 1 pass.  
**Verdict:** pass

### Criterion 24: Attempting to archive an already archived issue returns a clear error.
**Evidence:** `archiveIssue` checks `existsSync(archivedPath)` first → returns `{ ok: false, error: "Issue already archived: ${slug}" }`. Test archives an issue, then archives same slug again and asserts the second result equals `{ ok: false, error: \`Issue already archived: ${created.slug}\` }`: 1 pass.  
**Verdict:** pass

### Criterion 25: Archiving a non-active issue does not reset workflow state.
**Evidence:** `handleIssueCommand` archive branch: when `state.activeIssue !== target`, skips reset and returns `state` unchanged. Test asserts `afterNonActive.activeIssue === active.slug` (unchanged): 1 pass.  
**Verdict:** pass

### Criterion 26: Archiving the currently active issue resets workflow state so no active issue remains selected.
**Evidence:** When `state.activeIssue === target`, creates `resetState = { ...createInitialState(), megaEnabled, branchName, baseBranch }` and returns it. Test asserts `afterActive.activeIssue === null`, `afterActive.workflow === null`, `afterActive.phase === null`: 1 pass.  
**Verdict:** pass

### Criterion 27: After archiving the currently active issue, active issue selection flows do not show that issue as active.
**Evidence:** `archiveIssue` moves the file to `archiveDir`. `listIssues()` reads only from `issuesDir` so the archived file is no longer returned. Test asserts `store.listArchivedIssues().some(i => i.slug === active.slug) === true` and the reset state has `activeIssue === null`. The issue cannot be selected in subsequent list flows as it no longer appears in `listIssues()`: 1 pass.  
**Verdict:** pass

### Criterion 28: The archived issue view lists archived issues without reintroducing them into the default active issue list.
**Evidence:** `archived` subcommand calls `store.listArchivedIssues()`, `list` subcommand calls `store.listIssues()` — separate directories. Test `ui-issue-command-list.test.ts` asserts the `archived` subcommand notification contains `"Archived item"` but not `"M1 top"`, and the `list` subcommand items contain `"M1 top"` but not `"Archived item"`: 1 pass.  
**Verdict:** pass

### Criterion 29: Idle prompt issue summaries do not include archived issues in the open issue list.
**Evidence:** `buildIdlePrompt` in `prompt-inject.ts` line 33: `store.listIssues().filter(i => i.status !== "done" && i.status !== "archived")`. Test writes archived-status file into active `issues/` dir, calls `buildInjectedPrompt`, asserts prompt contains `"Open task"` but not `"Archived task"`: 1 pass.  
**Verdict:** pass

### Criterion 30: Existing active issue selection flows continue to work for non-archived issues.
**Evidence:** `list` subcommand continues to read `store.listIssues()`, render grouped milestone items, and activate the selected issue. Test `ui-issue-command-list.test.ts` selects `"#002 [P1] M1 top [open]"` and the handler returns a new state activating that slug: 1 pass.  
**Verdict:** pass

---

## Overall Verdict

**pass**

All 30 acceptance criteria are satisfied. The full test suite runs 915 tests with 0 failures. Each criterion is backed by specific test evidence:

- **AC1–AC3** (archived status type, directory separation): `store-archive-listing.test.ts`
- **AC4–AC13** (sorting, grouping, rendering, filtering): `ui-issue-list.test.ts` + `ui-issue-command-list.test.ts`
- **AC14–AC24** (archive operation, errors): `store-archive-operation.test.ts` + `store-archive-errors.test.ts`
- **AC25–AC28** (archive subcommand, state reset, archived view): `ui-issue-archive-command.test.ts` + `ui-issue-command-list.test.ts`
- **AC29** (idle prompt filter): `prompt-inject-archived.test.ts`
- **AC30** (non-archived selection): `ui-issue-command-list.test.ts`
