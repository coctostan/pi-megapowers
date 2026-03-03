---

## Verification Report

## Test Suite Results
```
377 pass, 0 fail, 681 expect() calls
Ran 377 tests across 15 files. [97.00ms]
```

## Per-Criterion Verification

### Criterion 1: Issue frontmatter supports optional `sources` field
**Evidence:** `store.ts:93` writes `sources: [${issue.sources.join(", ")}]` in frontmatter when sources exist. Tests `sources field > parses sources from issue frontmatter into number array` and `creates an issue with sources in frontmatter` both pass.
**Verdict:** pass

### Criterion 2: `parseIssueFrontmatter` parses `sources` into number array
**Evidence:** `store.ts:71-80` — regex parses `sources: [6, 13, 17]` into `number[]`. Issues without sources get `[]` (`store.ts:89` returns `sources` in parsed output, callers default to `[]`). Four tests pass covering parsing, empty array, empty brackets, and listIssues.
**Verdict:** pass

### Criterion 3: `store.getSourceIssues(slug)` returns full Issue objects
**Evidence:** Implementation at `store.ts` filters `listIssues()` by source ID set. Test `getSourceIssues > returns Issue objects for each source ID` verifies id and title of returned issues.
**Verdict:** pass

### Criterion 4: `store.getSourceIssues(slug)` returns empty array for non-batch
**Evidence:** Test `getSourceIssues > returns empty array for non-batch issue` passes. Implementation returns `[]` when `issue.sources.length === 0`.
**Verdict:** pass

### Criterion 5: `store.getBatchForIssue(issueId)` returns batch slug or null
**Evidence:** Implementation iterates all issues, checks `sources.includes(issueId)` and `status === "open" || "in-progress"`. Five tests pass covering open, in-progress, not-in-batch, done-batch, and multiple-batch scenarios.
**Verdict:** pass

### Criterion 6: `/triage` reads open issues and formats them as context
**Evidence:** `handleTriageCommand` filters `status !== "done"`, formats as list, calls `ctx.ui.notify`. Test `displays open issues in notification` confirms notification contains issue titles. Command registered at `index.ts` as `"triage"`.
**Verdict:** pass

### Criterion 7: `/triage` creates issue with type, sources, and description
**Evidence:** Test `creates a batch issue with sources and activates it` verifies `batchIssue.sources === [1, 3]` and `batchIssue.type === "bugfix"`. Implementation calls `store.createIssue(title, type, description, sources)`.
**Verdict:** pass

### Criterion 8: `/triage` activates batch issue and enters first workflow phase
**Evidence:** Implementation calls `getFirstPhase(type)` (brainstorm for feature, reproduce for bugfix), sets `activeIssue: issue.slug`, `workflow: type`, `phase: firstPhase`. Test verifies `result.activeIssue` is not null after creation.
**Verdict:** pass

### Criterion 9: `before_agent_start` injects source issue content
**Evidence:** `index.ts` checks `issue.sources.length > 0`, calls `store.getSourceIssues`, `buildSourceIssuesContext`, then appends to `finalPrompt`. Import and call confirmed in grep output.
**Verdict:** pass

### Criterion 10: Source issue injection applies to all phases
**Evidence:** The injection is in the `before_agent_start` handler which runs unconditionally for every phase (no phase filter around the source injection block). It runs after template loading and before returning the prompt.
**Verdict:** pass

### Criterion 11: `formatIssueListItem` appends "(in batch XXX)"
**Evidence:** Function signature `formatIssueListItem(issue: Issue, batchSlug?: string | null)` appends ` (in batch ${batchSlug})` when truthy. Call site passes `store.getBatchForIssue(i.id)`. Three tests pass.
**Verdict:** pass

### Criterion 12: Done phase "Close issue" marks source issues as done
**Evidence:** `closeSourceIssues` called in both "Close issue" and "Done" branches before `updateIssueStatus`. Tests verify `bugA.status === "done"` and `bugB.status === "done"` after close.
**Verdict:** pass

### Criterion 13: Batch issue itself marked done (existing behavior)
**Evidence:** `store.updateIssueStatus(state.activeIssue, "done")` called immediately after `closeSourceIssues` in both branches. Test `closes source issues when batch issue is closed via 'Close issue'` verifies `newState.activeIssue === null` (state reset after close).
**Verdict:** pass

### Criterion 14: Triage prompt template exists with grouping instructions
**Evidence:** `prompts/triage.md` exists, contains `{{open_issues}}` placeholder, instructions for grouping by type affinity, code affinity, dependency, and complexity. Three tests pass.
**Verdict:** pass

### Criterion 15: `createIssue` accepts optional `sources` parameter
**Evidence:** Interface: `createIssue(title, type, description, sources?: number[]): Issue`. Implementation writes `sources: [...]` to frontmatter when `sources.length > 0`. Two tests pass.
**Verdict:** pass

### Criterion 16: `Issue` type includes `sources: number[]`
**Evidence:** `store.ts:17` — `sources: number[]` in `export interface Issue`.
**Verdict:** pass

## Overall Verdict
**pass** — All 16 acceptance criteria are met with test coverage and code inspection evidence. 377 tests pass with 0 failures.