---
id: 2
title: "Make extractPlanTasks accept ## headers and em-dash/hyphen separators"
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/plan-parser.ts
  - tests/reproduce-090.test.ts
files_to_create: []
---

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
