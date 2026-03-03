# Brainstorm: Reviewer-Authored Revise Instructions Handoff

## Problem

The plan-review loop consistently takes 4+ iterations, even for simple features. Root cause: the three prompts (`write-plan.md`, `review-plan.md`, `revise-plan.md`) are **misaligned on quality criteria**. The drafter doesn't know the reviewer's acceptance bar, the reviewer's findings don't flow structurally to the reviser, and the reviser only understands 2 of the 6 criteria the reviewer evaluates against.

| Criterion | Drafter knows? | Reviewer checks? | Reviser knows? |
|---|---|---|---|
| Coverage | ✅ (buried rule) | ✅ | ❌ |
| Ordering | ✅ (buried rule) | ✅ | ❌ |
| TDD Completeness | ✅ (annotations in code fence) | ✅ | ✅ |
| Granularity | ✅ (buried) | ✅ | ✅ |
| No-Test Validity | ✅ (in section) | ✅ | ❌ |
| Self-Containment | ❌ | ✅ | ❌ |
| Read actual source files | ❌ | N/A | ❌ |

## Approach

This feature aligns all three plan-phase prompts around a shared quality bar and adds a structured handoff artifact so reviewer findings flow directly into the reviser's prompt context.

The drafter prompt (`write-plan.md`) is restructured to front-load the 6 evaluation criteria *before* the task template, add an explicit "read the codebase" instruction, and end with a pre-submit self-review checklist. The current prompt buries quality criteria in three invisible locations: inline annotations inside code fences (agents skip these), rules after the template (too late), and a Common Mistakes table at the very bottom. Moving the quality bar to the top means the agent internalizes the standard before generating any tasks.

The reviewer prompt (`review-plan.md`) gains a new section requiring it to write a `revise-instructions-{iteration}.md` file before submitting a `revise` verdict. This file is task-specific and prescriptive — not "fix TDD completeness" but "Step 2 of Task 3 is missing the error assertion, here's the code." The tool gate in `tool-plan-review.ts` validates this file exists before accepting the verdict. With the drafter now self-checking format issues, the reviewer's instructions shift toward code correctness — are the tests verifying the right behavior, do the implementations use actual codebase APIs?

The reviser prompt (`revise-plan.md`) receives the reviewer's instructions via template injection (`{{revise_instructions}}`), front-loaded at the top of the prompt. It also gets the same 6-criteria quality bar and the same pre-submit checklist. The `prompt-inject.ts` module loads `revise-instructions-{planIteration - 1}.md` when `planMode === "revise"` and populates the template variable.

## Key Decisions

- **Shared quality bar across all 3 prompts.** The same 6 criteria appear in write-plan, review-plan, and revise-plan. This eliminates the misalignment that causes repeated rejections on criteria the drafter/reviser didn't know about.
- **Quality bar before template, not after.** The current write-plan has Rules/Common Mistakes after the template. The agent is already generating by then. Moving criteria to before the template means the agent reads the standard first.
- **Pre-submit checklist in drafter AND reviser.** A self-review step before `plan_draft_done`. Shifts the reviewer's burden from catching format issues to evaluating code correctness.
- **File-based handoff, not tool-parameter-based.** The reviewer writes `revise-instructions-{iteration}.md` as a file artifact rather than relying solely on the `feedback` parameter of `megapowers_plan_review`. Files persist, are injected via template variable, and are versioned per iteration.
- **Iteration numbering: file matches the reviewing iteration.** Reviewer at iteration N writes `revise-instructions-N.md`. Reviser at iteration N+1 reads `revise-instructions-N.md` (loaded as `planIteration - 1`).
- **Gate validation on revise verdict.** `tool-plan-review.ts` checks file existence before accepting `verdict: "revise"`. Returns descriptive error if missing.
- **Graceful fallback on missing file in prompt-inject.** If the file doesn't exist during injection, populate with empty string rather than crashing.
- **Remove "rethink" verdict concept** from review-plan.md. It's confusing — just "approve" or "revise."
- **Explicit "read the codebase" instruction** in write-plan.md. Plans currently disconnect from actual code because the drafter never reads source files.

## Components

### 1. `write-plan.md` — Full Restructure

**Current section order:**
1. Role + workflow
2. Context (issue, spec, brainstorm)
3. Instructions (check AGENTS.md)
4. Task template with `(← ...)` annotations
5. No-test tasks
6. Rules (6 bullets)
7. Common Mistakes table (10 rows)
8. Saving Tasks
9. Learnings + Roadmap

**New section order:**
1. Role + workflow
2. Context (issue, spec, brainstorm)
3. **Quality Bar** — 6 criteria (NEW, front-loaded)
4. **Read the Codebase** — explicit instruction to read source files (NEW)
5. Instructions (check AGENTS.md, bite-sized)
6. Task template — cleaned, no inline annotations
7. No-test tasks
8. Common Mistakes table — trimmed (Quality Bar covers most; keep as concrete examples)
9. Saving Tasks
10. **Pre-Submit Checklist** — self-review against criteria (NEW)
11. Learnings + Roadmap

**Quality Bar section content (6 criteria):**
1. **Coverage** — every acceptance criterion from the spec maps to at least one task
2. **Ordering** — tasks are independent or depend only on earlier tasks; dependency chain is explicit via `depends_on`
3. **TDD Completeness** — every task has all 5 steps with *real code*: test file path, complete test code, run command with specific expected failure message, complete implementation code, green run command
4. **Granularity** — each task touches ≤3 files, one logical change
5. **No-Test Validity** — only config/prompt/infra tasks use `no_test: true`; anything with logic has tests
6. **Self-Containment** — each task has actual code, not "similar to Task N", not placeholder comments, not `// ...rest`. A new session must be able to execute the task without reading other tasks.

**Read the Codebase section content:**
- Before writing any tasks, use `read` to inspect every file you plan to modify
- Verify function signatures, imports, module structure
- Do not invent APIs — use what actually exists in the codebase
- Note actual file paths, not assumed ones

**Template cleanup:**
- Remove `(← ...)` annotations from inside the code fence — they're invisible to the agent inside code blocks and the Quality Bar now covers them
- Keep the structural template (frontmatter + 5 steps + files_to_modify/create) since it defines the format

**Pre-Submit Checklist content:**
Before calling `plan_draft_done`, walk through EVERY task and verify:
- [ ] Step 1: test file path exists or will be created; test code is complete and runnable — no placeholders, no `// TODO`
- [ ] Step 2: test code tests the *right behavior* — not just "expect function to exist"
- [ ] Step 3: run command is correct for the test runner; expected failure message is the specific error text, not "should fail"
- [ ] Step 4: implementation code is complete and uses actual codebase APIs (verified by reading files)
- [ ] Step 5: green run command matches Step 3
- [ ] No "similar to Task N" — every task is self-contained
- [ ] File paths verified against actual codebase structure

### 2. `review-plan.md` — Targeted Additions

The existing 6-criteria structure stays (it works well). Three changes:

**A. Focus shift note** (added to criteria preamble):
> The drafter has a pre-submit checklist matching these criteria. Structural issues (missing steps, placeholders) should be rare. Focus your review on CODE CORRECTNESS: Are the tests testing the right behavior? Does the implementation use the correct APIs from the actual codebase? Will this code work when executed?

**B. Revise-instructions handoff section** (new section after Verdict Definitions, before After Review):
> When your verdict is `revise`, you MUST write `revise-instructions-{iteration}.md` to the plan directory BEFORE calling the tool. This file is injected directly into the reviser's prompt — it is their primary guide.
>
> The file must be **prescriptive and task-specific:**
> - Per-task headers (`## Task N: title`)
> - Specific code showing what's wrong and what it should look like
> - NOT "fix TDD completeness" — instead "Step 2 is missing the error assertion. It should be: `expect(result.error).toBe('file not found: revise-instructions-1.md')`"
> - Reference actual codebase APIs/signatures found during review
> - Only cover tasks that need changes — don't repeat tasks that are fine

**C. Remove "rethink" verdict.** Replace with: "Use `revise` when tasks need changes. Use `approve` when every task passes all 6 criteria."

### 3. `revise-plan.md` — Full Restructure

**Current section order:**
1. Role + workflow
2. Context (issue, read review artifact)
3. Instructions (4 steps)
4. Tool usage for metadata
5. Body changes with read+edit
6. 5-step TDD structure
7. Granularity guidance
8. Common Revision Failures table
9. When Done

**New section order:**
1. Role + workflow
2. Context (issue)
3. **Reviewer's Instructions** — `{{revise_instructions}}` (NEW, front-loaded)
4. **Quality Bar** — same 6 criteria as write-plan (NEW)
5. Instructions — focus on fixing needs_revision tasks, addressing reviewer's specific points
6. Tool usage
7. Common Revision Failures table
8. **Pre-Submit Checklist** — identical to write-plan's (NEW)
9. When Done

**Reviewer's Instructions section:**
```
## Reviewer's Instructions
{{revise_instructions}}
```
Front-loaded so the reviser reads the reviewer's specific feedback before anything else. When `revise_instructions` is empty (shouldn't happen in revise mode, but graceful fallback), this section is simply blank.

**Removed sections:** Standalone "5-step TDD structure" and "Granularity guidance" — now covered by Quality Bar criteria #3 and #4. Avoids duplication.

### 4. `prompt-inject.ts` — Load Revise Instructions

In `buildInjectedPrompt`, when `planMode === "revise"`:
- Compute filename: `revise-instructions-${state.planIteration - 1}.md`
- Load via `store.readPlanFile(state.activeIssue, filename)`
- If found: set `vars.revise_instructions` to file content
- If not found: set `vars.revise_instructions` to empty string (graceful fallback)
- When `planMode !== "revise"`: don't load, `revise_instructions` stays empty/undefined

### 5. `tool-plan-review.ts` — Gate Validation

In `handlePlanReview`, when `verdict === "revise"`:
- Compute expected filename: `revise-instructions-${state.planIteration}.md` (current iteration, before bump)
- Check file existence via `store.readPlanFile(slug, filename)`
- If missing: return error `"You must write revise-instructions-${N}.md before submitting a revise verdict. Save it to .megapowers/plans/${slug}/revise-instructions-${N}.md with prescriptive, task-specific instructions."`
- If present: proceed with existing revise logic (bump iteration, set planMode)

## Data Flow

**Happy path (iteration 1 → 2):**

1. Drafter writes tasks, self-reviews against Quality Bar + Pre-Submit Checklist, calls `plan_draft_done`. `planIteration = 1`.
2. Reviewer session starts. Reviews tasks against same 6 criteria, focusing on code correctness. Finds issues.
3. Reviewer writes `revise-instructions-1.md` to plan directory — prescriptive, per-task, with code snippets.
4. Reviewer calls `megapowers_plan_review({ verdict: "revise", ... })`.
5. `tool-plan-review.ts` validates `revise-instructions-1.md` exists. Present → bumps `planIteration` to 2, sets `planMode = "revise"`.
6. Reviser session starts. `prompt-inject.ts` sees `planMode === "revise"`, loads `revise-instructions-1.md` (iteration = `planIteration - 1` = 1), populates `{{revise_instructions}}`.
7. Reviser sees reviewer's instructions inline at top of prompt. Fixes tasks. Self-reviews against Quality Bar + Pre-Submit Checklist. Calls `plan_draft_done`.
8. Reviewer session starts again at iteration 2. If satisfied → `approve`. If not → writes `revise-instructions-2.md`, calls `revise`.

**Iteration numbering:**
- Reviewer at iteration N writes `revise-instructions-N.md`
- After verdict, `planIteration` bumps to N+1
- Reviser at iteration N+1 reads `revise-instructions-{N+1 - 1}.md` = `revise-instructions-N.md` ✓

**Edge cases:**
- First draft (iteration 1, mode "draft"): no revise-instructions to load
- Approve verdict: no file check needed
- Max iterations (4): `revise-instructions-3.md` is the last possible file

## Error Handling

1. **File missing on revise verdict:** `tool-plan-review.ts` returns descriptive error telling the reviewer exactly what file to write and where.
2. **File missing during prompt injection:** Graceful — `revise_instructions` set to empty string. The reviser still has the `feedback` parameter from the tool call as a secondary channel.
3. **Iteration math overflow:** `planIteration - 1` could theoretically be 0 only if a revise-mode prompt fires at iteration 1. This shouldn't happen (revise mode starts at iteration 2+), but the readPlanFile call for `revise-instructions-0.md` would simply return null → empty string.
4. **Reviewer writes wrong filename:** The gate checks the exact expected filename. If the reviewer writes `revise-instructions-2.md` when the current iteration is 1, the gate fails and tells them the correct filename.

## Testing Strategy

### `prompt-inject.ts` tests
- When `planMode === "revise"` and `revise-instructions-{N-1}.md` exists → `vars.revise_instructions` populated with file content
- When `planMode === "revise"` and file missing → `vars.revise_instructions` is empty string
- When `planMode === "draft"` → `revise_instructions` not loaded (undefined or empty)
- Iteration math: `planIteration = 2` → loads `revise-instructions-1.md`; `planIteration = 3` → loads `revise-instructions-2.md`

### `tool-plan-review.ts` tests
- `verdict: "revise"` with `revise-instructions-{N}.md` present → succeeds, proceeds with revise logic
- `verdict: "revise"` with file missing → returns error with descriptive message including expected filename
- `verdict: "approve"` → no file existence check performed
- Error message includes the correct file path

### Prompt template structural tests
- `revise-plan.md` contains `{{revise_instructions}}` template variable
- `review-plan.md` contains instruction text about writing `revise-instructions` file
- `write-plan.md` has "Quality Bar" section appearing before "Task Template" section
- `write-plan.md` has "Pre-Submit Checklist" section
- `write-plan.md` does NOT have `(←` annotations inside code fences
- `revise-plan.md` has "Quality Bar" section
- `revise-plan.md` has "Pre-Submit Checklist" section
