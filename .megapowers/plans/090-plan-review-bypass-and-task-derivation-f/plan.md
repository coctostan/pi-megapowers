# Plan

### Task 1: Add requirePlanApproved gate type and wire into workflow configs

**Covers:** Fixed When #1, #2, #3 (phase_next blocked when planMode is draft/revise, allowed when null)
**Files:**
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Modify: `extensions/megapowers/workflows/types.ts`
- Modify: `extensions/megapowers/workflows/feature.ts`
- Modify: `extensions/megapowers/workflows/bugfix.ts`
- Modify: `tests/reproduce-090.test.ts`
- Test: `tests/reproduce-090.test.ts`
**Step 1 — Write the failing tests**

Flip the Bug A assertions in `tests/reproduce-090.test.ts` from documenting buggy behavior to asserting correct behavior. These 4 `it()` blocks are the minimal set: two for the blocking cases (AC #1 draft, AC #2 revise), one for the gate-level check, and one for the allowed case (AC #3 planMode null).

```typescript
// Test 1: planMode "draft" — should block (AC #1)
it("phase_next rejects plan→implement when planMode is 'draft' (no review happened)", () => {
  setState({
    phase: "plan",
    planMode: "draft",
    planIteration: 1,
    reviewApproved: false,
  });
  writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");

  const result = advancePhase(tmp);

  expect(result.ok).toBe(false); // Fixed: gate blocks advancement
});

// Test 2: planMode "revise" — should block (AC #2)
it("phase_next rejects plan→implement when planMode is 'revise' (after revise, before re-review)", () => {
  setState({
    phase: "plan",
    planMode: "revise",
    planIteration: 2,
    reviewApproved: false,
  });
  writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");

  const result = advancePhase(tmp);

  expect(result.ok).toBe(false); // Fixed: gate blocks advancement
});
// Test 3: gate check — should fail when planMode is draft
it("gate check for plan→implement blocks when planMode is draft", () => {
  const store = createStore(tmp);
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "plan",
    planMode: "draft",
    planIteration: 1,
    reviewApproved: false,
  };
  store.ensurePlanDir("001-test");
  store.writePlanFile("001-test", "plan.md", "### Task 1: Do something\n");
  const result = checkGate(state, "implement", store, tmp);
  expect(result.pass).toBe(false); // Fixed: gate blocks
});

// Test 4: planMode null — should allow advancement (AC #3)
it("phase_next allows plan→implement when planMode is null (review completed)", () => {
  setState({
    phase: "plan",
    planMode: null,
    planIteration: 1,
    reviewApproved: false,
  });
  writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");

  const result = advancePhase(tmp);

  expect(result.ok).toBe(true); // planMode null means review loop completed
  expect(result.newPhase).toBe("implement");
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/reproduce-090.test.ts --filter "088"`
Expected: FAIL — 3 tests fail with `expect(received).toBe(expected) // expected false, received true` for the draft, revise, and gate-check tests. Test 4 (planMode null) passes since advancement already works when planMode is null.

**Step 3 — Write minimal implementation**
1. Add `RequirePlanApprovedGate` type to `extensions/megapowers/workflows/types.ts`:
```typescript
export interface RequirePlanApprovedGate {
  type: "requirePlanApproved";
}
```
Add to the `GateConfig` union: `| RequirePlanApprovedGate`
```typescript
case "requirePlanApproved": {
  if (state.planMode !== null) {
    return { pass: false, message: `Plan review not complete (planMode: ${state.planMode}). Call plan_draft_done to submit for review.` };
  }
  return { pass: true };
}
```

3. Add the gate to both workflow configs:

`extensions/megapowers/workflows/feature.ts`:
```typescript
{ from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }] },
```

`extensions/megapowers/workflows/bugfix.ts`:
```typescript
{ from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }] },
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/reproduce-090.test.ts --filter "088"`
Expected: PASS — all 4 tests green
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Make extractPlanTasks accept ## headers and em-dash/hyphen separators

**Covers:** Fixed When #6 (extractPlanTasks accepts ## and ### headers with :, —, or - separators)
**Files:**
- Modify: `extensions/megapowers/plan-parser.ts`
- Modify: `tests/reproduce-090.test.ts`
- Test: `tests/reproduce-090.test.ts`
**Step 1 — Write the failing tests**

Flip all Bug B assertions in `tests/reproduce-090.test.ts` from documenting buggy behavior to asserting correct behavior. This includes the unit-level parser tests AND the end-to-end `deriveTasks` test (which exercises the `## Task N —` format through the full pipeline):

```typescript
it("extractPlanTasks accepts ## headers (not just ###)", () => {
  const content = "## Task 1: Set up schema\n## Task 2: Build API\n";
  const tasks = extractPlanTasks(content);
  expect(tasks.length).toBe(2); // Fixed: accepts ## headers
  expect(tasks[0].index).toBe(1);
  expect(tasks[1].index).toBe(2);
});
it("extractPlanTasks accepts em-dash separator (not just colon)", () => {
  const content = "### Task 1 — Set up schema\n### Task 2 — Build API\n";
  const tasks = extractPlanTasks(content);
  expect(tasks.length).toBe(2); // Fixed: accepts em-dash
  expect(tasks[0].description).toBe("Set up schema");
  expect(tasks[1].description).toBe("Build API");
});

// End-to-end: deriveTasks with ## Task N — format (the exact original bug scenario)
it("deriveTasks returns tasks when plan.md uses ## Task N — format", () => {
  writeArtifact("001-test", "plan.md",
    "# Plan\n\n" +
    "## Task 1 — Set up the database schema\n\n" +
    "Create tables for users and roles.\n\n" +
    "## Task 2 — Implement API endpoints\n\n" +
    "Build REST endpoints.\n"
  );

  const tasks = deriveTasks(tmp, "001-test");

  expect(tasks.length).toBe(2); // Fixed: ## and — now accepted
  expect(tasks[0].index).toBe(1);
  expect(tasks[0].description).toBe("Set up the database schema");
  expect(tasks[1].index).toBe(2);
  expect(tasks[1].description).toBe("Implement API endpoints");
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/reproduce-090.test.ts --filter "089"`
Expected: FAIL — 3 tests fail:
- `expect(received).toBe(expected) // expected 2, received 0` (## headers test)
- `expect(received).toBe(expected) // expected 2, received 0` (em-dash test)
- `expect(received).toBe(expected) // expected 2, received 0` (deriveTasks ##— end-to-end test)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/plan-parser.ts`, update `extractTaskHeaders`:

```typescript
function extractTaskHeaders(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  // Accept ## or ### headers, with colon, em-dash (—), en-dash (–), or hyphen (-) separators
  const pattern = /^#{2,3}\s+Task\s+(\d+)\s*[:—–-]\s*(.+)$/gm;

  for (const match of content.matchAll(pattern)) {
    tasks.push(buildTask(parseInt(match[1], 10), match[2].trim()));
  }
  return tasks;
}
```
The pattern changes:
- `###` → `#{2,3}` (accept 2 or 3 hashes)
- `:\s*` → `[:—–-]\s*` (accept colon, em-dash, en-dash, or hyphen as separators)
**Step 4 — Run test, verify it passes**
Run: `bun test tests/reproduce-090.test.ts --filter "089"`
Expected: PASS — all 3 tests green
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing (existing `### Task N:` tests still pass since the pattern is a superset)

### Task 3: Make deriveTasks prefer task files over plan.md parsing

**Covers:** Fixed When #4, #5 (deriveTasks returns tasks from task files when they exist; falls back to plan.md when no task files)
**Files:**
- Modify: `extensions/megapowers/state/derived.ts`
- Modify: `tests/reproduce-090.test.ts`
- Test: `tests/reproduce-090.test.ts`
**Step 1 — Write the failing tests**

Flip the task-files assertion in `tests/reproduce-090.test.ts`:

```typescript
it("deriveTasks reads task files when they exist (ignoring plan.md)", () => {
  const slug = "001-test";
  const planDir = join(tmp, ".megapowers", "plans", slug);
  mkdirSync(planDir, { recursive: true });
  // Write task files (the new canonical format)
  const task1: PlanTask = { id: 1, title: "Set up schema", status: "approved" };
  const task2: PlanTask = { id: 2, title: "Build API", status: "approved" };
  writePlanTask(tmp, slug, task1, "Create tables for users and roles.");
  writePlanTask(tmp, slug, task2, "Build REST endpoints.");
  writeFileSync(join(planDir, "plan.md"), "# Plan\nSee task files.\n");
  const tasks = deriveTasks(tmp, slug);
  expect(tasks.length).toBe(2); // Fixed: reads task files
  expect(tasks[0].index).toBe(1);
  expect(tasks[0].description).toBe("Set up schema");
  expect(tasks[1].index).toBe(2);
  expect(tasks[1].description).toBe("Build API");
});
```

Also add a test for the fallback behavior:

```typescript
it("deriveTasks falls back to plan.md when no task files exist", () => {
  const slug = "002-fallback";
  const planDir = join(tmp, ".megapowers", "plans", slug);
  mkdirSync(planDir, { recursive: true });

  writeFileSync(join(planDir, "plan.md"), "### Task 1: Do something\n### Task 2: Do another\n");

  const tasks = deriveTasks(tmp, slug);
  expect(tasks.length).toBe(2);
  expect(tasks[0].index).toBe(1);
  expect(tasks[1].index).toBe(2);
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/reproduce-090.test.ts --filter "reads task files"`
Expected: FAIL — `expect(received).toBe(expected) // expected 2, received 0` because `deriveTasks` only reads plan.md (returns 0 tasks since plan.md has no parseable headers). The fallback test passes (existing behavior).

**Step 3 — Write minimal implementation**

Update `extensions/megapowers/state/derived.ts`:

```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPlanTasks } from "../plan-parser.js";
import { listPlanTasks } from "./plan-store.js";
import { extractAcceptanceCriteria, extractFixedWhenCriteria } from "../spec-parser.js";
import type { PlanTask, AcceptanceCriterion, WorkflowType } from "./state-machine.js";
import { getWorkflowConfig } from "../workflows/registry.js";
/**
 * Derive tasks from plan store (task files) or fall back to plan.md parsing.
 * Task files are the canonical source in the new plan system.
 * Returns empty array when no tasks are found from either source.
 */
export function deriveTasks(cwd: string, issueSlug: string): PlanTask[] {
  // Prefer task files (canonical source)
  const taskDocs = listPlanTasks(cwd, issueSlug);
  if (taskDocs.length > 0) {
    return taskDocs.map((doc) => ({
      index: doc.data.id,
      description: doc.data.title,
      completed: false,
      noTest: doc.data.no_test ?? false,
      dependsOn: doc.data.depends_on?.length ? doc.data.depends_on : undefined,
    }));
  }
  // Fall back to plan.md parsing (legacy / backward compatibility)
  const planPath = join(cwd, ".megapowers", "plans", issueSlug, "plan.md");
  if (!existsSync(planPath)) return [];
  const content = readFileSync(planPath, "utf-8");
  return extractPlanTasks(content);
}
```

Key mapping: `EntityDoc<PlanTask>` → `PlanTask` (state-machine):
- `doc.data.id` → `index`
- `doc.data.title` → `description`
- `doc.data.no_test` → `noTest`
- `doc.data.depends_on` → `dependsOn` (only if non-empty)
- `completed` always `false` (completion is tracked by `state.completedTasks[]`)
Note: `listPlanTasks` returns `EntityDoc<PlanTask>[]` where `EntityDoc<T>` has `{ data: T; content: string }` — access fields via `doc.data`, NOT `doc.meta`.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/reproduce-090.test.ts --filter "reads task files"`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Add plan_draft_done instruction to revise-plan.md prompt [no-test] [no-test]

**Covers:** Fixed When #7 (revise-plan.md includes explicit instruction to call plan_draft_done), #8 (no plan-phase prompt mentions phase_next)
**Justification:** Prompt-only change — no runtime behavior to test. The runtime gate from Task 1 is the hard enforcement; this is the soft guidance to prevent the LLM from hitting the gate error.
**Files:**
- Modify: `prompts/revise-plan.md`
- Audit (read-only): `prompts/write-plan.md`, `prompts/review-plan.md`

**Step 1 — Read and audit all plan-phase prompts**

Read each of the three plan-phase prompt files to understand their current content and check for any misleading `phase_next` instructions:
1. `read prompts/write-plan.md` — verify it instructs the agent to call `plan_draft_done`, not `phase_next`
2. `read prompts/review-plan.md` — verify it instructs the reviewer to call `megapowers_plan_review`, not `phase_next`
3. `read prompts/revise-plan.md` — verify current content and identify where to add the `plan_draft_done` instruction
**Step 2 — Broad audit: grep ALL plan-phase templates for phase_next**

Grep for `phase_next` across all plan-phase prompt templates (not just the 3 main files) to satisfy Fixed When #8 robustly:
```bash
grep -r "phase_next" prompts/*plan*.md
```
Expected: no matches. If any `phase_next` mentions are found in any plan-phase template, remove them or replace with the correct action (`plan_draft_done` for draft/revise, `megapowers_plan_review` for review).

Also check the individual files:
```bash
grep -r "phase_next" prompts/write-plan.md prompts/revise-plan.md prompts/review-plan.md
```
Expected: no matches.

**Step 3 — Make the change**

Append to the end of `prompts/revise-plan.md`:

```markdown

## When Done

After all revisions are complete, call `megapowers_signal({ action: "plan_draft_done" })` to resubmit for review.
**Do NOT call `phase_next`** — the plan must pass review before advancing to implement.
```

**Step 4 — Verify**

1. Re-run the broad grep audit to confirm no `phase_next` mentions remain across all plan-phase templates:
```bash
grep -r "phase_next" prompts/*plan*.md
```
Expected: no matches
```bash
grep -r "plan_draft_done" prompts/write-plan.md prompts/revise-plan.md
```
Expected: matches in both files
