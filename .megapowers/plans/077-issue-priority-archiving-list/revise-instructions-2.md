## Task 4: Add pure active-issue sorting grouping and triage filtering helpers

This task currently bundles **four helper behaviors** into one test case (`sortActiveIssues`, `buildMilestoneIssueSections`, `formatActiveIssueListItem`, `filterTriageableIssues`). That violates the plan quality bar for task granularity (one behavior per test step) and makes Step 2 failures ambiguous.

### Required revisions

1. **Step 1:** Split the single `it(...)` into focused tests in the same file:
   - one test for `sortActiveIssues()` ordering (AC4–AC6)
   - one test for `buildMilestoneIssueSections()` grouping (AC7)
   - one test for `formatActiveIssueListItem()` content fields (AC8–AC11)
   - one test for `filterTriageableIssues()` excluding archived/done/batch issues (AC13)

2. **Step 2:** Update expected failure text to match the first failing behavior after test split. Example acceptable failure:
   - `Expected: [1, 2, 3, 4]`
   - `Received: [4, 2, 1, 3]`
   or missing-export failure if helper exports are still absent.

3. **Step 3:** Keep implementation focused on helper functions only (no unrelated file-wide rewrites).
   Use the existing `Issue` type from `extensions/megapowers/state/store.ts` and export the new helpers from `extensions/megapowers/ui.ts`.

---

## Task 5: Use grouped active issues in issue list and add archived view subcommand

Task 5 implementation guidance is not self-contained enough: the current Step 3 snippets are disconnected and don’t clearly specify where each branch belongs inside `handleIssueCommand()`.

### Required revisions

1. **Step 3:** Provide explicit insertion points in `handleIssueCommand()`:
   - add `if (subcommand === "archived")` branch **after** `new/create` handling and **before** `list`
   - update existing `list` branch to render milestone headers + grouped items
   - keep unknown-subcommand branch at the end

2. **Step 3:** Ensure header rows cannot be selected by parsing rule, not prefix heuristics. Replace:

```ts
if (choice.startsWith("M") || choice.startsWith("none:")) return state;
```

with a robust guard:

```ts
const idMatch = choice.match(/^#(\d+)/);
if (!idMatch) return state;
```

3. **Step 1:** Add an assertion that archived items are absent from default list output and present only in `/issue archived` output (this is already partially present—keep both explicit assertions).

---

## Task 7: Exclude archived issues from idle prompt open-issues summary

The dependency metadata is over-constrained and blocks parallelizable work.

### Required revisions

1. **Frontmatter:** Change

```yaml
depends_on:
  - 1
  - 2
  - 5
```

to:

```yaml
depends_on:
  - 1
```

2. **Task heading annotation:** Change

`[depends: 1, 2, 5]`

to

`[depends: 1]`

3. Keep the implementation filter in `buildIdlePrompt()` exactly aligned to active issues:

```ts
const issues = store.listIssues().filter(i => i.status !== "done" && i.status !== "archived");
```

No additional UI/list dependencies are needed for this task.