## Task 4: Add pure active-issue sorting grouping and triage filtering helpers

Step 3 has a runtime bug in `sortActiveIssues()` and is missing the final AC6 fallback.

### Fix the comparator
Your current snippet has:
```ts
const bPriority = typeof b.priority === "number" ? b.priority : Number.MAX_SAFE_INTEGER;
if (aPriority !== bPriority) return aPriority - bPriority;
```
That references `aPriority` before declaration, which will throw a `ReferenceError` the first time the comparator runs.

Replace the comparator body with:
```ts
export function sortActiveIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const milestoneCmp = milestoneRank(a.milestone) - milestoneRank(b.milestone);
    if (milestoneCmp !== 0) return milestoneCmp;

    const aPriority = typeof a.priority === "number" ? a.priority : Number.MAX_SAFE_INTEGER;
    const bPriority = typeof b.priority === "number" ? b.priority : Number.MAX_SAFE_INTEGER;
    if (aPriority !== bPriority) return aPriority - bPriority;

    return a.createdAt - b.createdAt;
  });
}
```
This matches the actual `Issue` shape in `extensions/megapowers/state/store.ts` (`milestone?: string`, `priority?: number`, `createdAt: number`) and fully covers AC4-AC6.

### Keep the helper exports consistent with `ui.ts`
Add the new exported helpers alongside the existing pure helpers in `extensions/megapowers/ui.ts`:
- `sortActiveIssues(issues: Issue[]): Issue[]`
- `buildMilestoneIssueSections(issues: Issue[]): MilestoneIssueSection[]`
- `formatActiveIssueListItem(issue: Issue, batchSlug?: string | null): string`

Do not remove the existing `filterTriageableIssues()` export; update it in place to:
```ts
export function filterTriageableIssues(issues: Issue[]): Issue[] {
  return issues.filter(i => i.status !== "done" && i.status !== "archived" && i.sources.length === 0);
}
```

## Task 5: Use grouped active issues in issue list and add archived view subcommand

Step 3’s `if (subcommand === "list")` replacement is incomplete: it uses `choice` and `firstPhase` without defining them. In the real codebase, `extensions/megapowers/ui.ts` already imports `getFirstPhase` from `./state/state-machine.js`, so you do **not** need a new import. You need to restore the missing lines inside the replacement block.

### Add the missing select call
After building `items`, insert the same select call pattern used by the current implementation:
```ts
const choice = await ctx.ui.select("Pick an issue:", items);
if (!choice) return state;
```
Without this, `choice` is undefined and the task cannot pass.

### Add the missing first-phase lookup before building `newState`
Right before `const newState: MegapowersState = { ... }`, insert:
```ts
const firstPhase = getFirstPhase(selected.type);
```
The current `newState` snippet sets `phase: firstPhase`, so this variable must be defined.

### Use a non-duplicating archived formatter
Your archived formatter currently appends ` [archived]` to `formatActiveIssueListItem(i)`, but `formatActiveIssueListItem()` already includes the issue status. That would render archived items with a duplicated archived marker.

Use this instead:
```ts
export function formatArchivedIssueList(issues: Issue[]): string {
  return issues.map(i => formatActiveIssueListItem(i)).join("\n");
}
```

### The final `list` block should look like this shape
```ts
if (subcommand === "list") {
  const issues = sortActiveIssues(store.listIssues().filter(i => i.status !== "done"));
  if (issues.length === 0) {
    ctx.ui.notify("No open issues. Use /issue new to create one.", "info");
    return state;
  }

  const sections = buildMilestoneIssueSections(issues);
  const items = sections.flatMap(section => [
    formatMilestoneHeader(section.milestone, section.issues),
    ...section.issues.map(i => formatActiveIssueListItem(i, store.getBatchForIssue(i.id))),
  ]);
  items.push("+ Create new issue...");

  const choice = await ctx.ui.select("Pick an issue:", items);
  if (!choice) return state;
  if (choice.startsWith("+")) return this.handleIssueCommand(ctx, state, store, "new");

  const idMatch = choice.match(/^#(\d+)/);
  if (!idMatch) return state;
  const selected = issues.find((i) => i.id === parseInt(idMatch[1]));
  if (!selected) return state;

  const firstPhase = getFirstPhase(selected.type);
  const newState: MegapowersState = {
    ...state,
    activeIssue: selected.slug,
    workflow: selected.type,
    phase: firstPhase,
    phaseHistory: [],
    reviewApproved: false,
    currentTaskIndex: 0,
    completedTasks: [],
    tddTaskState: null,
    doneActions: [],
  };

  writeState(ctx.cwd, newState);
  store.updateIssueStatus(selected.slug, "in-progress");
  ctx.ui.notify(`Activated: ${selected.slug}`, "info");
  this.renderDashboard(ctx, newState, store);
  return newState;
}
```

Keep the new `archived` subcommand before the `list` branch, and update the unknown-subcommand message to mention `archived`.
