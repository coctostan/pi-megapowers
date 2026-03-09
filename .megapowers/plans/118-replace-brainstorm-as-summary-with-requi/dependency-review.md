## Dependency Summary
- Overall ordering: risky

## Task-to-Task Findings

- Task 1 → Task 3
  - Type: forward-reference
  - Finding: Task 1 Step 2 runs `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"` expecting the brainstorm assertions to exist, but Task 3 is responsible for verifying/patching those very assertions.
  - Suggested fix: Move Task 3 before Task 1, or merge them so test verification happens before prompt verification attempts to use those tests.

- Task 2 → Task 4
  - Type: forward-reference
  - Finding: Task 2 Step 2 runs the same test suite (`#118 requirements artifacts contract`) expecting the spec assertions to exist, but Task 4 is responsible for verifying/patching those spec-related assertions.
  - Suggested fix: Move Task 4 before Task 2, or merge them so test verification happens before prompt verification attempts to use those tests.

- Task 1 ↔ Task 3 (prompts/brainstorm.md)
  - Type: sequencing-hazard
  - Finding: Both tasks modify `prompts/brainstorm.md` — Task 1 patches gaps in the prompt contract, and Task 3 conditionally patches gaps "if a restored assertion exposes a real gap," creating overlapping modification authority.
  - Suggested fix: Consolidate file modification to one task, or make Task 3's conditional modification explicitly check whether Task 1 already patched that gap.

- Task 2 ↔ Task 4 (prompts/write-spec.md)
  - Type: sequencing-hazard
  - Finding: Both tasks modify `prompts/write-spec.md` — Task 2 patches gaps in the prompt contract, and Task 4 conditionally patches gaps "if a restored assertion exposes a real gap," creating overlapping modification authority.
  - Suggested fix: Consolidate file modification to one task, or make Task 4's conditional modification explicitly check whether Task 2 already patched that gap.

- Task 3 → Task 4 (tests/prompts.test.ts)
  - Type: unnecessary-dependency
  - Finding: Task 4 depends on Task 3 even though they modify different assertion groups within the same describe block (brainstorm vs spec) — they could run in parallel if test ordering didn't require Task 3's dependency to be satisfied first.
  - Suggested fix: Keep sequential for safety (same file, same describe block), or make explicit that they target non-overlapping assertion ranges.

## Missing Prerequisites
- All tasks assume `tests/prompts.test.ts` already contains a `describe("prompt templates — #118 requirements artifacts contract", ...)` block. If this describe block doesn't exist, Tasks 3 and 4 will fail when trying to verify/patch assertions within it.

## Unnecessary Dependencies
- Task 5 depends on all four prior tasks (`[1, 2, 3, 4]`) but only needs to confirm prompts and tests are finalized before documenting the model. The dependency on Task 4 is sufficient (Task 4 transitively depends on 1, 2, and 3), so explicit dependencies on Tasks 1, 2, and 3 are redundant.

## Notes for the Main Reviewer
- The "verify-and-patch" pattern assumes tests already exist but treats them as optional — this creates ambiguity about whether the #118 test block is already shipped or needs to be created fresh.
- Recommend reordering: Task 3 → Task 1 → Task 4 → Task 2 → Task 5, or merge (1+3) and (2+4) into single verify-test-then-prompt tasks.
- The overlapping file modifications between (1 and 3) and (2 and 4) should be consolidated or made mutually exclusive via explicit conditional checks.
