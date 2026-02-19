# 02: Feature Mode Design

## Overview & Phase Flow

Feature Mode drives a feature from idea to completion through 8 phases:

```
brainstorm → spec → plan → review → implement → verify → code-review → done
```

Each phase is **prompt-driven** — the extension injects a structured prompt template that guides the LLM's behavior, rather than managing sub-steps mechanically. The state machine handles transitions; the prompts handle quality.

All artifacts are stored in a per-issue directory: `.megapowers/issues/<slug>/`. Each phase writes its output as a named file (`brainstorm.md`, `spec.md`, `plan.md`, `review.md`, `verify.md`, `code-review.md`). This gives a complete, browsable history of every feature.

### Transition Rules

- User-initiated via the existing transition UI (menu or `/next` command)
- Each phase has a **gate condition** before advancing — typically the presence of the phase's artifact file with required structure
- Backward transitions allowed: `review → plan` (revise plan), `verify → implement` (fix failures), `code-review → implement` (fix issues)
- Forward skipping not allowed — every phase must produce its artifact

---

## Brainstorm Phase

The brainstorm prompt follows the guided dialogue pattern from the superpowers brainstorming skill.

### Prompt Instructions

The LLM is instructed to:

- Read project context first (files, docs, recent commits)
- Check if the codebase or ecosystem already solves the problem
- Ask questions **one at a time, one per message** — break complex topics into multiple questions
- **Prefer multiple choice** when possible, open-ended when needed
- Focus on understanding: purpose, constraints, success criteria
- Explore **2-3 approaches with trade-offs**, lead with recommendation
- **Design for testability** — favor clear boundaries easy to verify with TDD
- Present design in **200-300 word sections**, covering: architecture, components, data flow, error handling, testing
- Validate each section with the user before continuing
- **Be flexible** — go back and clarify earlier decisions when something doesn't fit
- **YAGNI ruthlessly**
- **Do not write code or edit files** — read-only during brainstorm

### Gate Condition

The LLM produces a summary design document captured as `brainstorm.md`. The extension detects this by looking for a markdown block with key sections (e.g., "## Approach", "## Key Decisions"). Minimum length threshold (>200 chars) as a sanity check.

### Artifact

`brainstorm.md` — freeform design notes, approach rationale, key decisions. This is reference material for the spec phase, not a structured document.

### Context

- **Injected:** Issue slug, issue description (if provided), project constitution (when #06 is built)
- **Carried forward:** `brainstorm.md` content is injected into the spec phase prompt so the LLM doesn't lose the design decisions

---

## Spec Phase

The spec phase converts the brainstorm design into an executable specification with structured acceptance criteria that carry through to verification.

### Prompt Instructions

The LLM is instructed to:

- Read `brainstorm.md` (injected as context)
- Write a spec with a **prescribed structure:**
  - `## Goal` — one-paragraph summary of what's being built and why
  - `## Acceptance Criteria` — numbered list, each criterion is a testable, self-contained statement
  - `## Out of Scope` — explicit boundaries to prevent scope creep
  - `## Open Questions` — anything unresolved (must be empty to advance)
- Each acceptance criterion should be **specific, verifiable, and assume zero codebase context** — "user sees an error message with the validation failure" not "error handling works"
- Criteria should be **TDD-friendly** — each one should map naturally to a test
- Criteria are **bite-sized** — split compound criteria into separate items
- **DRY and YAGNI** — only criteria essential to the goal
- Keep it concise — the spec is a contract, not a design doc

### Gate Condition

`spec.md` present with all four required sections. The extension **parses the acceptance criteria** into structured data (similar to how plan-parser extracts tasks). The `## Open Questions` section must be empty or absent.

### Extraction

Each numbered acceptance criterion is parsed into a list of `{ id: number, text: string, status: "pending" }` objects stored alongside the spec. These flow through to the verify phase where each gets evaluated as pass/fail.

### Artifact

`spec.md` — structured specification with extractable acceptance criteria.

### Context

- **Injected:** Issue slug, `brainstorm.md` content, project constitution (future)
- **Carried forward:** `spec.md` content and extracted criteria are injected into the plan phase prompt

---

## Plan Phase

The plan phase converts the spec into a step-by-step implementation plan. Follows the structure of the superpowers writing-plans skill.

### Prompt Instructions

The LLM is instructed to:

- Read `spec.md` and `brainstorm.md` (injected as context)
- Produce a plan where **each task maps 1:1 to a test**
- Tasks are **bite-sized and independently verifiable** — if a task has "and" in it, split it
- Each task includes: **exact file paths**, what to create/modify, the test that verifies it
- Tasks include **complete code in the plan** — no "implement something similar" hand-waving
- Task order respects dependencies — foundational pieces first
- **TDD sequence per task:** write test → run test (fails) → implement → run test (passes)
- **Assume zero codebase context** — a fresh LLM session should be able to execute any task from the plan alone
- **YAGNI and DRY** throughout

### Gate Condition

`plan.md` present with extractable tasks (using the existing plan-parser). At least one task extracted.

### Extraction

Tasks parsed into `{ id, text, status }` list — same format the plan-parser already supports. Status tracked through implement phase.

### Artifact

`plan.md` — ordered implementation plan with TDD-ready tasks.

### Context

- **Injected:** Issue slug, `spec.md` content, extracted acceptance criteria, `brainstorm.md` content
- **Carried forward:** `plan.md` content and extracted tasks are injected into review and implement phases

---

## Review Phase

The review phase is a same-session LLM critique of the plan before implementation begins. Quick sanity check, not a deep audit. (Subagent-based review will be available when #05 is designed.)

### Prompt Instructions

The LLM is instructed to:

- Read `plan.md` and `spec.md` (injected as context)
- Evaluate the plan against **three criteria:**
  1. **Coverage** — does every acceptance criterion have at least one task addressing it?
  2. **Ordering** — are dependencies respected? Will task N have what it needs from tasks 1..N-1?
  3. **Completeness** — are tasks self-contained enough to execute? Missing file paths, vague descriptions?
- Produce a **verdict:** `pass`, `revise`, or `rethink`
  - `pass` — plan is ready, advance to implement
  - `revise` — specific tasks need adjustment, list what and why, transition back to plan
  - `rethink` — fundamental issue (e.g., wrong approach, missing acceptance criteria), transition back to spec or brainstorm
- Keep feedback **actionable** — "Task 3 doesn't specify which file to modify" not "could be more detailed"
- Present findings to the user for confirmation before transitioning

### Gate Condition

Review artifact written with a `pass` verdict, confirmed by user.

### Artifact

`review.md` — verdict, findings, and any recommended changes.

### Context

- **Injected:** Issue slug, `spec.md` content, extracted acceptance criteria, `plan.md` content
- **Carried forward:** If `pass`, `plan.md` (unchanged) flows into implement. If `revise`, findings injected into plan phase on re-entry.

---

## Implement Phase

The implement phase executes the plan task-by-task with gated progression. The extension feeds one task at a time; the LLM writes tests and code.

### Task-by-Task Flow

1. Extension presents the current task to the LLM (injected into prompt)
2. LLM follows **strict Red-Green-Refactor:**
   - **RED:** Write one failing test. Run it. Confirm it fails for the right reason (missing feature, not typo). If it passes, the test is wrong — fix it.
   - **GREEN:** Write minimal code to pass the test. Run it. Confirm it passes AND all other tests still pass.
   - **REFACTOR:** Clean up — remove duplication, improve names, extract helpers. Keep tests green. Don't add behavior.
3. LLM signals the task is complete with a **checkpoint report**: what was implemented, files changed, test output
4. Extension updates the task status to `complete` in the store
5. Extension presents the next task with **prior task context** — brief summary of what previous tasks produced and relevant file paths
6. When all tasks are done, extension offers transition to verify

### Prompt Instructions

The LLM is instructed to:

- Work on **only the current task** — don't look ahead or refactor future tasks
- **No production code without a failing test first** — code written before a test must be deleted and restarted
- Follow Red-Green-Refactor strictly, verifying both RED and GREEN
- **Do not modify code unrelated to the current task**
- **Report after each task:** what was implemented, files changed, test results
- If stuck, **stop and say so** — don't guess or force through

### When to Stop Executing

- Hit a blocker: missing dependency, test fails repeatedly, instruction unclear
- Plan has a fundamental problem: remaining tasks are heading somewhere wrong
- Something learned during implementation invalidates the plan

**When stopped:** Report what was learned and why. Extension offers: retry current task, transition back to plan phase (revise), or transition back to spec phase (rethink).

### Task Management UI

- Dashboard shows task list with status indicators (pending / in-progress / complete)
- User can **skip** a task (marked as skipped, revisited later)
- User can **reorder** remaining tasks if a dependency issue is discovered
- User can **go back** to re-do a completed task

### Gate Condition

All tasks marked `complete` (or explicitly skipped by user). At least one task completed.

### Artifact

No dedicated artifact file — the code and tests are the artifact. Task status is tracked in the store.

### Context

- **Injected:** Issue slug, `spec.md` content, `plan.md` content, current task details, previous task summaries (brief, to maintain continuity)
- **Carried forward:** Task completion status and `spec.md` (with acceptance criteria) flow into verify

---

## Verify Phase

The verify phase evaluates whether what was built satisfies the spec. **Evidence before claims, always.**

### Prompt Instructions

The LLM is instructed to:

- **Run the full test suite fresh** — not relying on results from implement phase. Show the actual output.
- **For each acceptance criterion, follow the Gate Function:**
  1. IDENTIFY: What command or code inspection proves this criterion?
  2. RUN: Execute the command (fresh, complete)
  3. READ: Full output, check exit code
  4. VERIFY: Does output confirm the criterion is met?
  5. ONLY THEN: State pass or fail **with evidence** (actual output, file paths, line numbers)
- **Tests passing ≠ criteria met** — verify both independently. All tests green but a criterion unaddressed is a `fail`.
- **No weasel words** — "should pass", "looks correct", "seems to work" are not verification. Only claims backed by command output.
- Produce a **verification report** with:
  - Test suite results (actual output, pass/fail counts)
  - Per-criterion verdict: `pass` (with evidence), `fail` (explain gap), or `partial` (explain what's missing)
  - Overall verdict: `pass` (all criteria met with evidence) or `fail` (any criterion not met)
- If any criterion fails: explain what's missing and recommend whether to go back to implement (small fix) or plan (bigger gap)
- Present the report to the user for confirmation

### Gate Condition

`verify.md` written with overall verdict `pass`, confirmed by user.

### On Failure

User chooses transition back to implement (with failed criteria injected as context) or back to plan if the gap is structural.

### Artifact

`verify.md` — actual test output, per-criterion pass/fail with evidence, overall verdict.

### Context

- **Injected:** Issue slug, `spec.md` content, extracted acceptance criteria, task completion summary, `plan.md` content
- **Carried forward:** `verify.md` flows into the code review phase

---

## Code Review Phase

The code review phase evaluates code quality after verification confirms the feature works. Verify = "does it work?" Code review = "is it good?" This phase will also integrate with subagent-based per-task review when #05 is designed.

### Prompt Instructions

The LLM is instructed to:

- Review all code changes for this feature (diff from branch point)
- Evaluate against:
  - **Correctness** — edge cases, error handling, race conditions
  - **Maintainability** — naming, duplication, complexity, readability
  - **Patterns** — consistent with codebase conventions, no anti-patterns
  - **YAGNI** — unused code, over-engineering, speculative abstractions
  - **Test quality** — tests are meaningful (not just coverage), test edge cases, readable
- Produce findings categorized as:
  - **Critical** — must fix before merge (bugs, security, data loss)
  - **Important** — should fix before merge (maintainability, readability)
  - **Minor** — note for later (style nits, optional improvements)
- Produce an overall assessment: `ready` (no critical/important issues), `needs-fixes` (issues to address), or `needs-rework` (structural problems)
- Present findings to the user for confirmation

### Receiving Feedback

When implementing fixes from the review, the LLM follows these principles:

- Verify each suggestion against codebase reality before implementing
- No performative agreement — fix silently or push back with reasoning
- Implement one fix at a time, test each
- Push back when a suggestion breaks functionality, violates YAGNI, or conflicts with prior design decisions

### Gate Condition

`code-review.md` written with `ready` assessment, confirmed by user.

### On `needs-fixes`

LLM implements fixes in-phase, re-runs tests, updates the review. User confirms when resolved.

### On `needs-rework`

User chooses transition back to implement or plan depending on severity.

### Artifact

`code-review.md` — findings by severity, assessment, and resolution notes.

### Context

- **Injected:** Issue slug, `spec.md` content, `verify.md` results, git diff of feature changes
- **Carried forward:** `code-review.md` flows into done for wrap-up context

---

## Done Phase

The done phase provides a guided wrap-up. The extension presents a checklist of finalization actions; the user picks what applies.

### Wrap-up Menu

- **Commit** — commit outstanding changes via jj with a generated message (user can edit)
- **Squash/rebase** — clean up commit history if multiple commits were made during implement
- **Update docs** — LLM generates or updates relevant documentation based on what was built
- **Write changelog entry** — LLM produces a summary of the feature for release notes
- **Close issue** — mark the issue as `done` in the store

### Prompt Instructions

The LLM is instructed to:

- Read `verify.md`, `code-review.md`, and `spec.md` (injected as context)
- Generate a **commit message** summarizing the feature (conventional commits format)
- If user selects docs or changelog, produce them based on the spec and verification report
- Keep it brief — this is housekeeping, not creative work

### Flow

1. Extension presents the wrap-up menu
2. User selects actions (multi-select)
3. Extension and LLM execute selected actions
4. Extension marks the issue as `done` in the store
5. Issue directory (`.megapowers/issues/<slug>/`) is preserved as a complete record

### Gate Condition

None — once the user confirms wrap-up is complete, the workflow ends.

### Artifact

No new artifact file. The issue directory contains the full trail: `brainstorm.md`, `spec.md`, `plan.md`, `review.md`, `verify.md`, `code-review.md`.

---

## Key Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Brainstorm structure | Guided prompt (not mechanical sub-phases) | Prompt does the heavy lifting, keeps state machine simple |
| Spec output | Template-driven with extraction | Structured acceptance criteria flow through to verify |
| Brainstorm vs spec | Separate phases | Spec is a deliberate "crystallize the contract" step |
| Plan→review | Same-session LLM | Subagent review deferred to #05 |
| Implement gating | Task-by-task | Natural checkpoints without forcing commit granularity |
| TDD in implement | Strict Red-Green-Refactor | Iron law: no production code without failing test first |
| Verification | LLM self-check with evidence | LLM runs tests and evaluates criteria with Gate Function |
| Code review | Dedicated phase after verify | "Does it work?" (verify) vs "Is it good?" (code review) |
| Done phase | Guided wrap-up menu | Different features need different cleanup |
| Artifact storage | Per-issue directory | `.megapowers/issues/<slug>/` — complete history in one place |
