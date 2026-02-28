# Plan Review Findings: 084-subagent-pipeline (v4)

## Per-Task Assessment

### Task 1: Add `pi-subagents` dependency [no-test] — ✅ PASS
No issues.

### Task 2: Dispatcher types [no-test] — ✅ PASS
No issues.

### Task 3: Message parsing utilities — ✅ PASS
No issues.

### Task 4: `PiSubagentsDispatcher` — ✅ PASS
No issues.

### Task 5: TDD auditor — ✅ PASS
No issues.

### Task 6: Pipeline context builder — ✅ PASS
No issues.

### Task 7: Pipeline log — ✅ PASS
No issues.

### Task 8: jj workspace manager — ✅ PASS
No issues.

### Task 9: Workspace diff helpers — ✅ PASS
No issues.

### Task 10: Result parser — ❌ REVISE
- **Ordering/dependency clarity:** Task 10 depends on message parsing utilities from Task 3 but has no explicit dependency annotation. Add `[depends: 3]`.

### Task 11: Pipeline runner — ❌ REVISE
- **AC 16 under-tested:** The tests do not explicitly assert that the TDD compliance report is included in context sent to the reviewer. Add an assertion by capturing reviewer dispatch input/context and verifying TDD report presence.

### Task 12: Dependency validator — ✅ PASS
No issues.

### Task 13: Pipeline resume metadata store — ✅ PASS
No issues.

### Task 14: Pipeline tool handler — ✅ PASS
No issues.

### Task 15: One-shot subagent tool handler — ❌ REVISE
- **Ordering/dependency clarity:** Uses workspace and parse helpers from earlier tasks but has no explicit dependency annotation. Add `[depends: 8, 10]` (or equivalent precise dependency set).

### Task 16: Add pipeline agents [no-test] — ✅ PASS
Justification is valid (prompt files) and includes verification step.

### Task 17: Satellite compatibility — ✅ PASS
No issues.

### Task 18: Tool wiring — ❌ REVISE
- **Granularity:** Task bundles multiple independent changes (commands filtering + subagent rewrite + pipeline registration + status removal). Split into at least two tasks to keep one implementation unit per task.
- **Ordering/dependency clarity:** This task relies on prior implementation pieces (`PiSubagentsDispatcher`, `pipeline-tool`, `oneshot-tool`) but does not declare dependencies. Add explicit `[depends: 4, 14, 15]` (or exact required set).

### Task 19: Clean slate replacement — ❌ REVISE
- **Coverage/test completeness for AC 34:** `tests/clean-slate.test.ts` checks import failure for only a subset of old modules. Expand assertions to include **all** modules listed for deletion so AC 34 is fully verified.
- **Ordering/dependency clarity:** Add `[depends: 18]` to ensure tool wiring changes are complete before deletion.

## Missing Coverage
None. All ACs are mapped to at least one task.

## Verdict
**revise**

### Required changes before approval
1. Add missing dependency annotations (Tasks 10, 15, 18, 19).
2. Strengthen Task 11 tests to explicitly verify AC 16 (TDD report reaches reviewer context).
3. Split Task 18 into smaller implementation units.
4. Expand Task 19 clean-slate test to cover every deleted legacy subagent module.
