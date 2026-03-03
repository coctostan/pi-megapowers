# Code Review: 066-plan-review-iterative-loop

## Files Reviewed

| File | Description |
|------|-------------|
| `extensions/megapowers/entity-parser.ts` | Generic frontmatter parser + serializer using gray-matter + zod |
| `extensions/megapowers/plan-schemas.ts` | Three zod schemas: PlanTask, PlanSummary, PlanReview |
| `extensions/megapowers/plan-store.ts` | File I/O store: writePlanTask, readPlanTask, listPlanTasks, writePlanSummary, readPlanSummary, writePlanReview, readPlanReview |
| `tests/entity-parser.test.ts` | 6 tests covering parse success, all error types, roundtrip, throw-on-invalid |
| `tests/plan-schemas.test.ts` | 10 tests covering valid inputs, defaults, and rejection of invalid values |
| `tests/plan-store.test.ts` | 13 tests covering all store functions, path convention, isolation, gaps, duplicates |

---

## Strengths

- **Tight generic design** (`entity-parser.ts:13–41`): The `parseFrontmatterEntity<T>` + `serializeEntity<T>` pair is small, composable, and does exactly one thing. The discriminated union `ParseResult<T>` makes the success/failure branch explicit at call sites.

- **Schema exports are comprehensive** (`plan-schemas.ts`): Each schema exports both the zod schema and the inferred TypeScript type, plus enum helpers (`PlanTaskStatusEnum`, `PlanReviewVerdictEnum`). This gives consumers everything they need without re-deriving types.

- **`mkdirSync({ recursive: true })` on every write** (`plan-store.ts:26, 64, 75`): Directory creation is idempotent and happens before every write. No caller can trigger a ENOENT.

- **Numeric sort after filename-ordered read** (`plan-store.ts:57`): Files are read in alphabetical order (for determinism) then sorted by `data.id` (numeric). This means the output order is stable and correct regardless of filename anomalies.

- **Test isolation** (`plan-store.test.ts:11–16`): Each test uses a fresh `mkdtempSync` directory and cleans up in `afterEach`. No shared state leaks between tests.

- **Duplicate ID detection tests the right thing** (`plan-store.test.ts:114–132`): The test writes `task-01.md` via the store (gets `id: 1`), then manually writes `task-02.md` with `id: 1` in the frontmatter — correctly decoupling filename from frontmatter ID for the duplicate check.

---

## Findings

### Critical

None.

### Important

**1. `listPlanTasks` silently skips unparseable task files — `plan-store.ts:50`**

```typescript
if (!result.success) continue;
```

A corrupted or schema-invalid task file is silently dropped. The caller receives fewer tasks than are on disk with no indication that anything went wrong. For a future-facing plan coordinator this is a hazard: a task could silently vanish from a list while its file remains on disk.

The duplicate-ID path (`plan-store.ts:51–53`) correctly returns `{ error }`. Corrupted files warrant the same treatment — at minimum returning `{ error }` with the filename and parse errors so callers can surface the problem.

**2. `readPlanTask` returns `null` on parse failure — `plan-store.ts:34–36`**

```typescript
const result = parseFrontmatterEntity(raw, PlanTaskSchema);
if (!result.success) return null;
```

A file that exists but has invalid frontmatter is indistinguishable from a file that doesn't exist. Same issue as above. `readPlanSummary` and `readPlanReview` have the same pattern. The spec says "returns … or `null` when the file does not exist" — returning `null` on corruption stretches that contract.

This matters more once there are callers: a write followed by a malformed-roundtrip read would appear as a no-op with silent data loss.

**Fix (both):** For a minimal fix without touching the external API, the read functions could log a warning (if a logger is available) or the signatures could be widened to `| { error: string }` matching `listPlanTasks`. Since there are no consumers yet, the right moment to decide is now, before the API gets locked in.

**→ Recommendation:** Widen `readPlanTask`, `readPlanSummary`, `readPlanReview` to return `EntityDoc<T> | { error: string } | null` (null = not found, error = parse failure), matching the `listPlanTasks` pattern. Alternatively, keep `null` for not-found and throw on parse failure (fail-fast on corruption). Either is cleaner than the current silent null.

Since this is foundation infrastructure with no consumers, this is the right time to fix. However — the spec explicitly says "returns the parsed task or `null` when the file does not exist" for criteria 12/16/18, which the current implementation satisfies literally. Widening the return type is an API change beyond the spec scope.

**Downgraded to Important (not Critical):** The current behavior is spec-compliant. Noting for follow-up before consumers are wired.

### Minor

**3. `zeroPad` is 2-digit only — `plan-store.ts:7`**

```typescript
return String(id).padStart(2, "0");
```

IDs ≥ 100 produce `"100"` (no padding). Files would sort correctly in `listPlanTasks` (numeric sort after read), but the filename convention becomes inconsistent — `task-01.md` through `task-99.md`, then `task-100.md`. Low risk given typical plan sizes, but worth bumping to 3 digits (`padStart(3, "0")`) for headroom.

**4. Extra blank line — `plan-store.ts:20`**

Two consecutive blank lines between the `planDir` function and the `EntityDoc` interface. Cosmetic, but inconsistent with the rest of the file.

**5. `let parsed: any` — `entity-parser.ts:19`**

The `any` annotation is pragmatic (gray-matter types are loose), but the variable could be typed more narrowly as `{ data: Record<string, unknown>; content: string }` to catch mistakes in subsequent field access. Not urgent since gray-matter's output shape is known and stable.

---

## Recommendations

1. **Follow-up issue for widened read signatures** before wiring consumers. The `null`-on-corruption pattern is the one API decision that could be painful to change later once callers exist.

2. **Consider bumping `zeroPad` to 3 digits** (`padStart(3, "0")`) now, before any task files are written to disk that would need migration.

3. The three-file split (parser / schemas / store) is the right separation. When consumers arrive, the import graph will stay clean.

---

## Assessment

**ready**

The implementation is correct, well-tested, and strictly additive (no existing files touched). The two Important findings are both acknowledged spec-compliant behaviors — they represent API design choices that should be revisited before consumers are wired, not blockers for this PR. No Critical issues exist.
