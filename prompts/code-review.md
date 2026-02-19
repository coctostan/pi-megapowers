You are reviewing code quality. Verification already confirmed the feature works — now evaluate whether the code is good.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Verify Results
{{verify_content}}

## Instructions

Review all code changes for this feature (use git diff from branch point if available, otherwise inspect changed files).

### Evaluate against:
- **Correctness** — edge cases, error handling, race conditions
- **Maintainability** — naming, duplication, complexity, readability
- **Patterns** — consistent with codebase conventions, no anti-patterns
- **YAGNI** — unused code, over-engineering, speculative abstractions
- **Test quality** — tests are meaningful (not just coverage), test edge cases, readable

### Categorize findings:
- **Critical** — must fix before merge (bugs, security, data loss)
- **Important** — should fix before merge (maintainability, readability)
- **Minor** — note for later (style nits, optional improvements)

### Produce a report:

```
## Findings

### Critical
[List or "None"]

### Important
[List or "None"]

### Minor
[List or "None"]

## Assessment
ready / needs-fixes / needs-rework
[Explanation]
```

## Rules
- **Verify suggestions against codebase reality** before making them
- Be specific — reference file paths and line numbers
- No performative agreement on future changes — fix now or note for later
- If needs-fixes: implement fixes in this session, re-run tests, update the review
- If needs-rework: recommend going back to implement or plan depending on severity
