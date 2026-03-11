You are reviewing code quality. Verification already confirmed the feature works — now evaluate whether the code is good.

> **Workflow:** brainstorm → spec → plan → implement → verify → **code-review** → done

## Context
Issue: {{issue_slug}}

## Project Conventions
Check `AGENTS.md` for the project's language, style conventions, and test framework. If not documented there, infer from the codebase.

## Spec
{{spec_content}}

## Verify Results
{{verify_content}}

## Instructions

Review all code changes for this issue. Use the project's VCS to get the diff (`git diff`, etc.) or inspect the changed files listed in the verification report.

If any advisory or parallel reviewer output was used during implementation, **review the resulting code with the same rigor** — do not assume suggestions are correct just because tests passed.

### Evaluate against:

**Code Quality:**
- Correctness — edge cases, error handling, race conditions
- Maintainability — naming, duplication, complexity, readability
- Patterns — consistent with codebase conventions, no anti-patterns
- YAGNI — unused code, over-engineering, speculative abstractions

**Architecture:**
- Sound design decisions, scalability considerations
- Performance implications, security concerns
- Breaking changes identified and documented

**Testing:**
- Tests are meaningful (not just coverage), test edge cases, readable
- Tests actually test logic, not mocks of implementation details
- For `[no-test]` tasks: verify the justification still holds and no testable behavior slipped through

**Production Readiness:**
- Migration strategy (if schema changes)
- Backward compatibility considered
- No obvious bugs or data loss risks

### For each finding, include:
- **File:line** reference
- **What's wrong**
- **Why it matters**
- **How to fix** (if not obvious)

### Categorize findings:
- **Critical** — must fix before merge (bugs, security, data loss)
- **Important** — should fix before merge (maintainability, readability)
- **Minor** — note for later (style nits, optional improvements)

### Produce a report:

```
## Files Reviewed
[List of files with brief description of changes]

## Strengths
[What's well done — be specific with file:line references]

## Findings

### Critical
[List or "None"]

### Important
[List or "None"]

### Minor
[List or "None"]

## Recommendations
[Improvements for code quality, architecture, or process — separate from issues]

## Assessment
ready / needs-fixes / needs-rework
[Explanation]
```

## Rules
- **Verify suggestions against codebase reality** before making them — read the actual code
- Be specific — reference file paths and line numbers
- No performative agreement on future changes — fix now or note for later
- If needs-fixes: implement fixes in this session, re-run tests, update the review
- If needs-rework: recommend going back to implement or plan depending on severity

## After Review

### If **ready**
Save the report to `.megapowers/plans/{{issue_slug}}/code-review.md` and advance:
```
write({ path: ".megapowers/plans/{{issue_slug}}/code-review.md", content: "<full report>" })
megapowers_signal({ action: "phase_next" })
```
(Use `edit` for incremental revisions.)

### If **needs-fixes**
Small, contained issues (naming, missing error handling, minor bugs). Fix them now:
1. Implement the fixes in this session
2. Re-run the full test suite — confirm nothing broke
3. Update the review report with what was fixed
4. Re-assess — if all findings resolved, change assessment to **ready** and advance

### If **needs-rework**
Structural problems that can't be patched (wrong abstraction, missing component, broken architecture). Don't try to fix inline:
1. Save the review report with detailed findings by writing `.megapowers/plans/{{issue_slug}}/code-review.md` using `write`/`edit`
2. Call `megapowers_signal({ action: "phase_back" })` to go back to the implement phase
3. For fundamental design issues requiring plan changes, inform the user and ask them to manually switch back to the plan phase (do not reference slash commands in this prompt).