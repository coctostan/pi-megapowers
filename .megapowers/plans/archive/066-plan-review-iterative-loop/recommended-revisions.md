# Recommended Revisions — Plan: Entity Parser + Plan Schemas

Generated from review of `.megapowers/plans/066-plan-review-iterative-loop/plan.md`

---

## Per-Task Assessment

### Task 1: Add gray-matter and zod dependencies — ✅ PASS (with note)

No blocking issues. One minor note:

- `zod` is already present in `node_modules` as a transitive dependency of `pi-subagents`. `bun add zod` will add it explicitly to `package.json`, which is correct. No action needed.
- gray-matter ships its own bundled `gray-matter.d.ts`, so no `@types/gray-matter` is needed. ✅
- **Note**: Step 2 verification only runs `bun test`. Consider also verifying with a type-check (`bunx tsc --noEmit`) to catch import type errors early. Not blocking since bun test doesn't type-check.

---

### Task 2: parseFrontmatterEntity — valid parse — ✅ PASS

All 5 steps present, complete, and correct. Step 3 deliberately omits error handling ("added in Task 5") which is acceptable for incremental TDD. The test exercises only the happy path. ✅

---

### Task 3: parseFrontmatterEntity — malformed YAML error — ✅ PASS

All 5 steps present. Step 2 gives a specific expected failure ("crashes with an uncaught exception from gray-matter"). Step 3 wraps `matter(markdown)` in try/catch. ✅

---

### Task 4: parseFrontmatterEntity — missing frontmatter error — ✅ PASS

All 5 steps present. Step 2 failure is specific ("returns validation error rather than missing_frontmatter"). Implementation adds delimiter check at top of function. ✅

---

### Task 5: parseFrontmatterEntity — validation error with field path — ✅ PASS

All 5 steps present. Step 2 failure is specific ("returns only `{ type: "validation" }` without per-field field/message, so countError is undefined"). Implementation maps zod issues to per-field ParseErrors. ✅

---

### Task 6: serializeEntity — roundtrip — ⚠️ PASS (minor dependency annotation gap)

All 5 steps present and correct. One documentation concern:

- **`[depends: 2]` is technically true but misleading.** The test roundtrip calls `parseFrontmatterEntity`, which at Task 2 state lacks try/catch and the missing_frontmatter check. However, `serializeEntity` always produces valid frontmatter (so the roundtrip never hits those code paths), making `[depends: 2]` correct in practice. In sequential execution Tasks 3/4/5 have already run before Task 6 anyway.

**Targeted revision — line `344:ac`:**

> `### Task 6: serializeEntity — roundtrip [depends: 2]`

Consider changing to `[depends: 5]` to reflect that the complete `parseFrontmatterEntity` (with all error paths) is available and the test's Step 5 regression run will pass cleanly. This is a documentation improvement only, not a correctness issue.

```
344:ac|### Task 6: serializeEntity — roundtrip [depends: 2]
```
→ Change `[depends: 2]` to `[depends: 5]`

---

### Task 7: serializeEntity — throws on invalid data — ✅ PASS

All 5 steps present. Step 2 failure is specific ("expected function to throw"). Implementation adds validation before stringify. ✅

---

### Task 8: PlanTaskSchema — validates valid task — ⚠️ PASS (granularity note)

Two `it` blocks in Step 1 ("validates a complete task with all fields" and "applies defaults for optional fields"). This technically violates the "one test + one implementation" guideline. The bundling rationale explains both share the same single implementation step. These two `it` blocks test distinct behaviors (field presence vs. default coalescing).

**Targeted revision — line `462:7e`:**

```
462:7e|**Bundling rationale:** This task validates one PlanTaskSchema behavior unit (valid parsing with defaults) using two examples in a single test block.
```

Split into **Task 8a** (validates full task) and **Task 8b** (applies defaults), each with their own Step 1 test + Step 3 impl block. However, since both use the same schema implementation and the schema doesn't change between 8a and 8b, the bundling is acceptable if the rationale is explicit. **Not blocking** — acceptable as-is given the rationale, but note for the implementer that this is two behaviors in one task.

---

### Task 9: PlanTaskSchema — rejects invalid status — ✅ PASS

All 5 steps present. Step 2 failure is specific ("schema currently accepts any string for status, so result.success is true"). Step 3 tightens `PlanTaskStatusEnum` to `z.enum()`. ✅

---

### Task 10: PlanSummarySchema — ✅ PASS (granularity note)

Four `it` blocks (one happy-path + three rejection cases). Bundling rationale present. All share the single `PlanSummarySchema` implementation added in Step 3. Acceptable given explicit rationale. ✅

---

### Task 11: PlanReviewSchema — ✅ PASS

Three `it` blocks (valid + two rejection cases). Bundling rationale present. All share the single `PlanReviewSchema` implementation. ✅

---

### Task 12: writePlanTask + file path convention — ❌ REVISE

**Issue 1 — Dependency annotation is incomplete (line `768:fe`):**

```
768:fe|### Task 12: writePlanTask + file path convention [depends: 6, 8]
```

The implementation calls `serializeEntity` (Task 6 adds it **without validation**; Task 7 adds validation/throw behavior) and uses `PlanTaskSchema` (Task 8 has loose `z.string()` for status; Task 9 tightens to `z.enum()`). Annotation `[depends: 6, 8]` means if Task 12 were dispatched in parallel after only 6 and 8, it would get an unvalidated `serializeEntity` and a loose status enum.

**Targeted revision — line `768:fe`:**

```
768:fe|### Task 12: writePlanTask + file path convention [depends: 6, 8]
```
→ Change to `[depends: 7, 9]`

This ensures `serializeEntity` validates on write and `PlanTaskSchema` rejects invalid statuses before the store module is built.

**Issue 2 — Three `it` blocks covering two ACs (AC 11 and AC 19) — borderline granularity:**

Three cases: zero-padded path, directory creation, and non-modification of other files. The bundling rationale covers all as "single writePlanTask behavior contract." Acceptable given the rationale. ✅

---

### Task 13: readPlanTask — ✅ PASS

All 5 steps present. Step 2 failure is specific ("`readPlanTask` not exported"). Implementation returns `null` for missing file. ✅

---

### Task 14: listPlanTasks — sorted, gaps allowed — ✅ PASS

All 5 steps present. Step 2 failure is specific. Three `it` blocks (sorted, empty dir, ID gaps) — bundling rationale present. Implementation uses both filename sort and data-level sort for robustness. ✅

Note: The `listPlanTasks` implementation in Task 14 returns `EntityDoc<PlanTask>[] | { error: string }` in its type signature but never actually returns `{ error: string }` — that behavior is intentionally deferred to Task 15. The duplicate ID test in Task 15 validates this. ✅

---

### Task 15: listPlanTasks — duplicate ID error — ✅ PASS

All 5 steps present. Step 2 failure is specific ("returns an array (no error), so `expect(Array.isArray(result)).toBe(false)` fails"). `writeFileSync` is already imported in the test file from Task 12's setup. The raw YAML string in the test (`"---\nid: 1\ntitle: Duplicate\nstatus: draft\n---\nBody"`) correctly parses via `PlanTaskSchema` with zod defaults filling in missing optional fields. ✅

---

### Task 16: writePlanSummary + readPlanSummary — ✅ PASS

All 5 steps present. Paired write+read API over `plan.md`. Bundling rationale present. Step 2 `-t "PlanSummary"` correctly matches `"writePlanSummary / readPlanSummary"` describe block as a substring. ✅

---

### Task 17: writePlanReview + readPlanReview — ✅ PASS

All 5 steps present. Paired write+read API over `review.md`. Bundling rationale present. Step 2 `-t "PlanReview"` correctly matches `"writePlanReview / readPlanReview"` describe block. ✅

---

## Missing Coverage

None. All 22 acceptance criteria are mapped to at least one task. Verified against AC Coverage Map.

---

## Required Revisions Summary

Two targeted line edits needed:

### Revision 1 — Task 6 dependency annotation (line `344:ac`)

```
344:ac|### Task 6: serializeEntity — roundtrip [depends: 2]
```

Change `[depends: 2]` → `[depends: 5]`

**Rationale:** The test's Step 5 regression run exercises `parseFrontmatterEntity` across all error paths (tasks 3/4/5 tests will be in the file). Annotating `[depends: 5]` accurately reflects that the full `parseFrontmatterEntity` is needed for regression safety.

---

### Revision 2 — Task 12 dependency annotation (line `768:fe`) ← **required**

```
768:fe|### Task 12: writePlanTask + file path convention [depends: 6, 8]
```

Change `[depends: 6, 8]` → `[depends: 7, 9]`

**Rationale:** `writePlanTask` calls `serializeEntity` (complete+validated in Task 7) and uses `PlanTaskSchema` (status enum tightened in Task 9). The `[depends: 7, 9]` annotation correctly declares the minimum complete state of both modules needed before building the store layer.

---

## Verdict

**revise** — one required change before implementation (Task 12 dependency annotation), one recommended improvement (Task 6 dependency annotation). All 22 ACs are covered, all tasks have complete 5-step TDD structure, and there are no gaps in the AC coverage map. After the Task 12 annotation fix, the plan is ready for implementation.
