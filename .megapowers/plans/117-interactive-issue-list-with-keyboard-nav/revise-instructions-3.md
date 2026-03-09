## Revise Instructions — Iteration 3

### Critical Issue: Flatten Task Dependencies for Tasks 6-9

All four action-routing tasks (6, 7, 8, 9) are currently chained serially, but they should all depend on Task 5 only. This increases blocking risk and merge conflict likelihood.

## Task 7: Route Open/Activate through the existing activation path

**Issue**: depends_on: [6] should be [5]

**Reasoning**: Task 7 adds an independent `if (result.type === "issue-action" && result.action === "open")` handler. This does not depend on Task 6's create handler logic.

**Fix**: In task-007.md frontmatter, change:
```yaml
depends_on:
  - 6
```
to:
```yaml
depends_on:
  - 5
```

**No code changes needed** — Task 7's implementation is correct as written.

## Task 8: Route Archive through the existing archive behavior

**Issue**: depends_on: [7] should be [5]

**Reasoning**: Task 8 adds an independent `if (result.type === "issue-action" && result.action === "archive")` handler. This does not depend on Task 7's open handler logic.

**Fix**: In task-008.md frontmatter, change:
```yaml
depends_on:
  - 7
```
to:
```yaml
depends_on:
  - 5
```

**No code changes needed** — Task 8's implementation is correct as written.

## Task 9: Route close actions through existing state and phase behavior

**Issue**: depends_on: [8] should be [5]

**Reasoning**: Task 9 adds three independent handlers for `close`, `close-now`, and `go-to-done`. These do not depend on Task 8's archive handler logic.

**Fix**: In task-009.md frontmatter, change:
```yaml
depends_on:
  - 8
```
to:
```yaml
depends_on:
  - 5
```

**No code changes needed** — Task 9's implementation is correct as written.

## Summary of Changes

After these changes, the dependency graph becomes:
- Task 1 (no dependencies)
- Task 2 depends on [1]
- Task 3 depends on [1]
- Task 4 depends on [1]
- Task 5 depends on [1, 2, 3, 4]
- Task 6 depends on [5]  ← unchanged
- Task 7 depends on [5]  ← changed from [6]
- Task 8 depends on [5]  ← changed from [7]
- Task 9 depends on [5]  ← changed from [8]

This allows Tasks 6-9 to be implemented in parallel while maintaining proper Task 5 as the convergence point, reducing merge conflict risk and implementation blocking.
