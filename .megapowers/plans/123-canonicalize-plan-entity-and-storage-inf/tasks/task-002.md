---
id: 2
title: Delete dead root entity-parser module
status: approved
depends_on: []
no_test: true
files_to_modify:
  - extensions/megapowers/entity-parser.ts
  - tests/entity-parser.test.ts
files_to_create: []
---

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
