You are writing a step-by-step implementation plan from a spec. Each task maps 1:1 to a test. A developer with zero context about this codebase should be able to execute any task from this plan alone.

> **Workflow:** brainstorm → spec → **plan** → review → implement → verify → code-review → done

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

Each task should be **bite-sized** — a single test and its minimal implementation. If a task takes more than 5 minutes to describe, it's too big. Split it.

### Task structure

Every task follows the 5-step TDD cycle:

```
### Task N: [Name] [depends: 1, 2]

**Files:**
- Create: `exact/path/to/file`
- Modify: `exact/path/to/existing`
- Test: `exact/path/to/test`

**Step 1 — Write the failing test**
[Full test code]

**Step 2 — Run test, verify it fails**
Run: [exact command to run this specific test]
Expected: FAIL — [specific error message or failure description]

**Step 3 — Write minimal implementation**
[Full implementation code — just enough to pass the test]

**Step 4 — Run test, verify it passes**
Run: [same command as Step 2]
Expected: PASS

**Step 5 — Verify no regressions**
Run: [project's full test suite command]
Expected: all passing
```

Check `AGENTS.md` for the project's language, test framework, and test runner. If not documented there, infer from the codebase (package.json, Cargo.toml, pyproject.toml, etc.). Use the project's actual conventions for file extensions, test locations, and run commands.

### No-test tasks

Some tasks don't have a meaningful test — config changes, documentation, CI setup, type-only refactors. Mark these with `[no-test]`:

```
### Task N: [Name] [no-test]

**Justification:** [Why this task has no test — must be a real reason, not laziness]

**Files:**
- Modify: `exact/path/to/file`

**Step 1 — Make the change**
[Full change description or code]

**Step 2 — Verify**
Run: [build command, type check, or other verification]
Expected: [success criteria]
```

Use `[no-test]` sparingly. If a task changes behavior, it needs a test. Valid reasons: config-only, documentation, pure refactor with existing test coverage, CI/tooling setup, prompt/skill file changes.

For **prompt or skill changes**: use `[no-test]` but include a subagent verification step if possible — run a scenario with the updated prompt and confirm the LLM behaves as expected. This isn't enforced yet but is strongly recommended.

### Key requirements

- **Complete code** — no "implement something similar" or "add validation here"
- **Expected test output** — Step 2 must specify what the failure looks like. This catches tests that pass when they shouldn't.
- **Minimal implementation** — Step 3 writes just enough to make the test pass, nothing more
- **Exact file paths** — every file referenced must include its full path from project root

## Rules
- Tasks must be **independently verifiable** — if a task has "and" in it, split it
- Task order must **respect dependencies** — foundational pieces first
- **Annotate dependencies** — if a task requires output from prior tasks, add `[depends: N, M]` to the title. Omit for tasks with no dependencies.
- **Coverage** — each acceptance criterion from the spec must be covered by at least one task. Call out the mapping explicitly (e.g., "Covers AC 3").
- **YAGNI** — no tasks for speculative features
- **DRY** — extract shared code into utilities, don't duplicate

## Saving

When the plan is complete, save it to `.megapowers/plans/{{issue_slug}}/plan.md`:
```
write({ path: ".megapowers/plans/{{issue_slug}}/plan.md", content: "<full plan content>" })
```
(Use `edit` for incremental revisions.)
Then advance with `megapowers_signal({ action: "phase_next" })`.

## Project Learnings
{{learnings}}

## Roadmap Context
{{roadmap}}
