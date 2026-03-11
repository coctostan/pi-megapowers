---
id: 3
title: Delete dead root plan-schemas module
status: approved
depends_on:
  - 1
  - 2
no_test: true
files_to_modify:
  - extensions/megapowers/plan-schemas.ts
  - tests/plan-schemas.test.ts
files_to_create: []
---

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
