# Plan

### Task 1: Delete dead root plan-store module [no-test]

### Task 1: Delete dead root plan-store module [no-test]

**Justification:** Dead-code cleanup only. This task removes an unused root-level module and the test file that exists solely to exercise that dead module. No observable product behavior changes.

**Files:**
- Modify: `extensions/megapowers/plan-store.ts`
- Modify: `tests/plan-store.test.ts`

**Step 1 — Make the change**
Delete these files exactly:
- `extensions/megapowers/plan-store.ts`
- `tests/plan-store.test.ts`

Do not edit any file under `extensions/megapowers/state/`. This task removes only the dead root-level `plan-store` implementation and its corresponding dead test.

**Step 2 — Verify**
Run: `test ! -e extensions/megapowers/plan-store.ts && test ! -e tests/plan-store.test.ts`
Expected: exit code 0; both deleted files are absent.

### Task 2: Delete dead root entity-parser module [no-test]

### Task 2: Delete dead root entity-parser module [no-test]

**Justification:** Dead-code cleanup only. This task removes an unused root-level parser module and the test file that exists solely to exercise that dead module. No observable product behavior changes.

**Files:**
- Modify: `extensions/megapowers/entity-parser.ts`
- Modify: `tests/entity-parser.test.ts`

**Step 1 — Make the change**
Delete these files exactly:
- `extensions/megapowers/entity-parser.ts`
- `tests/entity-parser.test.ts`

Do not edit any file under `extensions/megapowers/state/`. This task removes only the dead root-level `entity-parser` implementation and its corresponding dead test.

**Step 2 — Verify**
Run: `test ! -e extensions/megapowers/entity-parser.ts && test ! -e tests/entity-parser.test.ts`
Expected: exit code 0; both deleted files are absent.

### Task 3: Delete dead root plan-schemas module [no-test] [depends: 1, 2]

### Task 3: Delete dead root plan-schemas module [depends: 1, 2] [no-test]

**Justification:** Dead-code cleanup only. This task removes the final unused root-level schema module and the test file that exists solely to exercise that dead module, then performs the required repository-wide cleanup audit and regression verification. No observable product behavior changes.

**Files:**
- Modify: `extensions/megapowers/plan-schemas.ts`
- Modify: `tests/plan-schemas.test.ts`

**Step 1 — Make the change**
Delete these files exactly:
- `extensions/megapowers/plan-schemas.ts`
- `tests/plan-schemas.test.ts`

Do not edit any file under `extensions/megapowers/state/`. This task removes only the dead root-level `plan-schemas` implementation and its corresponding dead test.

**Step 2 — Verify**
Run: `test ! -e extensions/megapowers/plan-schemas.ts && test ! -e tests/plan-schemas.test.ts`
Expected: exit code 0; both deleted files are absent

Run: `rg -n 'extensions/megapowers/plan-store\.js|extensions/megapowers/entity-parser\.js|extensions/megapowers/plan-schemas\.js' extensions tests`
Expected: no matches

Run: `rg -n '\./entity-parser\.js|\./plan-schemas\.js' extensions`
Expected: no matches in root-level files; only `extensions/megapowers/state/plan-store.ts` and other `state/`-scoped imports may remain

Run: `git diff --name-status -- extensions/megapowers tests`
Expected: only these six deletions appear:
- `D extensions/megapowers/plan-store.ts`
- `D extensions/megapowers/entity-parser.ts`
- `D extensions/megapowers/plan-schemas.ts`
- `D tests/plan-store.test.ts`
- `D tests/entity-parser.test.ts`
- `D tests/plan-schemas.test.ts`

No modified files under `extensions/megapowers/state/` appear in the diff.

Run: `bun test`
Expected: all tests pass
