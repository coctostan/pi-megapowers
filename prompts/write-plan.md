You are writing a step-by-step implementation plan from a spec. Each task maps 1:1 to a test. A developer with zero context about this codebase should be able to execute any task from this plan alone.

> **Workflow:** brainstorm → spec → **plan** → implement → verify → code-review → done

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Brainstorm Notes
{{brainstorm_content}}

> **Bugfix note:** In bugfix workflows, "Spec" above contains the **diagnosis** (with "Fixed When" criteria instead of acceptance criteria) and "Brainstorm Notes" contains the **reproduction report**. Plan tasks should:
> - Address every "Fixed When" criterion
> - **Task 1 should adopt or build on the failing test from the reproduction report** (if one was written) — don't duplicate or ignore it
> - Include a regression test that reproduces the original bug's exact steps

## Quality Bar

Your plan will be reviewed against these 6 criteria. Every task must pass all of them. Read these BEFORE writing any tasks.

### 1. Coverage
Every acceptance criterion from the spec maps to at least one task. After writing all tasks, go back and verify — if an AC has no task, add one.

### 2. Ordering & Dependencies
Tasks are independent or depend only on earlier tasks. Task N must never reference code that doesn't exist until Task N+1. Use `[depends: N, M]` annotations when a task uses output, types, or utilities from a prior task. No cycles, no forward references.

### 3. TDD Completeness
Every non-`[no-test]` task has all 5 steps with **real, complete code**:
- **Step 1** — Full, copy-pasteable test code. Not pseudocode, not "similar to Task 3", not a description.
- **Step 2** — Exact run command + the **specific error message** the runner will print (e.g., "TypeError: processEvent is not a function", not just "FAIL").
- **Step 3** — Full, copy-pasteable implementation code. Just enough to pass. No "add validation logic here."
- **Step 4** — Same run command as Step 2, expected PASS.
- **Step 5** — Full test suite command, expected all passing.

### 4. Granularity
Each task is one test + one implementation. One logical change, ≤3 files. If the title has "and" in it, split it. If a test has multiple unrelated assertions, split it.

### 5. No-Test Validity
Only config, docs, CI, type-only refactors, or prompt/skill file changes use `[no-test]`. Anything with observable behavior changes needs a test. Every `[no-test]` task must have a justification and a verification step.

### 6. Self-Containment
Each task has actual code — not "similar to Task N", not placeholder comments, not `// ...rest`. A new session must be able to execute the task without reading other tasks. Real file paths, real function signatures, real error messages.

## Read the Codebase First

Before writing any tasks, use `read` to inspect every file you plan to modify. Verify:
- Function signatures and exports
- Import paths and module structure
- Test file conventions (location, naming, test runner)
- Actual APIs — do not invent functions, types, or patterns that don't exist

## Instructions

Check `AGENTS.md` for the project's language, test framework, and test runner. If not documented there, infer from the codebase (package.json, Cargo.toml, pyproject.toml, etc.). Use the project's actual conventions for file extensions, test locations, and run commands.

Each task should be **bite-sized** — a single test and its minimal implementation. If a task has "and" in its title, split it into two tasks.

### Task template

Write every task exactly like this:

```
### Task N: [Name] [depends: 1, 2]

**Files:**
- Create: `exact/path/from/project/root`
- Modify: `exact/path/to/existing`
- Test: `exact/path/to/test`

**Step 1 — Write the failing test**
[Full, copy-pasteable test code]

**Step 2 — Run test, verify it fails**
Run: `exact command to run this specific test`
Expected: FAIL — [specific error message the runner will print]

**Step 3 — Write minimal implementation**
[Full, copy-pasteable implementation code]

**Step 4 — Run test, verify it passes**
Run: `same command as Step 2`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `project's full test suite command`
Expected: all passing
```

Omit `[depends: N, M]` for tasks with no dependencies. Include it whenever a task uses output, types, or utilities from a prior task.

### No-test tasks

Some tasks don't have a meaningful test — config, docs, CI, type-only refactors, prompt/skill files. Mark with `[no-test]`:

```
### Task N: [Name] [no-test]

**Justification:** [Real reason — "config-only", "documentation", "prompt change", etc.]

**Files:**
- Modify: `exact/path/to/file`

**Step 1 — Make the change**
[Full change description or code]

**Step 2 — Verify**
Run: `build command, type check, or other verification`
Expected: [success criteria]
```

Use `[no-test]` sparingly. If a task changes observable behavior, it needs a test. For prompt/skill changes, include a subagent verification step when possible.

## Common Mistakes

| ❌ Mistake | ✅ Fix |
|---|---|
| Step 1 says "write a test similar to Task 2" | Write the full test code — every task is self-contained |
| Step 2 says "Expected: FAIL" with no error detail | Say what fails: "Expected: FAIL — TypeError: processEvent is not a function" |
| Step 3 has a placeholder: "add validation logic here" | Write the actual validation code |
| Task title: "Add parser and validator" | Split into Task N: "Add parser" and Task N+1: "Add validator" |
| File listed as `./utils.ts` or just `utils.ts` | Use full path: `src/utils/parser.ts` |
| `[no-test]` on a task that adds a new function | If it has behavior, it needs a test |
| Task 5 imports a type defined in Task 7 | Reorder so Task 5 comes after Task 7, or merge the dependency |
| No task covers acceptance criterion 4 | Add a task that explicitly covers it |

## Saving Tasks

For each task, call the `megapowers_plan_task` tool with structured parameters:

```
megapowers_plan_task({
  id: 1,
  title: "Task title",
  description: "Full task body — TDD steps, code blocks, implementation details (markdown)",
  depends_on: [2, 3],
  no_test: false,
  files_to_modify: ["path/to/existing.ts"],
  files_to_create: ["path/to/new.ts"]
})
```

## Pre-Submit Checklist

Before calling `megapowers_signal({ action: "plan_draft_done" })`, walk through EVERY task and verify:

- [ ] **Coverage:** Every acceptance criterion has at least one task
- [ ] **Step 1:** Test file path is real; test code is complete and runnable — no placeholders, no `// TODO`
- [ ] **Step 2:** Run command is correct for the project's test runner; expected failure message is the specific error text
- [ ] **Step 3:** Implementation code is complete and uses actual codebase APIs (you verified by reading the files)
- [ ] **Step 4/5:** Run commands match Step 2; full suite command is correct
- [ ] **Self-contained:** No "similar to Task N" — every task stands alone
- [ ] **File paths:** All paths verified against actual codebase structure
- [ ] **No-test tasks:** Each has a real justification and a verification step
- [ ] **Ordering:** No task references code from a later task

If any check fails, fix it before submitting.

## Project Learnings
{{learnings}}

## Roadmap Context
{{roadmap}}
