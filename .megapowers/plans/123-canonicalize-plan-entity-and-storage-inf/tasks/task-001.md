---
id: 1
title: Delete dead root plan-store module
status: approved
depends_on: []
no_test: true
files_to_modify:
  - extensions/megapowers/plan-store.ts
  - tests/plan-store.test.ts
files_to_create: []
---

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
