---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 5
  - 1
  - 2
  - 3
  - 4
approved_tasks:
  - 5
needs_revision_tasks:
  - 1
  - 2
  - 3
  - 4
---

### Per-Task Assessment

### Task 1: Verify-and-patch brainstorm prompt requirements-capture contract — ❌ REVISE
- **Coverage:** Good. The task explicitly covers AC 1, 2, 3, 4, and 12.
- **Dependencies:** Fine with no prerequisites.
- **TDD / verification realism:** This is a valid prompt-only `[no-test]` task, but Step 2 is too brittle. The repo already has focused prompt-contract tests in `tests/prompts.test.ts` for issue #118, so verifying with a long chained `grep` against `prompts/brainstorm.md` is not the most realistic or maintainable command.
- **Self-containment:** The file path is correct (`prompts/brainstorm.md`), but the verification step should use the actual test harness (`bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`) instead of shell-string content checks.

### Task 2: Verify-and-patch write-spec prompt traceability contract — ❌ REVISE
- **Coverage:** Good. The task explicitly covers AC 5, 6, 7, 8, 9, and 12.
- **Dependencies:** Correctly depends on Task 1.
- **TDD / verification realism:** Like Task 1, this prompt-only `[no-test]` task should verify through the existing #118 prompt-contract tests rather than a fragile chained `grep` over `prompts/write-spec.md`.
- **Self-containment:** The referenced file is correct (`prompts/write-spec.md`), and the underlying runtime API is `getPhasePromptTemplate("spec")` via `extensions/megapowers/prompts.ts` (`spec -> write-spec.md`). The plan should use that real path/test flow in verification.

### Task 3: Verify-and-patch brainstorm prompt contract tests — ❌ REVISE
- **Coverage:** Covers AC 10.
- **Dependencies:** Correctly depends on Task 1.
- **TDD completeness:** Incomplete. The task only has Step 1 and Step 2; it does not provide the required RED → implementation → GREEN → full-suite flow. For this repo, the test runner is Bun (`bun test` per `AGENTS.md`).
- **No-test validity:** Invalid. This task modifies `tests/prompts.test.ts`, so `no_test: true` is not appropriate. Test code can be wrong and needs its own execution-based validation.
- **Self-containment / realism:** The actual file and API are correct (`tests/prompts.test.ts`, `getPhasePromptTemplate("brainstorm")`), but the task should explicitly anchor to the existing describe block `describe("prompt templates — #118 requirements artifacts contract", ...)` and the existing test names so an implementer does not accidentally create duplicate cases.

### Task 4: Verify-and-patch spec prompt traceability contract tests — ❌ REVISE
- **Coverage:** Covers AC 11.
- **Dependencies:** Correct as written: `[depends: 2, 3]` is needed because it depends on spec-prompt work from Task 2 and shares `tests/prompts.test.ts` with Task 3.
- **TDD completeness:** Incomplete for the same reason as Task 3: only Step 1 and Step 2 are present, with no concrete RED/GREEN/full-suite steps.
- **No-test validity:** Invalid. This task also edits `tests/prompts.test.ts`, so it should not be marked `no_test: true`.
- **Self-containment / realism:** The correct API is `getPhasePromptTemplate("spec")`, not a direct file read. The task should explicitly state that it must patch the existing `#118` describe block and reuse the current spec test names rather than create a new block or duplicate names.

### Task 5: Verify README and add CHANGELOG entry for brainstorm-to-spec model — ✅ PASS
- Coverage is sufficient for AC 13 and wording consistency for AC 12.
- Dependencies on Tasks 1 and 2 are correct.
- `[no-test]` is valid for this documentation-only change.
- The task is self-contained: `README.md` already contains the required brainstorm/spec wording, and the task clearly instructs adding the missing `#118` changelog entry under `## [Unreleased]` / `### Changed`.

### Missing Coverage
None. All 13 acceptance criteria are covered by at least one task.

### Verdict
**revise** — Tasks 1 and 2 need more realistic verification using the existing focused prompt tests, and Tasks 3 and 4 need to stop being `[no-test]` tasks and be rewritten with executable, Bun-based 5-step TDD flows tied to the real `tests/prompts.test.ts` / `getPhasePromptTemplate(...)` APIs.

