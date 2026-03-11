---
id: 6
title: Delete satellite-mode helpers and tests
status: approved
depends_on:
  - 3
  - 5
no_test: true
files_to_modify:
  - extensions/megapowers/satellite.ts
  - tests/satellite.test.ts
  - tests/satellite-root.test.ts
  - tests/satellite-resolve-root.test.ts
  - tests/satellite-pi-subagent-depth.test.ts
  - tests/satellite-setup-noop.test.ts
  - tests/satellite-unused-imports.test.ts
files_to_create: []
---

### Task 6: Delete satellite-mode helpers and tests [no-test] [depends: 3, 5]

**Justification:** dead-path deletion. Once the extension no longer branches into satellite mode and the legacy subagent/pipeline path is removed, `satellite.ts` and its satellite-only tests are obsolete implementation details with no remaining runtime entrypoint.

**Files:**
- Modify/Delete: `extensions/megapowers/satellite.ts`
- Modify/Delete: `tests/satellite.test.ts`
- Modify/Delete: `tests/satellite-root.test.ts`
- Modify/Delete: `tests/satellite-resolve-root.test.ts`
- Modify/Delete: `tests/satellite-pi-subagent-depth.test.ts`
- Modify/Delete: `tests/satellite-setup-noop.test.ts`
- Modify/Delete: `tests/satellite-unused-imports.test.ts`

**Step 1 — Make the change**
Delete `extensions/megapowers/satellite.ts` and the satellite-specific tests that only existed to support the removed legacy subagent execution mode.

Also remove any remaining comments in nearby files that describe satellite-mode write-hook exceptions or audit-only subagent execution as a supported runtime path.

**Step 2 — Verify**
Run: `grep -R "satellite" extensions/megapowers tests | cat && bun test`
Expected: no production code imports `./satellite.js`, only intentional historical/docs references remain, and the full test suite passes without the deleted satellite helpers.
