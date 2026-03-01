# Plan Review: Entity Parser + Plan Schemas

**Issue:** 066-plan-review-iterative-loop  
**Verdict:** REVISE

---

## Per-Task Assessment

### Task 1: Add gray-matter and zod dependencies — ✅ PASS

No-test justification is valid (pure dependency install). Both steps present with verification. No issues.

---

### Task 2: parseFrontmatterEntity — valid parse — ✅ PASS

All 5 steps present, complete code, correct expected failure. No issues.

---

### Task 3: parseFrontmatterEntity — malformed YAML error — ✅ PASS

All 5 steps present. Expected failure message is specific ("crashes with an uncaught exception from `gray-matter`"). No issues.

---

### Task 4: parseFrontmatterEntity — missing frontmatter error — ✅ PASS

All 5 steps present. Delimiter check logic is correct. No issues.

---

### Task 5: parseFrontmatterEntity — validation error with field path — ✅ PASS

All 5 steps present. Per-field zod issue mapping is correct. No issues.

---

### Task 6: serializeEntity — roundtrip — ❌ REVISE

**Issue 1 — Step 1 strict equality will fail after correct implementation (critical):**

Line `371:c5` in plan.md:
```
expect(parsed.content).toBe(content);
```

gray-matter's `.content` property includes a leading `\n` after the closing `---` delimiter. When `matter.stringify("## Body\n\nSome content here.\n", data)` produces `---\nyaml\n---\n## Body\n...` and it's re-parsed, `parseFrontmatterEntity` returns `parsed.content = "\n## Body\n\nSome content here.\n"` — not `"## Body\n\nSome content here.\n"`. The strict `.toBe(content)` assertion will fail even after writing a correct implementation. This causes Step 4 to say PASS when it will actually still fail.

Note the inconsistency: Tasks 2/3/4 use `.toContain()` for content checks, correctly handling this; Task 6 switches to strict `.toBe()`.

**Fix:** Replace line `371:c5` with:
```typescript
expect(parsed.content.trimStart()).toBe(content);
```
Or change all three content assertions to `.toContain()` style consistent with earlier tasks.

**Issue 2 — Step 1 duplicate import statement:**

Line `356:d8`:
```typescript
import { parseFrontmatterEntity, serializeEntity } from "../extensions/megapowers/entity-parser.js";
```

The file already imports `parseFrontmatterEntity` from the same module (added in Task 2). Adding this line verbatim would create a duplicate import at the top of the test file, causing a TypeScript/linting error. The instruction should say "update the existing import to also include `serializeEntity`" rather than showing a new standalone import line.

---

### Task 7: serializeEntity — throws on invalid data — ❌ REVISE

**Issue — Files section is missing the source file (significant):**

Lines `409:b1`–`411:02`:
```
**Files:**
- Modify: `tests/entity-parser.test.ts`
- Test: `tests/entity-parser.test.ts`
```

Step 3 says "Update `serializeEntity` to validate `data`..." and provides implementation code for `extensions/megapowers/entity-parser.ts`, but `extensions/megapowers/entity-parser.ts` is not listed in the Files section. A developer executing only from the Files list would not know which source file to open.

**Fix:** Add `- Modify: extensions/megapowers/entity-parser.ts` to the Files block at line `409:b1`.

---

### Task 8: PlanTaskSchema — validates valid task — ✅ PASS

Bundling rationale is acceptable (two examples of the same schema's valid-parse behavior). All 5 steps present. Intentionally loose status (`z.string()`) is correctly noted as a placeholder.

---

### Task 9: PlanTaskSchema — rejects invalid status — ✅ PASS

All 5 steps present. Correct incremental tightening. No issues.

---

### Task 10: PlanSummarySchema — ❌ REVISE

**Issue — Duplicate import statement in Step 1:**

Line `594:7b`:
```typescript
import { PlanTaskSchema, PlanSummarySchema } from "../extensions/megapowers/plan-schemas.js";
```

`tests/plan-schemas.test.ts` already imports `PlanTaskSchema` from this module (added in Task 8). Adding this line verbatim creates a duplicate import. The instruction should say "update the existing import to also include `PlanSummarySchema`".

---

### Task 11: PlanReviewSchema — ❌ REVISE

**Issue — Duplicate import statement in Step 1:**

Line `689:dc`:
```typescript
import { PlanTaskSchema, PlanSummarySchema, PlanReviewSchema } from "../extensions/megapowers/plan-schemas.js";
```

By Task 11, `tests/plan-schemas.test.ts` already imports `PlanTaskSchema` (Task 8) and `PlanSummarySchema` (Task 10). Adding this line verbatim creates a third duplicate import. Same fix: "update the existing import to also include `PlanReviewSchema`".

---

### Task 12: writePlanTask + file path convention — ✅ PASS

Bundling rationale is solid (all three `it` blocks exercise the same `writePlanTask` contract). All 5 steps present. `writeFileSync` is imported now even though Task 12's tests don't use it — harmless, and it prevents a missing-import issue in Task 15. No issues.

---

### Task 13: readPlanTask — ❌ REVISE

**Issue — Duplicate import statement in Step 1:**

Line `905:8f`:
```typescript
import { writePlanTask, readPlanTask } from "../extensions/megapowers/plan-store.js";
```

`writePlanTask` is already imported in `tests/plan-store.test.ts` from Task 12. Adding this line verbatim creates a duplicate import. The instruction should say "update the existing import to also include `readPlanTask`".

---

### Task 14: listPlanTasks — sorted, gaps allowed — ❌ REVISE

**Issue — Duplicate import statement in Step 1:**

Line `973:86`:
```typescript
import { writePlanTask, readPlanTask, listPlanTasks } from "../extensions/megapowers/plan-store.js";
```

By Task 14, `writePlanTask` and `readPlanTask` are already imported. Same fix: update the existing import, don't add a new one.

---

### Task 15: listPlanTasks — duplicate ID error — ✅ PASS

Correctly extends the existing `listPlanTasks` describe block. The manual `writeFileSync` setup for the duplicate-ID scenario is clear and complete. All 5 steps present. No issues.

---

### Task 16: writePlanSummary + readPlanSummary — ❌ REVISE

**Issue 1 — Duplicate import in test (Step 1):**

Line `1144:5f`:
```typescript
import { writePlanTask, readPlanTask, listPlanTasks, writePlanSummary, readPlanSummary } from "../extensions/megapowers/plan-store.js";
```

All previous functions already imported. Should be "update the existing import to also include `writePlanSummary`, `readPlanSummary`".

**Issue 2 — Implementation import block replaces rather than extends (Step 3):**

Lines `1182:7e`–`1187:e2`:
```typescript
import {
  PlanTaskSchema,
  PlanSummarySchema,
  type PlanTask,
  type PlanSummary,
} from "./plan-schemas.js";
```

`plan-store.ts` already imports `PlanTaskSchema` and `type PlanTask` from Task 12. This block doesn't make clear whether it *replaces* the existing import or is *added* alongside it. If added verbatim it would duplicate. The step should explicitly say "replace the existing import from `./plan-schemas.js` with this expanded version."

---

### Task 17: writePlanReview + readPlanReview — ❌ REVISE

**Issue 1 — Duplicate import in test (Step 1):**

Line `1231:68`:
```typescript
import { writePlanTask, readPlanTask, listPlanTasks, writePlanSummary, readPlanSummary, writePlanReview, readPlanReview } from "../extensions/megapowers/plan-store.js";
```

Same pattern — all prior functions already imported. Same fix.

**Issue 2 — Implementation import block is ambiguous (Step 3):**

Lines `1271:7e`–`1278:e2`:
```typescript
import {
  PlanTaskSchema,
  PlanSummarySchema,
  PlanReviewSchema,
  type PlanTask,
  type PlanSummary,
  type PlanReview,
} from "./plan-schemas.js";
```

Same ambiguity as Task 16 Step 3. Should explicitly say "replace the existing import from `./plan-schemas.js` with this expanded version."

---

## Missing Coverage

None. All 22 acceptance criteria are addressed by at least one task. The AC Coverage Map is accurate.

---

## Required Revisions

### R1 — Task 6, Step 1 line `371:c5`: Fix roundtrip content assertion (critical)

Change:
```typescript
expect(parsed.content).toBe(content);
```
To:
```typescript
expect(parsed.content.trimStart()).toBe(content);
```

gray-matter's `.content` field includes a leading `\n` after the closing delimiter. Using `.toBe()` without `.trimStart()` will cause Step 4 to fail even after the correct implementation is written.

---

### R2 — Task 7, Files section (lines `409:b1`–`411:02`): Add missing source file

Add `- Modify: extensions/megapowers/entity-parser.ts` to the Files block. The implementation in Step 3 modifies this file but it is not listed.

---

### R3 — Tasks 6, 10, 11, 13, 14, 16, 17 — Import statement instructions

Every "Add to …" test snippet that includes a full `import { ... } from "..."` line would create a duplicate import if added verbatim, because prior tasks already import subsets of those symbols from the same module.

**Affected lines:**
- Task 6 Step 1, line `356:d8`
- Task 10 Step 1, line `594:7b`
- Task 11 Step 1, line `689:dc`
- Task 13 Step 1, line `905:8f`
- Task 14 Step 1, line `973:86`
- Task 16 Step 1, line `1144:5f`
- Task 17 Step 1, line `1231:68`

**Fix for each:** Change the instruction from "Add to …" to "Update the existing import from `[module]` to also include `[new symbol(s)]`." Remove the full `import { ... }` line from the test snippet and replace it with a comment like `// update import: add readPlanTask` so the task is self-contained without causing duplicates.

**Affected implementation blocks (Tasks 16/17):**
- Task 16 Step 3, lines `1182:7e`–`1187:e2`
- Task 17 Step 3, lines `1271:7e`–`1278:e2`

**Fix:** Prefix each with "Replace the existing import from `./plan-schemas.js` with this expanded version:" so it is unambiguous.

---

## Verdict: **revise**

Three categories of issues require correction before implementation:
1. **Critical (R1):** Task 6 roundtrip test will fail after correct implementation due to gray-matter leading-`\n` behavior. Must be fixed before TDD cycle starts.
2. **Significant (R2):** Task 7 Files section is missing the source file being modified.
3. **Significant (R3):** Seven tasks have ambiguous or duplicate import instructions that would produce TypeScript errors if followed verbatim.

Coverage is complete; task ordering and dependencies are sound; all 5 TDD steps are present in every task. The plan is structurally solid — these are targeted fixable issues.
