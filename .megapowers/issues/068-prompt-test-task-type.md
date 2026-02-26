---
id: 68
type: feature
status: open
created: 2026-02-24T00:21:00.000Z
milestone: M5
priority: 2
---

# Add `[prompt-test]` task type for TDD of prompts and skills

## Problem

Prompt and skill files need verification but don't fit either task type:
- Standard tasks require unit tests via a test runner — doesn't apply to prompt files
- `[no-test]` tasks skip verification entirely — too permissive for prompts that change LLM behavior

Prompt changes are currently unverified. A bad prompt change can break an entire workflow phase and won't be caught until a human notices.

## Desired Behavior

### New annotation: `[prompt-test]`

A third task type recognized by the plan parser, with a subagent-based verification cycle inspired by superpowers' skill-writing TDD approach.

### Plan structure

```markdown
### Task N: Update brainstorm prompt to include version control guidance [prompt-test]

**Files:**
- Modify: `prompts/brainstorm.md`

**Step 1 — Establish baseline**
Run a subagent with a test scenario using the CURRENT prompt. Document the behavior gap.
Scenario: "Brainstorm a new CLI flag feature"
Expected baseline: LLM does not mention jj or version control

**Step 2 — Make the change**
[Exact prompt change]

**Step 3 — Verify with subagent**
Run the same scenario with the UPDATED prompt.
Expected: LLM mentions jj, does not run jj commands, saves artifact correctly

**Step 4 — Verify no regressions**
Run a second scenario to confirm existing behavior is preserved.
Scenario: "Brainstorm a database migration feature"
Expected: LLM still asks questions one at a time, produces summary format, etc.
```

### Execution cycle (implement phase)

1. **Baseline** — dispatch subagent with test scenario, current prompt → document behavior
2. **Change** — modify the prompt file (write policy allows without TDD guard)
3. **Verify** — dispatch subagent with same scenario, updated prompt → confirm fix
4. **Regression** — dispatch subagent with different scenario → confirm nothing broke
5. If verification fails, iterate on the prompt change

### Review criteria

Reviewer validates `[prompt-test]` tasks have:
- A concrete test scenario (not "verify it works")
- Expected baseline behavior (what's wrong now)
- Expected post-change behavior (specific, observable)
- A regression scenario

## Implementation

### plan-parser.ts
- Add `[prompt-test]` detection alongside `[no-test]`: `const promptTest = /\[prompt-test\]/i.test(raw)`
- Add `promptTest: boolean` to `PlanTask` interface

### write-policy.ts
- `[prompt-test]` tasks bypass TDD guard for prompt files (similar to `[no-test]`)
- Optionally: only allow writes to `prompts/` and `skills/` directories during `[prompt-test]` tasks

### implement-task.md
- Add `[prompt-test]` execution section alongside standard and `[no-test]` sections
- Document the baseline → change → verify → regression cycle

### review-plan.md
- Add validation criteria for `[prompt-test]` tasks (scenario quality, baseline/expected specified)

### write-plan.md
- Add `[prompt-test]` task template alongside `[no-test]`
- Guidance on when to use: prompt files, skill files, system prompt changes

### verify.md
- `[prompt-test]` criteria verified by subagent scenario results, not test runner output

## Out of Scope
- Automated prompt regression suite (future: save scenarios as replayable tests)
- Prompt quality scoring / metrics
- Superpowers-style pressure scenario framework (combined pressures, rationalization extraction)

## Relationship to other issues
- **#062** (prompt audit) — current work that would benefit from this task type
- **#066** (plan/review iterative loop) — reviewer should validate `[prompt-test]` tasks
