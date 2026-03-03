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

## Instructions

Check `AGENTS.md` for the project's language, test framework, and test runner. If not documented there, infer from the codebase (package.json, Cargo.toml, pyproject.toml, etc.). Use the project's actual conventions for file extensions, test locations, and run commands.

Each task should be **bite-sized** — a single test and its minimal implementation. If a task has "and" in its title, split it into two tasks.

### Task template

Write every task exactly like this. The annotations in `(← ...)` are quality criteria — follow them, but don't include them in the output.

```
### Task N: [Name] [depends: 1, 2]

**Files:**
- Create: `exact/path/from/project/root`        (← full paths, never relative or abbreviated)
- Modify: `exact/path/to/existing`
- Test: `exact/path/to/test`

**Step 1 — Write the failing test**
[Full, copy-pasteable test code]                 (← not pseudocode, not "similar to Task 3")

**Step 2 — Run test, verify it fails**
Run: `exact command to run this specific test`
Expected: FAIL — [specific error message]        (← not just "FAIL" — what does the failure say?)

**Step 3 — Write minimal implementation**
[Full, copy-pasteable implementation code]       (← just enough to pass, no extras)

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

## Rules

- **One behavior per task.** One test file, one assertion target. If you're testing two things, that's two tasks.
- **Dependencies first.** Task N must never reference code that doesn't exist until Task N+1.
- **AC coverage.** Every acceptance criterion from the spec must map to at least one task. After writing all tasks, verify this — if an AC has no task, add one.
- **No forward references.** Each task's code must be complete using only what exists before it. No "we'll define this helper in Task 8."
- **No lazy placeholders.** If you write "implement similar logic" or "add tests as appropriate," you've failed. Write the actual code.
- **YAGNI.** No tasks for speculative features not in the spec.

## Common Mistakes

These are what the reviewer will reject. Don't do them:

| ❌ Mistake | ✅ Fix |
|---|---|
| Step 1 says "write a test similar to Task 2" | Write the full test code — every task is self-contained |
| Step 2 says "Expected: FAIL" | Say what fails: "Expected: FAIL — TypeError: processEvent is not a function" |
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
After all tasks are saved, call `megapowers_signal({ action: "plan_draft_done" })` to submit for review.

## Project Learnings
{{learnings}}

## Roadmap Context
{{roadmap}}
