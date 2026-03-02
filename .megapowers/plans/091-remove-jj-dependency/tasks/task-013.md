---
id: 13
title: Final code/test sweep for residual jj symbols
status: approved
depends_on:
  - 12
no_test: true
files_to_modify:
  - tests/tool-signal.test.ts
  - tests/hooks.test.ts
  - tests/reproduce-086-bugs.test.ts
  - tests/pipeline-diff.test.ts
  - tests/index-integration.test.ts
files_to_create: []
---

### Task 13: Final code/test sweep for residual jj symbols [no-test] [depends: 12]

**Covers AC 12, AC 20**

**Justification for [no-test]:** This is a verification-only sweep task. It doesn't introduce new behavior — it cleans up any stale jj references that slipped through earlier tasks. The verification is done via grep commands and full test suite run, not a new test.

**Step 1 — Identify residuals**

Run:
```bash
grep -R "\bJJ\b\|ExecJJ\|jjChangeId\|taskJJChanges\|createJJ\|jj-messages\|jj\.ts" extensions/megapowers tests --include='*.ts'
```

Any matches in production code or test files (excluding `.megapowers/` plan artifacts) are residuals to fix.

**Step 2 — Apply exact cleanup edits**

For each file with residual matches:

- `tests/tool-signal.test.ts`: remove any remaining `JJ` imports/typed mocks; update `handleSignal` call assertions
- `tests/hooks.test.ts`: deps helper should contain only `{ store, ui }` (no `jj` field)
- `tests/reproduce-086-bugs.test.ts`: deps helper should contain only `{ store, ui }` (no `jj` field)
- `tests/pipeline-diff.test.ts`: rename `ExecJJ`/`execJJ` → `ExecGit`/`execGit`; update diff command assertions
- `tests/index-integration.test.ts`: remove stale jj-availability/jj-message assertions

**Step 3 — Verify**

Run:
```bash
grep -R "\bJJ\b\|ExecJJ\|jjChangeId\|taskJJChanges\|createJJ\|jj-messages" extensions/megapowers tests --include='*.ts'
```
Expected: no matches.

Run:
- `bun test`
Expected: full test suite passes.
