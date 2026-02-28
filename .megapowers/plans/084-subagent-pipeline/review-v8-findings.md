# Plan Review Findings: 084-subagent-pipeline (v8)

## Per-Task Assessment

### Task 1: Add `pi-subagents` dependency [no-test] — ✅ PASS
No issues.

### Task 2: Dispatcher contract [no-test] — ✅ PASS
No issues.

### Task 3: Message parsing utilities — ❌ REVISE
- Step 1 describes behaviors but does not include full test code.
- Step 2 failure expectation is too broad; include exact expected failure text.
- Step 3 describes implementation intent but not full minimal implementation code.

### Task 4: `PiSubagentsDispatcher` adapter — ❌ REVISE
- Same TDD-detail gaps as Task 3 (full test + full minimal implementation missing).
- Step 2 should include exact failure expectation.

### Task 5: TDD auditor — ❌ REVISE
- Same TDD-detail gaps as Task 3 (full test + full minimal implementation missing).

### Task 6: Pipeline context builder — ❌ REVISE
- AC12 intent is present, but task still lacks complete test file + complete minimal implementation code in plan steps.

### Task 7: Pipeline JSONL log — ❌ REVISE
- TDD structure present, but missing full test code and full minimal implementation code.

### Task 8: jj workspace manager — ❌ REVISE
- Missing full test code and full minimal implementation code in task steps.

### Task 9: Workspace diff helpers — ❌ REVISE
- Missing full test code and full minimal implementation code in task steps.

### Task 10: Result parser — ❌ REVISE
- Missing full test code and full minimal implementation code in task steps.

### Task 11: Pipeline runner — ❌ REVISE
- Task scope is too large for strict “one test + one implementation” granularity.
- Split into smaller tasks (happy path, verify-fail retry, review-reject retry, timeout/budget/pause behavior).
- Missing full test file + full minimal implementation code.

### Task 12: Task dependency validator — ❌ REVISE
- Missing full test code and full minimal implementation code.

### Task 13: Pipeline resume metadata store — ❌ REVISE
- Missing full test code and full minimal implementation code.

### Task 14: Pipeline tool handler — ❌ REVISE
- Dependency coverage is improved, but task is still too broad.
- Split into smaller units and include full test/implementation code per task.

### Task 15: One-shot subagent tool — ❌ REVISE
- Missing full test code and full minimal implementation code.

### Task 16: Agent definitions [no-test] — ❌ REVISE
- AC32 naming/wiring risk: AC asks for `reviewer` definition, plan uses `pipeline-reviewer`.
- Clarify wiring or rename to ensure AC32 is unambiguously met.

### Task 17: Satellite compatibility — ❌ REVISE
- Missing full test code and full minimal implementation code.

### Task 18: Commands filtering updates — ❌ REVISE
- Missing full test code and full minimal implementation code.

### Task 19: Tool registration wiring — ❌ REVISE
- Missing full test code and full minimal implementation code.

### Task 20: Clean-slate replacement — ❌ REVISE
- Missing full test code and full minimal implementation code in task steps.
- Add a directory-level assertion to verify no legacy `subagent-*` files remain.

## Missing Coverage
- Potential AC32 gap due to reviewer naming (`pipeline-reviewer` vs required `reviewer`) unless explicitly wired and documented.

## Verdict
**revise**

## Required changes before approval
1. For test-bearing tasks, include full Step 1 test code and full Step 3 minimal implementation code.
2. Make Step 2 expected failures concrete and specific.
3. Split oversized tasks (especially 11 and 14) for strict granularity.
4. Resolve AC32 naming/wiring ambiguity for reviewer agent.
