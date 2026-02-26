# Plan Review — #084 Quick Wins: Broken Interactions & Missing Guards

## Per-Task Assessment

### Task 1: Add bugfix backward transitions with explicit config test — ❌ REVISE
- **Step 1 test is brittle**: asserts exact source-string formatting in `bugfix.ts` via `toContain('{ from: "review", to: "plan", gates: [], backward: true }')`. This breaks on harmless formatting/ordering changes. Should assert via imported `bugfixWorkflow.transitions` (semantic check), matching the pattern used throughout `tests/workflow-configs.test.ts`.
- **Step 3 implementation incomplete**: lists lines to add but not a concrete in-context patch block.

### Task 2: Plumb `target` through `handleSignal` → `handlePhaseNext` — ✅ PASS
- Good AC coverage for FC1. RED/GREEN loop is clear.
- Minor: `target as Phase | undefined` is a direct cast; safer to validate, but not blocking.

### Task 3: Add optional `target` to `megapowers_signal` tool schema — ❌ REVISE
- **Step 1 test is brittle**: source-text `toContain("target: Type.Optional(Type.String")` instead of behavioral/schema assertion. Should test the actual tool behavior end-to-end or at minimum import the schema.
- **Step 3 implementation incomplete**: partial bullets, not full code block.

### Task 4: Support `/phase <target>` command path — ❌ REVISE
- **Granularity issue**: validates two distinct behaviors (FC2: `/phase implement` from code-review, FC3: `/phase plan` from review) in one task with two tests. Rubric asks for one test + one implementation per task.
- **Step 2 expected failure is vague**: "phase remains unchanged" — should include concrete failing assertion text.
- **Step 3 implementation described, not provided as full code block**.

### Task 5: Version artifact on second write (`.v1`) — ✅ PASS
- Good single-behavior focus and command clarity.
- Minor: Step 3 should include concrete rename logic snippet with exact imports/paths.

### Task 6: Version artifact on repeated writes (`.v2`, `.v3`, ...) — ✅ PASS
- Good focused behavior for FC6.
- Minor: same as Task 5 — include explicit implementation block.

### Task 7: Regression verification for FC7 + FC8 [no-test] — ✅ PASS
- Valid `[no-test]` justification (verification-only, no production change).
- Includes concrete verification commands and closure condition.

## Cross-Cutting Issues

1. **Dependency annotations missing**: The plan has ordering notes in prose at the bottom, but no formal `[depends: N]` tags on individual tasks. These should be explicit per-task.

2. **TDD strictness not fully met**: Multiple Step 3 sections are implementation instructions/bullets, not full concrete code blocks. Several Step 2 sections describe expected failure generally, not with specific failure output.

## Missing Coverage
No AC gaps found. FC1–FC8 are all mapped and addressed.

## Verdict
**revise** — Tasks 1, 3, and 4 need adjustment:
- Tasks 1 & 3: Replace source-string-matching tests with semantic assertions (import the config/schema and assert properties)
- Task 4: Split into two tasks (one per FC) or justify combining; provide full Step 3 code
- All tasks: Add explicit `[depends: N]` annotations
- All tasks: Ensure Step 3 has complete, patch-ready code blocks