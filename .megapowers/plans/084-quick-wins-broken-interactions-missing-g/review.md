# Plan Review — Issue #084

## Per-Task Assessment

### Task 1: Add backward transitions to bugfix workflow [no-test] — ❌ REVISE
- This changes observable behavior (FC4), so `[no-test]` is not justified as written.
- Verification only runs existing tests; there is no red/green test proving the new backward transitions were added correctly.
- Action: add a focused test in `tests/workflow-configs.test.ts` (or phase transition test) that fails before and passes after adding `review→plan` and `verify→implement` for bugfix.

### Task 2: Add target parameter to handleSignal and handlePhaseNext — ⚠️ REVISE
- TDD is mostly solid, but Step 1 bundles multiple behaviors (success path, invalid target, bugfix path, backward compatibility) into one task.
- Per granularity rule, this should be split or reduced to one core behavior for this task; move extras to dedicated tasks/tests.
- Action: keep one failing test for `phase_next` with explicit `target`, then move invalid-target/backward-compat checks to separate follow-up tasks.

### Task 3: Add target field to megapowers_signal tool schema — ❌ REVISE
- Step 1 test does not actually verify tool schema registration (`register-tools.ts`); it retests `handleSignal` behavior from Task 2.
- Step 2 explicitly allows PASS before implementation, which breaks strict red→green TDD.
- Action: add a schema/integration test that inspects registered `megapowers_signal` parameters for optional `target` and verifies execute path passes `params.target`.

### Task 4: Add `/phase <target>` command for backward transitions — ❌ REVISE
- The proposed tests do not test `handlePhaseCommand`; they only test `handleSignal` again.
- Step 2 expects PASS before implementation, so no guaranteed failing test.
- FC2/FC3 are command-path acceptance criteria, but command parsing behavior is unverified.
- Action: add direct unit tests for `handlePhaseCommand("implement", ...)` and `handlePhaseCommand("plan", ...)` with mocked deps/context, asserting state transition and notification behavior.

### Task 5: Add artifact versioning to handleSaveArtifact — ⚠️ REVISE
- Good coverage of FC5/FC6 behavior and clear implementation.
- Step 5 runs only `tests/tool-artifact.test.ts`, not full-suite regression command (`bun test`) required by review criteria.
- Implementation picks `nextVersion = existing.length + 1`; this can collide if version files are non-contiguous.
- Action: Step 5 should run `bun test`; compute `nextVersion` as `max(existingVersionNumbers)+1`.

### Task 6: Update 084-reproduce tests to verify fixes — ❌ REVISE
- This is test-only (Step 3 has no implementation), which conflicts with the plan’s one-test/one-implementation granularity rule.
- Step 2 expected result is conditional (“may fail or pass”), not specific red expectation.
- `handleSignal.length >= 3` does not validate 4th-arg target support.
- Action: split into smaller regression tasks per bug, each with deterministic red→green expectations and stronger assertions.

## Missing Coverage
- **FC2 and FC3 are not directly tested at command level** (`/phase <target>` parsing in `commands.ts` is unverified).
- Other Fixed When criteria are mapped, but several are validated indirectly or with non-deterministic TDD steps.

## Ordering & Dependencies
- No dependency cycles detected.
- Recommend adding explicit dependency **Task 6 → Task 4** if Task 6 is meant to assert command-path behavior.

## Verdict
- **revise**

The plan is close, but it is not implementation-ready under the stated review rules due to non-deterministic TDD steps, missing command-path tests for FC2/FC3, and invalid/weak `[no-test]` usage on behavior-changing work.
