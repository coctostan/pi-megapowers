You are verifying whether the implementation satisfies the spec. Evidence before claims, always.

> **Workflow:** brainstorm → spec → plan → implement → **verify** → code-review → done

## Context
Issue: {{issue_slug}}

## Project Conventions
Check `AGENTS.md` for the project's test runner and build commands. If not documented there, infer from the codebase.

## Spec
{{spec_content}}

## Acceptance Criteria
{{acceptance_criteria_list}}

> **Bugfix note:** In bugfix workflows, "Spec" above is the **diagnosis** and acceptance criteria are "Fixed When" criteria. You must also reproduce the original bug's steps and confirm the symptom no longer occurs — passing tests alone is not sufficient.

## Instructions

### Step 1: Run the full test suite fresh
Not from memory. Run the actual commands now and show the output.

### Step 1b (bugfix only): Reproduce the original symptom
Follow the reproduction steps from the diagnosis. Confirm the bug **no longer occurs**. Show the output.

### Step 2: For each acceptance criterion, follow the Gate Function:

1. **IDENTIFY:** What command or code inspection proves this criterion?
2. **RUN:** Execute the command (fresh, complete)
3. **READ:** Full output, check exit code
4. **VERIFY:** Does output confirm the criterion is met?
5. **ONLY THEN:** State pass or fail **with evidence** (actual output, file paths, line numbers)

For criteria covered by `[no-test]` tasks: verify via the task's verification step (build success, type check, code inspection). Document what you checked and why a test isn't applicable.

### Step 3: Produce a verification report

```
## Test Suite Results
[Actual test output, pass/fail counts]

## Per-Criterion Verification

### Criterion 1: [text]
**Evidence:** [command run, output shown]
**Verdict:** pass / fail / partial

### Criterion 2: [text]
...

## Overall Verdict
pass / fail
[Summary explanation]
```

## What Actually Proves a Claim

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Build succeeds | Build command: exit 0 | Linter passing, "looks good" |
| Bug fixed | Reproduce original steps: symptom gone + regression test passes | "Code changed, should be fixed" |
| Regression test works | Red-green cycle verified | Test passes once |
| Subagent completed task | VCS diff + independent test run | Subagent status says "success" |
| Requirements met | Per-criterion evidence | "All tests pass" |

## Red Flags — STOP if you catch yourself doing these

- Using **"should"**, **"probably"**, **"seems to"**, **"looks correct"** — these are not verification
- Expressing satisfaction before running commands — "Great!", "Done!", "Perfect!"
- Claiming a criterion passes based on a different criterion's evidence
- Trusting a previous test run instead of running fresh
- Saying "tests pass" as proof that requirements are met — they are independent checks
- If subagents were used: trusting the subagent's reported status without running tests yourself

## Rules
- **Tests passing ≠ criteria met** — verify both independently
- **No weasel words** — only claims backed by command output from THIS session
- If any criterion fails: explain what's missing and recommend next steps. Use `megapowers_signal({ action: "phase_back" })` to return to implement for fixes. If the plan is fundamentally wrong, call this out explicitly and recommend returning to the plan phase/workflow for replanning.

## Saving

When the verification report is complete, save it to `.megapowers/plans/{{issue_slug}}/verify.md`:
```
write({ path: ".megapowers/plans/{{issue_slug}}/verify.md", content: "<full report>" })
```
(Use `edit` for incremental revisions.)
Then advance with `megapowers_signal({ action: "phase_next" })`.
