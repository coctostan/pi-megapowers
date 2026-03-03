# Plan Review Notes: Entity Parser + Plan Schemas

**Verdict: REVISE — 3 targeted fixes required**

---

## Per-Task Assessment

### Task 1: Add gray-matter and zod dependencies — ✅ PASS
Valid no-test justification (dependency install only). Verification step requires both `bun test` passing AND inspecting `package.json`, which is correct. Confirmed neither `gray-matter` nor `zod` are currently in `package.json`.

### Task 2: parseFrontmatterEntity — valid parse — ✅ PASS
All 5 steps present. Step 2 failure message ("Cannot find module") is specific. Step 3 minimal implementation intentionally defers per-field error mapping to Task 5 — correct for incremental TDD. No regressions introduced at Step 5.

### Task 3: parseFrontmatterEntity — malformed YAML error — ✅ PASS
All 5 steps present. Step 2 failure message is specific ("crashes with an uncaught exception from gray-matter"). Step 3 wraps `matter()` in try/catch — correct minimal change.

### Task 4: parseFrontmatterEntity — missing frontmatter error — ✅ PASS
All 5 steps present. Step 2 failure message is specific ("returns a validation error... rather than missing_frontmatter"). Step 3 delimiter check is correct.

### Task 5: parseFrontmatterEntity — validation error with field path — ✅ PASS
All 5 steps present. Step 2 specifies that `countError` will be `undefined` — specific enough. Step 3 maps zod issues to per-field errors correctly.

### Task 6: serializeEntity — roundtrip — ✅ PASS
All 5 steps present. Step 2 failure is specific ("import error"). Step 3 uses `matter.stringify()` with appropriate cast. Import update instruction is clear enough given sequential context.

### Task 7: serializeEntity — throws on invalid data — ✅ PASS
All 5 steps present. Step 2 failure is specific ("expected function to throw"). Step 3 validates before serializing. Regex `/Invalid entity data/` matches the throw message.

### Task 8: PlanTaskSchema — validates valid task — ❌ REVISE

**Issue: Bundling rationale contains a factual error.**

Line `462:7e`:
```
**Bundling rationale:** This task validates one PlanTaskSchema behavior unit (valid parsing with defaults) using two examples in a single test block.
```

The two `it` blocks are **separate test cases**, not "examples in a single test block." This description is factually wrong and will confuse a developer trying to understand the plan's granularity decisions. The rationale should accurately describe the structure.

**Fix:** Replace line `462:7e` with:
```
**Bundling rationale:** This task covers one schema contract (AC 7) with two `it` blocks — one for full-field input and one for optional-field defaults — because both validate the same schema definition change.
```

### Task 9: PlanTaskSchema — rejects invalid status — ✅ PASS
Single `it` block. Step 3 is a one-line change to tighten the enum — minimal and correct.

### Task 10: PlanSummarySchema — ✅ PASS
4 `it` blocks with explicit bundling rationale ("one happy-path and focused invalid-case checks for required constraints"). Valid — all 4 cases test the same schema definition. Steps 1–5 complete.

### Task 11: PlanReviewSchema — ✅ PASS
3 `it` blocks with explicit bundling rationale. Valid grouping. Steps 1–5 complete.

### Task 12: writePlanTask + file path convention — ✅ PASS
3 `it` blocks with explicit bundling rationale ("all assertions validate the single writePlanTask behavior contract"). Valid. Steps 1–5 complete. Correctly tests AC 11 and AC 19. Also covers the "writes create dirs" half of AC 21 in the second `it`.

### Task 13: readPlanTask — ❌ REVISE

**Issue: Missing bundling rationale for 2 `it` blocks.**

Every other multi-`it` task in this plan includes a `**Bundling rationale:**` line. Task 13 has 2 `it` blocks covering two distinct behaviors (AC 12: read existing; AC 21: return null on missing) but provides no rationale. This is inconsistent with the plan's established pattern.

**Fix:** Insert a bundling rationale after line `899:65` (`> Covers AC 12, AC 21 (null on missing)`):
```
**Bundling rationale:** `readPlanTask` has exactly two observable outcomes (found vs. not-found), both requiring a single `readPlanTask` implementation. Separating them would split one implementation change across two tasks.
```

### Task 14: listPlanTasks — sorted, gaps allowed — ✅ PASS
3 `it` blocks with explicit bundling rationale. Steps 1–5 complete. The implementation correctly includes `tasks.sort()` and missing-dir guard.

### Task 15: listPlanTasks — duplicate ID error — ✅ PASS
Single `it` block added to existing describe. Step 2 specifies exact failure ("returns an array (no error), so expect(Array.isArray(result)).toBe(false) fails"). Step 3 replaces the full function — clear instruction. `writeFileSync` is already imported in the test file from Task 12.

### Task 16: writePlanSummary + readPlanSummary — ✅ PASS
2 `it` blocks with explicit bundling rationale (paired API over same artifact). Steps 1–5 complete. Step 3 correctly expands imports with `PlanSummarySchema`.

### Task 17: writePlanReview + readPlanReview — ✅ PASS
2 `it` blocks with explicit bundling rationale. Steps 1–5 complete.

---

## Missing Coverage

**None.** All 22 acceptance criteria are covered:

| AC | Covered By | Verified |
|----|-----------|---------|
| 1 | Task 2 | ✅ |
| 2 | Task 3 | ✅ |
| 3 | Task 4 | ✅ |
| 4 | Task 5 | ✅ |
| 5 | Task 6 | ✅ |
| 6 | Task 7 | ✅ |
| 7 | Task 8 | ✅ |
| 8 | Task 9 | ✅ |
| 9 | Task 10 | ✅ |
| 10 | Task 11 | ✅ |
| 11 | Task 12 | ✅ |
| 12 | Task 13 | ✅ |
| 13 | Task 14 | ✅ |
| 14 | Task 15 | ✅ |
| 15 | Task 16 | ✅ |
| 16 | Task 16 | ✅ |
| 17 | Task 17 | ✅ |
| 18 | Task 17 | ✅ |
| 19 | Task 12 | ✅ |
| 20 | Task 14 | ✅ |
| 21 | Tasks 12, 13, 14, 16, 17 | ✅ (see note below) |
| 22 | Tasks 3, 4, 5 | ✅ |

---

## Additional Fix: AC Coverage Map

**Issue: AC 21 row omits Task 12.**

Line `35:ec`:
```
| 21 (reads return null/empty, writes create dirs) | 13, 14, 16, 17 |
```

Task 12's second `it` block ("creates directories if they don't exist") directly tests the "writes create dirs" half of AC 21. The coverage map should include Task 12 here.

**Fix:** Replace line `35:ec` with:
```
| 21 (reads return null/empty, writes create dirs) | 12, 13, 14, 16, 17 |
```

---

## Summary of Required Changes

| # | Location | Anchor | Change |
|---|---------|--------|--------|
| 1 | AC Coverage Map, AC 21 row | `35:ec` | Add `12,` before `13, 14, 16, 17` |
| 2 | Task 8 bundling rationale | `462:7e` | Fix factual error ("single test block" → "two `it` blocks") |
| 3 | Task 13, after AC coverage line | After `899:65` | Insert missing bundling rationale |

---

## Verdict

**REVISE** — 3 minor but specific fixes:
1. AC 21 coverage map missing Task 12
2. Task 8 bundling rationale is factually wrong ("single test block" for two `it` blocks)
3. Task 13 missing bundling rationale (inconsistent with plan's own convention)

None affect the correctness of the implementation. All are quick documentation fixes.
